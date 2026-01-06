import { createFileRoute, useNavigate, Outlet, useMatch } from '@tanstack/react-router'
import { useCallback, useState, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useAuth } from '@clerk/tanstack-react-start'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../../../convex/_generated/api'
import { Plus, PanelLeft, ChevronRight, Folder, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { AppsCanvas } from '~/components/apps-canvas'
import { requireAuth } from '~/lib/auth'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/chat')({
  beforeLoad: () => requireAuth(),
  component: ChatLayout,
})

// Sidebar state - only one can be open at a time
type SidebarState = 'none' | 'conversations' | 'canvas'

// Conversation type from Convex
interface Conversation {
  _id: Id<'conversations'>
  title?: string
  parentConversationId?: Id<'conversations'>
  createdAt: number
}

// Tree node for rendering
interface ConversationNode extends Conversation {
  children: ConversationNode[]
}

// Recursive tree item component
function ConversationTreeItem({
  node,
  depth,
  currentId,
  expandedThreads,
  onSelect,
  onToggle,
}: {
  node: ConversationNode
  depth: number
  currentId: string | null
  expandedThreads: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedThreads.has(node._id)
  const isSelected = node._id === currentId
  const isSubthread = depth > 0

  return (
    <div>
      <div
        className="flex items-center gap-1"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => onToggle(node._id)}
            className="p-0.5 text-warm-500 hover:text-warm-700 transition-colors"
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              strokeWidth={2}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          onClick={() => onSelect(node._id)}
          className={`flex-1 text-left px-3 py-2 rounded-lg transition-all duration-150 text-sm truncate ${
            isSelected
              ? 'bg-sage-100 text-sage-700'
              : 'text-warm-600 hover:text-warm-800 hover:bg-warm-200'
          } ${isSubthread ? 'text-xs' : ''}`}
        >
          {isSubthread && <span className="text-warm-400 mr-1">↳</span>}
          {node.title || formatDistanceToNow(node.createdAt, { addSuffix: true })}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <ConversationTreeItem
              key={child._id}
              node={child}
              depth={depth + 1}
              currentId={currentId}
              expandedThreads={expandedThreads}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Empty state with input
function EmptyStateWithInput({
  onSend,
  isLoading,
}: {
  onSend: (message: string) => void
  isLoading: boolean
}) {
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Centered prompt */}
      <div className="flex-1 flex items-center justify-center px-12">
        <h1 className="text-3xl font-display text-warm-400">
          What can I help you with?
        </h1>
      </div>

      {/* Input at bottom */}
      <div className="px-12 pb-10">
        <div className="max-w-[720px] mx-auto">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything..."
              disabled={isLoading}
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
    </div>
  )
}

function ChatLayout() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const [sidebarState, setSidebarState] = useState<SidebarState>('none')
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = useState(false)

  const conversations = useQuery(
    api.conversations.list,
    userId ? { userId } : 'skip'
  ) ?? []
  const createConversation = useMutation(api.conversations.create)

  const conversationMatch = useMatch({ from: '/chat/$conversationId', shouldThrow: false })
  const currentConversationId = conversationMatch?.params?.conversationId ?? null

  // Build tree structure from flat list
  const conversationTree = useMemo(() => {
    const convs = conversations as Conversation[]
    const nodeMap = new Map<string, ConversationNode>()
    const roots: ConversationNode[] = []

    for (const conv of convs) {
      nodeMap.set(conv._id, { ...conv, children: [] })
    }

    for (const conv of convs) {
      const node = nodeMap.get(conv._id)!
      if (conv.parentConversationId) {
        const parent = nodeMap.get(conv.parentConversationId)
        if (parent) {
          parent.children.push(node)
        } else {
          roots.push(node)
        }
      } else {
        roots.push(node)
      }
    }

    return roots
  }, [conversations])

  // Auto-expand thread containing current conversation
  useMemo(() => {
    if (!currentConversationId) return
    const convs = conversations as Conversation[]
    const current = convs.find(c => c._id === currentConversationId)
    if (current?.parentConversationId) {
      setExpandedThreads(prev => new Set([...prev, current.parentConversationId!]))
    }
  }, [currentConversationId, conversations])

  // Toggle sidebar - mutual exclusivity
  const toggleSidebar = useCallback((panel: 'conversations' | 'canvas') => {
    setSidebarState(state => state === panel ? 'none' : panel)
  }, [])

  const handleNewConversation = useCallback(async () => {
    if (!userId) return
    const id = await createConversation({ userId })
    navigate({ to: '/chat/$conversationId', params: { conversationId: id } })
  }, [createConversation, navigate, userId])

  const handleSelectConversation = useCallback((id: string) => {
    navigate({ to: '/chat/$conversationId', params: { conversationId: id } })
  }, [navigate])

  const toggleThread = useCallback((id: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Handle send from empty state - creates conversation and navigates
  const handleSendFromEmpty = useCallback(async (message: string) => {
    if (!userId || isCreating) return
    setIsCreating(true)
    try {
      const id = await createConversation({ userId })
      // Store the message to be sent after navigation
      sessionStorage.setItem(`pending-message-${id}`, message)
      navigate({ to: '/chat/$conversationId', params: { conversationId: id } })
    } finally {
      setIsCreating(false)
    }
  }, [createConversation, navigate, userId, isCreating])

  // Animation variants
  const sidebarVariants = {
    hidden: (direction: 'left' | 'right') => ({
      x: direction === 'left' ? -280 : 400,
      opacity: 0,
    }),
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 400,
        damping: 30,
      },
    },
    exit: (direction: 'left' | 'right') => ({
      x: direction === 'left' ? -280 : 400,
      opacity: 0,
      transition: {
        duration: 0.2,
      },
    }),
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-warm-50">
      {/* Left sidebar - conversations */}
      <AnimatePresence mode="wait">
        {sidebarState === 'conversations' && (
          <motion.div
            custom="left"
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-[280px] h-full flex flex-col border-r border-warm-200 bg-warm-100 shrink-0"
          >
            <div className="flex-1 overflow-auto px-3 pt-16">
              <div className="space-y-0.5">
                {conversationTree.map((node) => (
                  <ConversationTreeItem
                    key={node._id}
                    node={node}
                    depth={0}
                    currentId={currentConversationId}
                    expandedThreads={expandedThreads}
                    onSelect={handleSelectConversation}
                    onToggle={toggleThread}
                  />
                ))}
                {conversationTree.length === 0 && (
                  <p className="px-3 py-8 text-sm text-warm-400 text-center">
                    No conversations yet
                  </p>
                )}
              </div>
            </div>

            {/* New conversation at bottom */}
            <div className="p-4 border-t border-warm-200">
              <button
                onClick={handleNewConversation}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-warm-300 rounded-lg text-warm-500 hover:text-warm-700 hover:border-warm-400 hover:bg-warm-200 transition-all text-sm"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                <span>New conversation</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center - chat area */}
      <div className="flex-1 h-full flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 shrink-0">
          {/* Left: conversations toggle */}
          <button
            onClick={() => toggleSidebar('conversations')}
            className={`p-2 rounded-lg transition-colors ${
              sidebarState === 'conversations'
                ? 'bg-sage-100 text-sage-600'
                : 'text-warm-400 hover:text-warm-600 hover:bg-warm-200'
            }`}
          >
            <PanelLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>

          {/* Right: canvas toggles */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleSidebar('canvas')}
              className={`p-2 rounded-lg transition-colors ${
                sidebarState === 'canvas'
                  ? 'bg-sage-100 text-sage-600'
                  : 'text-warm-400 hover:text-warm-600 hover:bg-warm-200'
              }`}
            >
              <Folder className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* Content */}
        {currentConversationId ? (
          <Outlet />
        ) : (
          <EmptyStateWithInput
            onSend={handleSendFromEmpty}
            isLoading={isCreating}
          />
        )}
      </div>

      {/* Right - canvas panel */}
      <AnimatePresence mode="wait">
        {sidebarState === 'canvas' && (
          <motion.div
            custom="right"
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-[400px] h-full shrink-0 border-l border-warm-200 bg-warm-50"
          >
            <AppsCanvas onClose={() => setSidebarState('none')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
