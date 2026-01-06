import { ToolLoopAgent, tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { Bash } from 'just-bash'
import { agentfs } from 'agentfs-sdk/just-bash'
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
import { createLinearTools, LINEAR_PROMPT } from '../integrations/linear'

const CONTEXT_LIMIT = 200000 // Claude Sonnet context window

// Tool search for deferred loading - reduces initial token overhead
const toolSearchTool = anthropic.tools.toolSearchBm25_20251119()

// Anthropic built-in tools (will be deferred)
const webSearchTool = anthropic.tools.webSearch_20250305({
  maxUses: AGENT_CONFIG.maxWebSearches,
})

const webFetchTool = anthropic.tools.webFetch_20250910()

const codeExecutionTool = anthropic.tools.codeExecution_20250825()

// Store per-user bash environments (with persistent AgentFS backing)
const userEnvs = new Map<string, Bash>()
// Store per-user AgentFS instances for direct file operations
const userFilesystems = new Map<string, Awaited<ReturnType<typeof agentfs>>>()
// Track which users have been bootstrapped
const bootstrappedUsers = new Set<string>()

// Global skill registry (loaded once at startup)
let skillRegistry: SkillRegistry | null = null

// Initialize skills from filesystem (call once at app startup)
export async function initializeSkills(): Promise<void> {
  const skillsDir = join(import.meta.dir, '../../skills')
  skillRegistry = await loadSkills(skillsDir)
}

async function getOrCreateEnv(userId: string): Promise<{ bash: Bash; fs: Awaited<ReturnType<typeof agentfs>> }> {
  if (!userEnvs.has(userId)) {
    // Create AgentFS-backed filesystem for this user
    const fs = await agentfs({ id: userId })
    const bash = new Bash({ fs, cwd: PATHS.userHome })

    // Bootstrap skills and home directory on first access
    if (!bootstrappedUsers.has(userId)) {
      // Create home directory marker
      try {
        await fs.writeFile(`${PATHS.userHome}/.suirc`, '# Sui home directory\n')
      } catch {
        // File may already exist
      }

      // Bootstrap skills into AgentFS
      const skillFiles = skillRegistry?.files ?? {}
      for (const [path, content] of Object.entries(skillFiles)) {
        try {
          await fs.writeFile(path, content)
        } catch {
          // Skill file may already exist
        }
      }
      bootstrappedUsers.add(userId)
    }

    userEnvs.set(userId, bash)
    userFilesystems.set(userId, fs)
  }
  return { bash: userEnvs.get(userId)!, fs: userFilesystems.get(userId)! }
}

export async function getEnv(userId: string): Promise<Bash> {
  const { bash } = await getOrCreateEnv(userId)
  return bash
}

export async function createAgent(userId: string, writer?: UIMessageStreamWriter, convexToken?: string, conversationId?: string) {
  const { bash: env } = await getOrCreateEnv(userId)

  // Set Convex auth if token provided (requires JWT template "convex" in Clerk)
  if (convexToken) {
    convex.setAuth(convexToken)
  } else {
    convex.clearAuth()
  }

  // Check user settings for integrations
  const userSettings = await convex.query(api.userSettings.get, { userId })

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

  // Create subthread tool - for interactive exploration
  const createSubthreadTool = tool({
    description: `Create a subthread for focused exploration or research. The subthread gets its own conversation where the user can explore a topic interactively.

Use this when:
- The user wants to explore a tangent without losing the main thread
- A topic deserves deeper investigation that might derail the conversation
- You want to suggest the user explore something in more depth

The subthread inherits the current conversation context. The user will navigate to it to continue exploring.`,
    inputSchema: z.object({
      title: z.string().describe('Short descriptive title for the thread (e.g., "Market Research", "Pricing Analysis")'),
    }),
    execute: async ({ title }: { title: string }) => {
      if (!conversationId) {
        return { success: false, error: 'No conversation context available' }
      }

      try {
        const result = await convex.mutation(api.conversations.createSubthread, {
          parentConversationId: conversationId as any, // Convex ID type
          title,
        })

        // Create the notes file in the virtual filesystem
        const notesPath = `${result.threadPath}/notes.md`
        const initialContent = `---
summary:
---

# ${title}

Notes will be added here as you explore.
`
        // Create directory and write file
        await env.exec(`mkdir -p ${result.threadPath}`)
        await env.exec(`cat > ${notesPath} << 'SUIREN_EOF'
${initialContent}
SUIREN_EOF`)

        return {
          success: true,
          subthreadId: result.subthreadId,
          threadPath: result.threadPath,
          notesFile: notesPath,
          message: `Created subthread "${title}". The user can navigate to it to explore this topic.`,
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  })

  // Build base tools
  const tools: Record<string, any> = {
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
    create_subthread: {
      ...createSubthreadTool,
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
  }

  // Build instructions
  let instructions = `You are Sui, an intelligent assistant that helps users manage their life.

You have a bash environment (your home is ${PATHS.userHome}) for files, notes, and commands.

Use tool_search to discover additional capabilities when needed - web search, code execution, subagents, scheduling, and more.

Be concise. Don't over-explain unless asked.
${skillsPrompt}`

  // Conditionally load Linear integration
  if (userSettings?.linearApiKey) {
    const linearTools = createLinearTools({
      userId,
      apiKey: userSettings.linearApiKey,
      defaultTeamId: userSettings.linearDefaultTeamId,
      agentProjectId: userSettings.linearAgentProjectId,
      convex,
      api,
      writer,
    })

    // Add Linear tools with same structure as other deferred tools
    tools.linear_list_issues = {
      ...linearTools.linear_list_issues,
      providerOptions: { anthropic: { deferLoading: true } },
    }
    tools.linear_create_issue = {
      ...linearTools.linear_create_issue,
      providerOptions: { anthropic: { deferLoading: true } },
    }
    tools.linear_update_issue = {
      ...linearTools.linear_update_issue,
      providerOptions: { anthropic: { deferLoading: true } },
    }
    tools.linear_get_context = {
      ...linearTools.linear_get_context,
      providerOptions: { anthropic: { deferLoading: true } },
    }
    tools.linear_agent_task = {
      ...linearTools.linear_agent_task,
      providerOptions: { anthropic: { deferLoading: true } },
    }

    instructions += '\n' + LINEAR_PROMPT
  }

  // Add subthread context if this is a subthread
  if (conversationId) {
    try {
      const threadContext = await convex.query(api.conversations.getThreadContext, {
        conversationId: conversationId as any,
      })

      if (threadContext?.isSubthread && threadContext.threadPath) {
        instructions += `

## Subthread Context
You are in a subthread. The messages in context include the parent conversation for reference.
Write your findings and notes to: ${threadContext.threadPath}/notes.md
Use YAML front matter with a "summary" field for the key takeaway. Update as you work.`
      }
    } catch {
      // Not a valid conversation ID or not a subthread - continue without subthread context
    }
  }

  return new ToolLoopAgent({
    model: anthropic(MODELS.agent),
    instructions,
    tools,

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
