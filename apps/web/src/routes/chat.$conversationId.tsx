import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronDown, ChevronRight, GitBranch } from 'lucide-react'
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
import { Streamdown } from 'streamdown'
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
    <div className="flex items-center gap-2 py-1">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${isComplete ? 'bg-status-success' : 'bg-status-active animate-pulse'}`} />
      <span className="text-sm text-warm-500 font-mono">{tool.name}</span>
      <span className="text-sm text-warm-400">›</span>
      <span className="text-sm text-warm-600 truncate max-w-md font-mono">{tool.input}</span>
    </div>
  )
}

// Tool call group component - groups consecutive tool calls with collapsible header
function ToolCallGroup({ tools }: { tools: ToolPartWithName[] }) {
  const [expanded, setExpanded] = useState(true)
  const allComplete = tools.every(t => t.state === 'output-available')
  const activeCount = tools.filter(t => t.state !== 'output-available').length

  return (
    <div className="my-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-warm-500 hover:text-warm-600 transition-colors w-full text-left py-1"
      >
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${allComplete ? 'bg-status-success' : 'bg-status-active animate-pulse'}`} />
        <span className="font-mono">
          {allComplete
            ? `${tools.length} tool${tools.length > 1 ? 's' : ''} completed`
            : `Running ${activeCount} of ${tools.length} tool${tools.length > 1 ? 's' : ''}...`}
        </span>
        <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${expanded ? '' : '-rotate-90'}`} />
      </button>

      {expanded && (
        <div className="mt-2 pl-3 border-l border-warm-200 space-y-1">
          {tools.map((part, i) => {
            const toolName = getToolName(part)
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
    </div>
  )
}

// Markdown content component using Streamdown
function MarkdownContent({ text, role }: { text: string; role: string }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="text-warm-600 text-lg leading-relaxed bg-warm-100/50 rounded-2xl rounded-tr-sm px-4 py-3">
            {text}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="text-warm-800 text-lg leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h1]:font-medium [&_h2]:font-medium [&_h3]:font-medium [&_h1]:mt-8 [&_h2]:mt-6 [&_h3]:mt-5 [&_h1]:mb-3 [&_h2]:mb-2 [&_h3]:mb-2 [&_h1]:text-warm-700 [&_h2]:text-warm-700 [&_h1]:border-b [&_h1]:border-warm-200 [&_h1]:pb-2 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1.5 [&_li]:pl-1 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:bg-warm-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-warm-100 [&_pre]:border [&_pre]:border-warm-200 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:border-l-2 [&_blockquote]:border-sage-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-warm-600">
      <Streamdown>{text}</Streamdown>
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
          status === 'running' ? 'bg-status-active animate-pulse' :
          status === 'completed' ? 'bg-status-success' : 'bg-status-error'
        }`} />
        <span className="text-sm font-mono text-warm-500">{agentType}</span>
      </div>

      {/* Tool calls - show like main agent tool calls */}
      <div className="space-y-1 pl-3 border-l border-warm-200">
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
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isComplete ? 'bg-status-success' : 'bg-status-active animate-pulse'}`} />
                <span className="text-sm text-warm-500 font-mono">{step.name}</span>
                {args && (
                  <>
                    <span className="text-sm text-warm-400">›</span>
                    <span className="text-sm text-warm-600 truncate max-w-md font-mono">{args}</span>
                  </>
                )}
              </div>
              {resultText && (
                <div className="ml-4 mt-1 text-xs text-warm-500 font-mono bg-warm-100 px-2 py-1 rounded">
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
  const pendingMessageHandled = useRef(false)

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
  const createSubthread = useMutation(api.conversations.createSubthread)
  const detachForkedContext = useMutation(api.conversations.detachForkedContext)
  const navigate = useNavigate()

  // Get thread context for breadcrumbs and forked context info
  const threadContext = useQuery(
    api.conversations.getThreadContext,
    { conversationId: conversationId as Id<'conversations'> }
  )

  // Create transport with auth headers (getToken is called on each request)
  // We send both the regular Clerk token (for agent auth) and the Convex token (for Convex auth)
  const transport = useMemo(() => new DefaultChatTransport({
    api: `${AGENT_URL}/chat`,
    headers: async (): Promise<Record<string, string>> => {
      const [token, convexToken] = await Promise.all([
        getToken(),
        getToken({ template: 'convex' }),
      ])
      if (!token) return {}
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
      if (convexToken) {
        headers['X-Convex-Token'] = convexToken
      }
      return headers
    },
    body: { conversationId },
  }), [getToken, conversationId])

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onError: (error: Error) => {
      console.error('[chat] Error:', error)
    },
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

  // Track which messages are forked context (for filtering display)
  const [forkedContextIds, setForkedContextIds] = useState<Set<string>>(new Set())

  // Load stored messages when conversation changes
  useEffect(() => {
    if (storedMessages) {
      // Filter out detached messages entirely, but keep forked context for agent
      const activeMessages = storedMessages.filter(msg => !msg.isDetached)

      // Track forked context IDs for display filtering
      const forkedIds = new Set<string>()
      activeMessages.forEach(msg => {
        if (msg.isForkedContext) {
          forkedIds.add(`stored-${msg._id}`)
        }
      })
      setForkedContextIds(forkedIds)

      // Build summary metadata map (only for visible messages)
      const metaMap = new Map<string, SummaryMeta>()
      activeMessages.forEach((msg) => {
        if (msg.isSummary && msg.compactionId && !msg.isForkedContext) {
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

      // Convert ALL active messages to UIMessage format (agent needs forked context)
      // Parts are stored with type: string in Convex but UIMessage expects literal types
      // The runtime shapes match, TypeScript just can't verify the literals
      const uiMessages = activeMessages.map((msg) => ({
        id: `stored-${msg._id}`,
        role: msg.role as 'user' | 'assistant',
        parts: msg.parts,
      })) as unknown as UIMessage[]
      setMessages(uiMessages)
    }
  }, [storedMessages, compactionHistory, setMessages])

  // Handle pending message from empty state
  useEffect(() => {
    if (pendingMessageHandled.current) return
    const pendingMessage = sessionStorage.getItem(`pending-message-${conversationId}`)
    if (pendingMessage && storedMessages !== undefined) {
      pendingMessageHandled.current = true
      sessionStorage.removeItem(`pending-message-${conversationId}`)
      // Trigger send after a brief delay to ensure state is ready
      setTimeout(() => {
        handleSendWithMessage(pendingMessage)
      }, 100)
    }
  }, [conversationId, storedMessages])

  const handleSendWithMessage = async (message: string) => {
    const parts = [{ type: 'text', text: message }]

    // Save user message
    await addMessage({
      conversationId: conversationId as Id<'conversations'>,
      role: 'user',
      parts,
    })

    // Generate title for first message
    const isFirstMessage = !storedMessages || storedMessages.length === 0
    if (isFirstMessage) {
      getToken().then(token => {
        if (!token) return
        fetch(`${AGENT_URL}/title`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
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
      })
    }

    // Send to agent
    await sendMessage({ role: 'user', parts: parts as Array<{ type: 'text'; text: string }> })
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const message = input
    setInput('')
    await handleSendWithMessage(message)
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

  // Handler for creating a subthread from a message
  const handleCreateSubthread = async (messageText: string) => {
    // Generate a title from the message (first 50 chars)
    const title = messageText.slice(0, 50) + (messageText.length > 50 ? '...' : '')
    const fullTitle = `Exploring: ${title}`

    try {
      const result = await createSubthread({
        parentConversationId: conversationId as Id<'conversations'>,
        title: fullTitle,
      })

      // Create the thread files in AgentFS
      const token = await getToken()
      if (token && result.threadPath) {
        await fetch(`${AGENT_URL}/files/thread`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ threadPath: result.threadPath, title: fullTitle }),
        })
      }

      // Navigate to the new subthread
      navigate({ to: '/chat/$conversationId', params: { conversationId: result.subthreadId } })
    } catch (error) {
      console.error('Failed to create subthread:', error)
    }
  }

  return (
    <>
      {/* Breadcrumbs - shown when in a subthread */}
      {threadContext?.isSubthread && threadContext.breadcrumbs.length > 1 && (
        <div className="px-12 py-2 border-b border-warm-200 flex items-center gap-1 text-sm">
          {threadContext.breadcrumbs.map((crumb, i) => (
            <span key={crumb._id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-warm-400" />}
              {i < threadContext.breadcrumbs.length - 1 ? (
                <Link
                  to="/chat/$conversationId"
                  params={{ conversationId: crumb._id }}
                  className="text-warm-500 hover:text-warm-700 transition-colors"
                >
                  {crumb.title || 'Chat'}
                </Link>
              ) : (
                <span className="text-warm-700 font-medium">
                  {crumb.title || 'Chat'}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Forked context banner - shown when subthread has parent context */}
      {threadContext && threadContext.forkedContextCount > 0 && (
        <div className="px-12 py-2 border-b border-warm-200 flex items-center gap-3 text-sm bg-warm-100">
          <span className="text-warm-600">
            {threadContext.forkedContextCount} message{threadContext.forkedContextCount !== 1 ? 's' : ''} from parent
          </span>
          <button
            onClick={() => detachForkedContext({ conversationId: conversationId as Id<'conversations'> })}
            className="text-warm-500 hover:text-warm-700 transition-colors text-xs"
          >
            Detach
          </button>
        </div>
      )}

      {/* Context indicator - shown when we have usage data */}
      {contextUsage && (
        <div className="px-12 py-2 border-b border-warm-200">
          <ContextIndicator
            usagePercent={contextUsage.usagePercent}
            inputTokens={contextUsage.inputTokens}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[720px] mx-auto px-12 pt-8 pb-8">
          {messages.length === 0 ? (
            <div className="h-full flex items-center">
              <div className="text-warm-400 text-2xl font-display">
                What do you need?
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.filter(msg => !forkedContextIds.has(msg.id)).map((msg) => {
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

                // Get first text part for subthread title
                const firstTextPart = msg.parts.find(isTextUIPart)
                const messageText = firstTextPart?.text || ''

                // Consolidate consecutive text parts and group consecutive tools
                type ConsolidatedText = { kind: 'text'; text: string }
                type ConsolidatedToolGroup = { kind: 'tool-group'; tools: ToolPartWithName[] }
                const consolidatedParts: Array<ConsolidatedText | ConsolidatedToolGroup> = []
                let currentText = ''
                let currentTools: ToolPartWithName[] = []

                for (const part of msg.parts) {
                  if (isTextUIPart(part)) {
                    // Flush pending tools before adding text
                    if (currentTools.length > 0) {
                      consolidatedParts.push({ kind: 'tool-group', tools: currentTools })
                      currentTools = []
                    }
                    currentText += part.text
                  } else if (isToolPart(part)) {
                    // Flush pending text before adding tool
                    if (currentText) {
                      consolidatedParts.push({ kind: 'text', text: currentText })
                      currentText = ''
                    }
                    currentTools.push(part)
                  }
                }
                // Flush remaining text or tools
                if (currentText) {
                  consolidatedParts.push({ kind: 'text', text: currentText })
                }
                if (currentTools.length > 0) {
                  consolidatedParts.push({ kind: 'tool-group', tools: currentTools })
                }

                return (
                  <div key={msg.id} className="group relative space-y-3">
                    {/* Hover menu for creating subthreads */}
                    {msg.role === 'assistant' && messageText && (
                      <div className="absolute -right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCreateSubthread(messageText)}
                          className="p-1.5 text-warm-400 hover:text-warm-600 hover:bg-warm-100 rounded-lg transition-colors"
                          title="Explore in thread"
                        >
                          <GitBranch className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {/* Interleaved parts - render in order (text consolidated, tools grouped) */}
                    {consolidatedParts.map((cp, i) => {
                      if (cp.kind === 'text') {
                        return <MarkdownContent key={i} text={cp.text} role={msg.role} />
                      }
                      // Separate start_task tools (render as SubagentProgressCard) from regular tools
                      const startTaskTools = cp.tools.filter(t => getToolName(t) === 'start_task')
                      const regularTools = cp.tools.filter(t => {
                        const name = getToolName(t)
                        if (name === 'start_task') return false
                        if (!t.state || t.state === 'input-streaming') return false
                        return true
                      })
                      return (
                        <div key={i}>
                          {/* Render start_task as SubagentProgressCard */}
                          {startTaskTools.map((part, j) => {
                            const output = part.output as { agentType?: string; success?: boolean; steps?: SubagentStep[] } | undefined
                            if (!output?.steps) return null
                            return (
                              <SubagentProgressCard
                                key={`subagent-${j}`}
                                progress={{
                                  taskId: `part-${part.toolCallId}`,
                                  agentType: output.agentType || 'agent',
                                  status: output.success ? 'completed' : 'error',
                                  steps: output.steps,
                                }}
                              />
                            )
                          })}
                          {/* Render regular tools as grouped */}
                          {regularTools.length > 0 && <ToolCallGroup tools={regularTools} />}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              {/* Subagent progress cards */}
              {activeSubagents.map((progress) => (
                <SubagentProgressCard key={progress.taskId} progress={progress} />
              ))}
              {isLoading && activeSubagents.length === 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 bg-warm-400 rounded-full animate-pulse" />
                  <div className="w-1 h-1 bg-warm-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 bg-warm-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-warm-200 bg-warm-50">
        <div className="max-w-[720px] mx-auto px-12 py-6">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything..."
              className="flex-1 bg-transparent border-b border-warm-300 py-3 text-warm-800 placeholder:text-warm-400 focus:outline-none focus:border-sage-500 transition-colors text-lg"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="text-warm-400 hover:text-warm-800 disabled:text-warm-300 transition-colors"
            >
              <ArrowRight className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
