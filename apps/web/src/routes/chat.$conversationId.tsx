import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { useAuth } from '@clerk/tanstack-react-start'
import {
  DefaultChatTransport,
  isTextUIPart,
  type DynamicToolUIPart,
  type UIMessage,
} from 'ai'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { ContextIndicator } from '../components/context-indicator'
import { SummaryMessage } from '../components/summary-message'

const AGENT_URL = import.meta.env.VITE_AGENT_URL || 'http://localhost:3001'

// Context usage data from agent
interface ContextUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  usagePercent: number
}

// Tool part with dynamic type (tool-bash, tool-start_task, etc.)
interface ToolPartWithName {
  type: string
  toolCallId?: string
  toolName?: string
  input?: unknown
  output?: unknown
  state?: string
}

// Type guard for tool parts
function isToolPart(part: { type: string }): part is ToolPartWithName {
  return part.type.startsWith('tool-') || part.type === 'dynamic-tool'
}

// Extract tool name from part
function getToolName(part: ToolPartWithName): string {
  if (part.type === 'dynamic-tool' && 'toolName' in part) {
    return (part as DynamicToolUIPart).toolName
  }
  return part.type.replace('tool-', '')
}

// Subagent progress type (matches data payload from server)
interface SubagentStep {
  type: string
  name?: string
  args?: Record<string, unknown>
  result?: unknown
  timestamp: number
}

interface SubagentProgress {
  taskId: string
  agentType: string
  status: 'running' | 'completed' | 'error'
  currentStep?: string
  error?: string
  steps?: SubagentStep[]
}

export const Route = createFileRoute('/chat/$conversationId')({
  component: ChatContent,
})

function ToolCall({ tool }: { tool: { name: string; input: string; state?: string } }) {
  const isComplete = tool.state === 'output-available'

  return (
    <div className="py-1 flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${isComplete ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
      <span className="text-sm text-stone-400 font-mono">{tool.name}</span>
      <span className="text-sm text-stone-300">›</span>
      <span className="text-sm text-stone-500 font-serif">{tool.input}</span>
    </div>
  )
}

// Format args for display - extract the meaningful part
function formatArgs(args?: Record<string, unknown>): string {
  if (!args) return ''
  // For bash, show the command
  if (args.command) return String(args.command)
  // For other tools, show compact JSON
  return JSON.stringify(args)
}

// Format result for display - extract stdout or meaningful content
function formatResult(result?: unknown): string | null {
  if (!result) return null
  if (typeof result === 'object' && result !== null) {
    const r = result as Record<string, unknown>
    // For bash results, show stdout if present
    if (r.stdout && typeof r.stdout === 'string') {
      const stdout = r.stdout.trim()
      if (stdout.length > 100) return stdout.slice(0, 100) + '...'
      return stdout
    }
  }
  const str = typeof result === 'string' ? result : JSON.stringify(result)
  if (str.length > 100) return str.slice(0, 100) + '...'
  return str
}

// Subagent progress display component
function SubagentProgressCard({ progress }: { progress: SubagentProgress }) {
  const { agentType, status, steps = [] } = progress

  // Group tool calls with their results
  const toolSteps = steps.filter(s => s.type === 'tool-call')

  return (
    <div className="my-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-1.5 h-1.5 rounded-full ${
          status === 'running' ? 'bg-amber-400 animate-pulse' :
          status === 'completed' ? 'bg-emerald-400' : 'bg-red-400'
        }`} />
        <span className="text-sm font-mono text-stone-400">{agentType}</span>
      </div>

      {/* Tool calls - show like main agent tool calls */}
      <div className="space-y-1 pl-3 border-l border-stone-200">
        {toolSteps.map((step, i) => {
          const args = formatArgs(step.args)
          // Find corresponding result
          const resultStep = steps.find(s =>
            s.type === 'tool-result' && s.name === step.name && s.timestamp > step.timestamp
          )
          const resultText = formatResult(resultStep?.result)
          const isComplete = !!resultStep

          return (
            <div key={i} className="py-1">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isComplete ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                <span className="text-sm text-stone-400 font-mono">{step.name}</span>
                {args && (
                  <>
                    <span className="text-sm text-stone-300">›</span>
                    <span className="text-sm text-stone-500 font-serif truncate max-w-md">{args}</span>
                  </>
                )}
              </div>
              {resultText && (
                <div className="ml-4 mt-1 text-xs text-stone-400 font-mono bg-stone-100 px-2 py-1 rounded">
                  {resultText}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Summary message metadata (from stored messages)
interface SummaryMeta {
  compactionId: string
  messageCount?: number
  tokensSaved?: number
}

function ChatContent() {
  const { conversationId } = Route.useParams()
  const { getToken } = useAuth()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef(0)
  const [subagentProgress, setSubagentProgress] = useState<Map<string, SubagentProgress>>(new Map())
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null)
  const [summaryMeta, setSummaryMeta] = useState<Map<string, SummaryMeta>>(new Map())
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Fetch auth token on mount and when it changes
  useEffect(() => {
    getToken().then(setAuthToken)
  }, [getToken])

  // Convex queries/mutations
  const storedMessages = useQuery(
    api.conversations.getMessages,
    { conversationId: conversationId as Id<'conversations'> }
  )
  const compactionHistory = useQuery(
    api.compaction.getCompactionHistory,
    { conversationId: conversationId as Id<'conversations'> }
  )
  const addMessage = useMutation(api.conversations.addMessage)
  const updateTitle = useMutation(api.conversations.updateTitle)

  // Create transport with auth headers
  const transport = useMemo(() => new DefaultChatTransport({
    api: `${AGENT_URL}/chat`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  }), [authToken])

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onData: (dataPart: unknown) => {
      const d = dataPart as { type?: string; data?: any }

      // Handle subagent progress updates
      if (d && d.type === 'data-subagent-progress' && d.data?.taskId) {
        setSubagentProgress(prev => {
          const next = new Map(prev)
          next.set(d.data!.taskId, d.data!)
          return next
        })
      }

      // Handle context usage updates (from onStepFinish)
      if (d?.type === 'data-context-usage') {
        setContextUsage(d.data as ContextUsage)
      }

      // Handle compaction events (from prepareStep)
      // TODO: Implement database-side archiving when compaction occurs
      // For now, compaction happens server-side in prepareStep
      if (d?.type === 'data-compaction' && d.data?.occurred) {
        // Compaction occurred - data contains summary and token savings
        // Will be used when implementing persistent compaction
      }
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Load stored messages when conversation changes
  useEffect(() => {
    if (storedMessages) {
      // Build summary metadata map
      const metaMap = new Map<string, SummaryMeta>()
      storedMessages.forEach((msg) => {
        if (msg.isSummary && msg.compactionId) {
          // Find matching archive for message count and tokens saved
          const archive = compactionHistory?.find(a => a.compactionId === msg.compactionId)
          metaMap.set(`stored-${msg._id}`, {
            compactionId: msg.compactionId,
            messageCount: archive?.originalMessages.length,
            tokensSaved: archive?.tokensSaved,
          })
        }
      })
      setSummaryMeta(metaMap)

      // Convert stored messages to UIMessage format
      // Parts are stored with type: string in Convex but UIMessage expects literal types
      // The runtime shapes match, TypeScript just can't verify the literals
      const uiMessages = storedMessages.map((msg) => ({
        id: `stored-${msg._id}`,
        role: msg.role as 'user' | 'assistant',
        parts: msg.parts,
      })) as unknown as UIMessage[]
      setMessages(uiMessages)
    }
  }, [storedMessages, compactionHistory, setMessages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const message = input
    setInput('')

    const parts = [{ type: 'text', text: message }]

    // Save user message
    await addMessage({
      conversationId: conversationId as Id<'conversations'>,
      role: 'user',
      parts,
    })

    // Generate title for first message
    const isFirstMessage = !storedMessages || storedMessages.length === 0
    if (isFirstMessage && authToken) {
      fetch(`${AGENT_URL}/title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ message }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.title) {
            updateTitle({
              conversationId: conversationId as Id<'conversations'>,
              title: data.title,
            })
          }
        })
        .catch(() => {
          // Title generation is non-critical, silently ignore failures
        })
    }

    // Send to agent
    await sendMessage({ role: 'user', parts: parts as Array<{ type: 'text'; text: string }> })
  }

  // Save assistant response when streaming completes
  useEffect(() => {
    if (status === 'ready' && conversationId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant' && !lastMessage.id.startsWith('stored-')) {
        if (lastMessage.parts.length > 0) {
          // Cast parts for Convex storage - shapes are compatible at runtime
          const partsForStorage = lastMessage.parts.map(part => ({
            type: part.type,
            ...('text' in part && { text: part.text }),
            ...('toolCallId' in part && { toolCallId: part.toolCallId }),
            ...('toolName' in part && { toolName: part.toolName }),
            ...('input' in part && { input: part.input }),
            ...('output' in part && { output: part.output }),
            ...('state' in part && { state: part.state }),
          }))
          addMessage({
            conversationId: conversationId as Id<'conversations'>,
            role: 'assistant',
            parts: partsForStorage,
          })
        }
      }
    }
  }, [status, messages, conversationId, addMessage])

  // Scroll only when new messages are added
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length])

  // Get active subagents for display
  const activeSubagents = Array.from(subagentProgress.values())

  return (
    <>
      {/* Context indicator - shown when we have usage data */}
      {contextUsage && (
        <div className="px-8 py-2 border-b border-stone-100">
          <ContextIndicator
            usagePercent={contextUsage.usagePercent}
            inputTokens={contextUsage.inputTokens}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-8 pt-8 pb-8">
        {messages.length === 0 ? (
          <div className="h-full flex items-center">
            <div className="text-stone-300 text-2xl font-serif">
              What do you need?
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => {
              // Check if this is a summary message
              const meta = summaryMeta.get(msg.id)
              if (meta) {
                const summaryText = msg.parts
                  .filter(isTextUIPart)
                  .map(p => p.text)
                  .join('\n')
                return (
                  <SummaryMessage
                    key={msg.id}
                    summary={summaryText}
                    messageCount={meta.messageCount || 0}
                    compactionId={meta.compactionId}
                    tokensSaved={meta.tokensSaved}
                  />
                )
              }

              return (
                <div key={msg.id}>
                  {/* Tool calls */}
                  {msg.role === 'assistant' && msg.parts.filter(p => isToolPart(p)).length > 0 && (
                    <div>
                      {msg.parts.map((part, i) => {
                        if (!isToolPart(part)) return null

                        const toolName = getToolName(part)

                        // Render start_task with output as subagent cards
                        if (toolName === 'start_task') {
                          const output = part.output as { agentType?: string; success?: boolean; steps?: SubagentStep[] } | undefined
                          if (output?.steps) {
                            return (
                              <SubagentProgressCard
                                key={i}
                                progress={{
                                  taskId: `stored-${i}`,
                                  agentType: output.agentType || 'agent',
                                  status: output.success ? 'completed' : 'error',
                                  steps: output.steps,
                                }}
                              />
                            )
                          }
                          // Skip start_task without output (streaming state)
                          return null
                        }

                        // Skip tool parts without proper state (intermediate streaming states)
                        if (!part.state || part.state === 'input-streaming') {
                          return null
                        }

                        return (
                          <ToolCall
                            key={i}
                            tool={{
                              name: toolName,
                              input: JSON.stringify(part.input || ''),
                              state: part.state,
                            }}
                          />
                        )
                      })}
                    </div>
                  )}
                  {/* Text content */}
                  {msg.parts.filter(isTextUIPart).map((part, i) => (
                    <div
                      key={i}
                      className={`${msg.role === 'user' ? 'text-stone-500' : 'text-stone-800'} font-serif`}
                      style={{
                        fontSize: msg.role === 'user' ? '1rem' : '1.25rem',
                        lineHeight: '1.7',
                      }}
                    >
                      {part.text}
                    </div>
                  ))}
                </div>
              )
            })}
            {/* Subagent progress cards */}
            {activeSubagents.map((progress) => (
              <SubagentProgressCard key={progress.taskId} progress={progress} />
            ))}
            {isLoading && activeSubagents.length === 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 bg-stone-300 rounded-full animate-pulse" />
                <div className="w-1 h-1 bg-stone-300 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-1 bg-stone-300 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-8 pb-10">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything"
            className="flex-1 bg-transparent border-b border-stone-200 py-3 text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors text-lg font-serif"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="text-stone-400 hover:text-stone-800 disabled:text-stone-200 transition-colors"
          >
            <ArrowRight className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </>
  )
}
