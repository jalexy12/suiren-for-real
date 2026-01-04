import { createFileRoute, useNavigate, Outlet, useMatch } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useAuth } from '@clerk/tanstack-react-start'
import { api } from '../../../../convex/_generated/api'
import { Plus, PanelLeft } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { AppsCanvas } from '~/components/apps-canvas'
import { requireAuth } from '~/lib/auth'

export const Route = createFileRoute('/chat')({
  beforeLoad: () => requireAuth(),
  component: ChatLayout,
})

function ChatLayout() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // userId is guaranteed by beforeLoad, but useAuth returns string | null | undefined
  // Skip queries until we have a userId (should be immediate after auth check)
  const conversations = useQuery(
    api.conversations.list,
    userId ? { userId } : 'skip'
  ) ?? []
  const createConversation = useMutation(api.conversations.create)

  const conversationMatch = useMatch({ from: '/chat/$conversationId', shouldThrow: false })
  const currentConversationId = conversationMatch?.params?.conversationId ?? null

  const handleNewConversation = useCallback(async () => {
    if (!userId) return
    const id = await createConversation({ userId })
    navigate({ to: '/chat/$conversationId', params: { conversationId: id } })
  }, [createConversation, navigate, userId])

  const handleSelectConversation = useCallback((id: string) => {
    navigate({ to: '/chat/$conversationId', params: { conversationId: id } })
  }, [navigate])

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* Left sidebar - conversations */}
      {sidebarOpen && (
        <div className="w-64 h-full flex flex-col border-r border-stone-200 bg-stone-50 shrink-0">
          <div className="p-5 pb-4">
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-2 text-stone-400 hover:text-stone-600 transition-colors font-serif text-sm"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              <span>New conversation</span>
            </button>
          </div>
          <div className="flex-1 overflow-auto px-3">
            <div className="space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv._id}
                  onClick={() => handleSelectConversation(conv._id)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors font-serif text-sm truncate ${
                    conv._id === currentConversationId
                      ? "bg-stone-200/60 text-stone-800"
                      : "text-stone-500 hover:text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {conv.title || formatDistanceToNow(conv.createdAt, { addSuffix: true })}
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="px-3 py-8 text-sm text-stone-300 font-serif text-center">
                  No conversations yet
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Center - chat area */}
      <div className="flex-1 h-full flex flex-col bg-neutral-50 min-w-0">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-stone-200 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <PanelLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </header>

        {currentConversationId ? (
          <Outlet />
        ) : (
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="text-center">
              <p className="text-stone-300 text-2xl font-serif mb-6">
                Start a new conversation
              </p>
              <button
                onClick={handleNewConversation}
                className="text-stone-400 hover:text-stone-600 transition-colors font-serif text-sm border-b border-stone-300 hover:border-stone-500 pb-0.5"
              >
                New conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right - apps panel */}
      <AppsCanvas />
    </div>
  )
}
