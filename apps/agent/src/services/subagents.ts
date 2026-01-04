import { ToolLoopAgent, stepCountIs, type Tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { MODELS, AGENT_CONFIG } from '../config'

// Subagent step tracking
export interface SubagentStep {
  type: 'tool-call' | 'tool-result' | 'text'
  name?: string
  args?: Record<string, unknown>
  result?: unknown
  timestamp: number
}

export interface SubagentResult {
  success: boolean
  summary: string
  steps: SubagentStep[]
  error?: string
}

// Subagent configurations
const subagentConfigs: Record<string, { instructions: string }> = {
  researcher: {
    instructions: `You are a research assistant. Your job is to:
- Search and explore to find relevant information
- Read and analyze sources thoroughly
- Synthesize findings into a clear, actionable report

Be thorough but concise. When you have enough information, summarize your findings clearly.`,
  },

  planner: {
    instructions: `You are a planning assistant. Your job is to:
- Analyze the task requirements carefully
- Break it into clear, actionable steps
- Consider dependencies and ordering
- Identify potential blockers or questions

Output a structured plan that can be executed.`,
  },

  coder: {
    instructions: `You are a coding assistant. Your job is to:
- Write clean, functional code
- Explain your approach briefly
- Handle edge cases appropriately
- Follow best practices

Be direct and produce working code.`,
  },
}

// Run a subagent with the same tools as main agent
export async function runSubagent(
  agentType: string,
  task: string,
  tools: Record<string, Tool>,
  onStep: (step: SubagentStep) => void
): Promise<SubagentResult> {
  const config = subagentConfigs[agentType]
  if (!config) {
    return {
      success: false,
      summary: `Unknown subagent type: ${agentType}`,
      steps: [],
      error: `Unknown subagent type: ${agentType}`,
    }
  }

  const steps: SubagentStep[] = []

  try {
    const agent = new ToolLoopAgent({
      model: anthropic(MODELS.subagent),
      instructions: config.instructions,
      tools,
      stopWhen: stepCountIs(AGENT_CONFIG.subagentMaxSteps),
      onStepFinish: ({ toolCalls, toolResults }) => {
        // Capture tool calls with their arguments
        for (const tc of toolCalls || []) {
          const step: SubagentStep = {
            type: 'tool-call',
            name: tc.toolName,
            args: 'args' in tc ? (tc.args as Record<string, unknown>) : undefined,
            timestamp: Date.now(),
          }
          steps.push(step)
          onStep(step)
        }
        // Capture tool results
        for (const tr of toolResults || []) {
          const step: SubagentStep = {
            type: 'tool-result',
            name: tr.toolName,
            result: 'output' in tr ? tr.output : undefined,
            timestamp: Date.now(),
          }
          steps.push(step)
          onStep(step)
        }
      },
    })

    const result = await agent.generate({
      prompt: task,
    })

    // Track final text output
    if (result.text) {
      const finalStep: SubagentStep = {
        type: 'text',
        timestamp: Date.now(),
      }
      steps.push(finalStep)
      onStep(finalStep)
    }

    return {
      success: true,
      summary: result.text || 'Task completed',
      steps,
    }
  } catch (error) {
    return {
      success: false,
      summary: 'Subagent encountered an error',
      steps,
      error: String(error),
    }
  }
}
