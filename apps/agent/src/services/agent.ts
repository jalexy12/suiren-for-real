import { ToolLoopAgent, tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { Bash } from 'just-bash'
import { z } from 'zod'
import { join } from 'node:path'
import * as chrono from 'chrono-node'
import { runSubagent, type SubagentStep } from './subagents'
import { prepareCompaction, isCompactCommand, type CompactionEvent } from './compaction'
import {
  loadSkills,
  generateSkillsPrompt,
  getAvailableSkills,
  type SkillRegistry,
} from './skills'
import { AGENTFS_PATHS } from '@suiren/shared'
import { convex, api } from '../lib/convex'
import type { UIMessageStreamWriter } from 'ai'
import { MODELS, AGENT_CONFIG, PATHS } from '../config'

const CONTEXT_LIMIT = 200000 // Claude Sonnet context window

// Tool search for deferred loading - reduces initial token overhead
const toolSearchTool = anthropic.tools.toolSearchBm25_20251119()

// Anthropic built-in tools (will be deferred)
const webSearchTool = anthropic.tools.webSearch_20250305({
  maxUses: AGENT_CONFIG.maxWebSearches,
})

const webFetchTool = anthropic.tools.webFetch_20250910()

const codeExecutionTool = anthropic.tools.codeExecution_20250825()

// Store per-user bash environments
const userEnvs = new Map<string, Bash>()

// Global skill registry (loaded once at startup)
let skillRegistry: SkillRegistry | null = null

// Initialize skills from filesystem (call once at app startup)
export async function initializeSkills(): Promise<void> {
  const skillsDir = join(import.meta.dir, '../../skills')
  skillRegistry = await loadSkills(skillsDir)
}

function getOrCreateEnv(userId: string): Bash {
  if (!userEnvs.has(userId)) {
    // Bootstrap skills into virtual filesystem
    const skillFiles = skillRegistry?.files ?? {}

    userEnvs.set(userId, new Bash({
      cwd: PATHS.userHome,
      files: {
        [`${PATHS.userHome}/.suirc`]: '# Sui home directory\n',
        ...skillFiles,
      },
    }))
  }
  return userEnvs.get(userId)!
}

export function getEnv(userId: string): Bash {
  return getOrCreateEnv(userId)
}

export function createAgent(userId: string, writer?: UIMessageStreamWriter) {
  const env = getOrCreateEnv(userId)

  const bashTool = tool({
    description: 'Execute bash commands in a sandboxed environment. Use this to create files, run commands, and manage the filesystem.',
    inputSchema: z.object({
      command: z.string().describe('The bash command to execute'),
    }),
    execute: async ({ command }: { command: string }) => {
      const result = await env.exec(command)
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      }
    },
  })

  const startTaskTool = tool({
    description: `Spawn a subagent to handle a task autonomously. The subagent runs in its own context, executes multiple steps, and returns a result. Use this when:
- The task requires multiple steps of research or exploration
- You want to delegate focused work while you continue
- The task needs deep investigation

Available agents:
- researcher: Deep research, exploring files, synthesizing information
- planner: Break down complex tasks into actionable steps
- coder: Write, analyze, or debug code

The subagent has access to the same bash environment as you.`,
    inputSchema: z.object({
      task: z.string().describe('Clear description of what the subagent should accomplish'),
      agent: z.enum(['researcher', 'planner', 'coder'] as const).describe('Which subagent to use'),
      context: z.string().optional().describe('Additional context from the current conversation'),
    }),
    execute: async ({ task, agent, context }: { task: string; agent: 'researcher' | 'planner' | 'coder'; context?: string }) => {
      const fullTask = context ? `${task}\n\nContext: ${context}` : task
      const taskId = `task-${Date.now()}`
      const allSteps: SubagentStep[] = []

      // Stream initial status
      writer?.write({
        type: 'data-subagent-progress',
        data: {
          taskId,
          agentType: agent,
          status: 'running',
          currentStep: 'Starting...',
          steps: [],
        },
      })

      try {
        const result = await runSubagent(agent, fullTask, { bash: bashTool }, (step) => {
          allSteps.push(step)
          writer?.write({
            type: 'data-subagent-progress',
            data: {
              taskId,
              agentType: agent,
              status: 'running',
              currentStep: step.name || step.type,
              steps: allSteps.map(s => ({ type: s.type, name: s.name, args: s.args, result: s.result, timestamp: s.timestamp })),
            },
          })
        })

        // Final status
        writer?.write({
          type: 'data-subagent-progress',
          data: {
            taskId,
            agentType: agent,
            status: result.success ? 'completed' : 'error',
            steps: allSteps.map(s => ({ type: s.type, name: s.name, args: s.args, result: s.result, timestamp: s.timestamp })),
          },
        })

        return {
          success: result.success,
          summary: result.summary,
          agentType: agent,
          steps: allSteps.map(s => ({ type: s.type, name: s.name, args: s.args })),
          error: result.error,
        }
      } catch (error) {
        writer?.write({
          type: 'data-subagent-progress',
          data: {
            taskId,
            agentType: agent,
            status: 'error',
            error: String(error),
            steps: allSteps.map(s => ({ type: s.type, name: s.name, args: s.args, result: s.result, timestamp: s.timestamp })),
          },
        })

        return {
          success: false,
          summary: 'Subagent failed',
          agentType: agent,
          steps: allSteps.map(s => ({ type: s.type, name: s.name, args: s.args })),
          error: String(error),
        }
      }
    },
  })

  // Skills tool - load full skill instructions on demand
  const availableSkills = skillRegistry ? getAvailableSkills(skillRegistry) : []
  const loadSkillTool = tool({
    description: `Load full instructions for a skill to guide your approach. Available skills: ${availableSkills.join(', ') || 'none'}. Use this when you need detailed guidance for a specific task type.`,
    inputSchema: z.object({
      skill_name: z.string().describe('The name of the skill to load'),
    }),
    execute: async ({ skill_name }: { skill_name: string }) => {
      const result = await env.exec(`cat ${AGENTFS_PATHS.skills}/${skill_name}.md`)
      if (result.exitCode !== 0) {
        return {
          success: false,
          error: `Skill "${skill_name}" not found. Available skills: ${availableSkills.join(', ')}`,
        }
      }
      return {
        success: true,
        skill_name,
        instructions: result.stdout,
      }
    },
  })

  // Generate skills section for system prompt
  const skillsPrompt = skillRegistry ? generateSkillsPrompt(skillRegistry.summaries) : ''

  // Schedule messages for later - creates a new conversation at the scheduled time
  const sendLaterTool = tool({
    description: `Schedule a message to send to the user later. Creates a new conversation at the scheduled time.

Use this for:
- Reminders: "Remind me to call Sarah at 3pm"
- Follow-ups: "Check in with me tomorrow about the project"
- Scheduled messages: "Send me a motivational quote every morning"

Time formats: "in 2 hours", "at 3pm", "tomorrow at 9am", "next Monday"`,
    inputSchema: z.object({
      message: z.string().describe('The message to send to the user'),
      when: z.string().describe('When to send - natural language like "in 2 hours", "at 3pm", "tomorrow morning"'),
    }),
    execute: async ({ message, when }: { message: string; when: string }) => {
      const parsed = chrono.parseDate(when, new Date())
      if (!parsed) {
        return { success: false, error: `Could not parse time: "${when}"` }
      }

      // Don't allow scheduling in the past
      if (parsed.getTime() <= Date.now()) {
        return { success: false, error: 'Cannot schedule messages in the past' }
      }

      try {
        const id = await convex.mutation(api.scheduledMessages.schedule, {
          userId,
          message,
          scheduledFor: parsed.getTime(),
        })
        return {
          success: true,
          scheduledFor: parsed.toISOString(),
          id: id.toString(),
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  })

  return new ToolLoopAgent({
    model: anthropic(MODELS.agent),
    instructions: `You are Sui, an intelligent assistant that helps users manage their life.

You have a bash environment (your home is ${PATHS.userHome}) for files, notes, and commands.

Use tool_search to discover additional capabilities when needed - web search, code execution, subagents, scheduling, and more.

Be concise. Don't over-explain unless asked.
${skillsPrompt}`,
    tools: {
      // Tool search - discovers deferred tools on demand
      tool_search: toolSearchTool,
      // Always-loaded tools (essential, low token cost)
      bash: bashTool,
      // Deferred tools - discovered via tool_search when needed
      start_task: {
        ...startTaskTool,
        providerOptions: { anthropic: { deferLoading: true } },
      },
      load_skill: {
        ...loadSkillTool,
        providerOptions: { anthropic: { deferLoading: true } },
      },
      send_later: {
        ...sendLaterTool,
        providerOptions: { anthropic: { deferLoading: true } },
      },
      // Anthropic built-in tools (deferred)
      web_search: {
        ...webSearchTool,
        providerOptions: { anthropic: { deferLoading: true } },
      },
      web_fetch: {
        ...webFetchTool,
        providerOptions: { anthropic: { deferLoading: true } },
      },
      code_execution: {
        ...codeExecutionTool,
        providerOptions: { anthropic: { deferLoading: true } },
      },
    },

    // BEFORE each step: check and compact if needed
    prepareStep: async ({ messages, steps }) => {
      // Check if user sent /compact command
      const lastMsg = messages.at(-1)
      const forceCompact = lastMsg ? isCompactCommand(lastMsg as any) : false

      const result = await prepareCompaction(messages as any, steps as any, forceCompact)

      if (result.compacted) {
        const compactionEvent: CompactionEvent = {
          occurred: true,
          summary: result.summary,
          messageCount: result.messageCount,
          tokensBefore: result.tokensBefore,
        }

        // Notify frontend of compaction
        writer?.write({
          type: 'data-compaction',
          data: compactionEvent,
        })

        return { messages: result.messages as any }
      }

      return {} // No changes
    },

    // AFTER each step: report actual token usage
    onStepFinish: async ({ usage }) => {
      // Stream usage to frontend for context indicator
      writer?.write({
        type: 'data-context-usage',
        data: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          usagePercent: ((usage.inputTokens ?? 0) / CONTEXT_LIMIT) * 100,
        },
      })
    },

    // When agent completes
    onFinish: async ({ totalUsage, steps }) => {
      writer?.write({
        type: 'data-total-usage',
        data: {
          totalInputTokens: totalUsage.inputTokens,
          totalOutputTokens: totalUsage.outputTokens,
          stepCount: steps.length,
        },
      })
    },
  })
}
