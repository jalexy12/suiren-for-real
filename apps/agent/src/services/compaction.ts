import { generateText, type ModelMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { MODELS } from '../config'

const CONTEXT_LIMIT = 200000 // Claude Sonnet context window
const COMPACTION_THRESHOLD = 0.05 // 5% for testing (normally 0.8 = 80%)
const KEEP_RECENT_MESSAGES = 10

export interface CompactionEvent {
  occurred: boolean
  summary?: string
  messageCount?: number
  tokensBefore?: number
  tokensAfter?: number
}

export interface CompactionResult {
  compacted: boolean
  messages: ModelMessage[]
  summary?: string
  tokensBefore?: number
  tokensAfter?: number
  messageCount?: number
}

interface StepWithUsage {
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

/**
 * Calculate cumulative token usage from previous steps
 * Uses REAL token counts from the API, not estimation
 */
export function getCumulativeUsage(steps: StepWithUsage[]): number {
  return steps.reduce((total, step) => {
    return total + (step.usage?.inputTokens ?? 0) + (step.usage?.outputTokens ?? 0)
  }, 0)
}

/**
 * Check if compaction is needed and perform it if so
 * Called from prepareStep callback
 */
export async function prepareCompaction(
  messages: ModelMessage[],
  steps: StepWithUsage[],
  forceCompact: boolean = false
): Promise<CompactionResult> {
  // Get actual usage from previous steps
  const cumulativeUsage = getCumulativeUsage(steps)
  const usagePercent = cumulativeUsage / CONTEXT_LIMIT

  // Check threshold (or force compact)
  if (!forceCompact && usagePercent < COMPACTION_THRESHOLD) {
    return { compacted: false, messages }
  }

  // Determine messages to compact (keep recent)
  const keepCount = Math.min(KEEP_RECENT_MESSAGES, Math.floor(messages.length / 3))
  if (messages.length - keepCount < 3) {
    return { compacted: false, messages }
  }

  const toCompact = messages.slice(0, -keepCount)
  const toKeep = messages.slice(-keepCount)

  // Generate summary using a separate LLM call
  const summary = await generateSummary(toCompact)

  // Build compacted message array
  const compactedMessages: ModelMessage[] = [
    {
      role: 'assistant',
      content: summary,
    },
    ...toKeep,
  ]

  return {
    compacted: true,
    messages: compactedMessages,
    summary,
    tokensBefore: cumulativeUsage,
    messageCount: toCompact.length,
  }
}

async function generateSummary(messages: ModelMessage[]): Promise<string> {
  const conversationText = messages
    .map((m: ModelMessage) => {
      const role = m.role.toUpperCase()
      const content = m.content
      // Handle string content directly
      if (typeof content === 'string') {
        return `${role}: ${content}`
      }
      // Handle array content
      if (Array.isArray(content)) {
        const text = content
          .filter((p): p is { type: 'text'; text: string } =>
            typeof p === 'object' && p !== null && 'type' in p && p.type === 'text'
          )
          .map((p) => p.text)
          .join('\n')
        return `${role}: ${text}`
      }
      return `${role}: [unknown content]`
    })
    .join('\n\n')

  const { text } = await generateText({
    model: anthropic(MODELS.fast),
    system: `Summarize this conversation concisely. Preserve:
- Key facts and decisions made
- Ongoing tasks or commitments
- User preferences mentioned
- Files/artifacts created

Format: 2-3 sentence overview, then bullet points for key items.`,
    prompt: conversationText,
    maxOutputTokens: 800,
  })

  return `**[Conversation Summary]**\n${text}`
}

/**
 * Check if a message is a /compact command
 */
export function isCompactCommand(message: ModelMessage): boolean {
  if (message.role !== 'user') return false
  const content = message.content
  // Handle string content
  if (typeof content === 'string') {
    return content.trim() === '/compact'
  }
  // Handle array content
  if (Array.isArray(content)) {
    return content.some((p) =>
      typeof p === 'object' && p !== null && 'type' in p && p.type === 'text' && 'text' in p && (p.text as string)?.trim() === '/compact'
    )
  }
  return false
}
