import { useState } from 'react'
import { X, Folder, Eye, EyeOff, ExternalLink, File, ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { useQuery as useTanstackQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/tanstack-react-start'
import { api } from '../../../../convex/_generated/api'
import { connectLinear } from '../lib/linear'

const AGENT_URL = import.meta.env.VITE_AGENT_URL || 'http://localhost:3001'

type CanvasTab = 'files' | 'integrations'
type FileLocation = { path: string; isFile: boolean }

interface DirEntry {
  name: string
  isDirectory?: boolean
}

interface AppsCanvasProps {
  onClose: () => void
}

const FilesView = () => {
  const { getToken } = useAuth()
  const [location, setLocation] = useState<FileLocation>({ path: '/home/sui', isFile: false })

  const { data, isLoading, error } = useTanstackQuery({
    queryKey: ['files', location.path, location.isFile],
    queryFn: async () => {
      const token = await getToken()
      const endpoint = location.isFile ? '/files/content' : '/files'
      const res = await fetch(`${AGENT_URL}${endpoint}?path=${encodeURIComponent(location.path)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const handleClick = (entry: DirEntry) => {
    setLocation({
      path: `${location.path}/${entry.name}`,
      isFile: !entry.isDirectory,
    })
  }

  const handleUp = () => {
    const parentPath = location.path.split('/').slice(0, -1).join('/') || '/home/sui'
    setLocation({ path: parentPath, isFile: false })
  }

  const canGoUp = location.path !== '/home/sui' || location.isFile
  const displayPath = location.path.replace('/home/sui', '~')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Path bar */}
      <div className="flex items-center gap-2 mb-4">
        {canGoUp && (
          <button
            onClick={handleUp}
            className="p-1 text-warm-400 hover:text-warm-600 transition-colors rounded hover:bg-warm-200"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}
        <div className="text-xs text-warm-500 font-mono truncate">{displayPath}</div>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-warm-400">Loading...</div>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-warm-400">Error loading files</div>
        </div>
      )}

      {!isLoading && !error && location.isFile && (
        <div className="flex-1 overflow-auto">
          <div className="text-sm text-warm-700 font-mono whitespace-pre-wrap break-all leading-relaxed">
            {data?.content || '(empty)'}
          </div>
        </div>
      )}

      {!isLoading && !error && !location.isFile && (
        <div className="flex-1 overflow-y-auto">
          {(data?.entries || []).length === 0 ? (
            <div className="text-sm text-warm-400 py-4">Empty directory</div>
          ) : (
            <div className="space-y-0.5">
              {(data?.entries || []).map((entry: DirEntry, i: number) => (
                <button
                  key={i}
                  onClick={() => handleClick(entry)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-warm-100 transition-colors group"
                >
                  {entry.isDirectory ? (
                    <Folder className="h-4 w-4 text-warm-400 group-hover:text-sage-500" strokeWidth={1.5} />
                  ) : (
                    <File className="h-4 w-4 text-warm-300" strokeWidth={1.5} />
                  )}
                  <span className="text-sm text-warm-700 font-mono truncate">{entry.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const IntegrationsView = () => {
  const { userId } = useAuth()
  const settings = useQuery(api.userSettings.get, userId ? { userId } : 'skip')
  const removeLinearKey = useMutation(api.userSettings.removeLinearKey)

  const [linearKey, setLinearKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLinearConnected = !!settings?.linearApiKey

  const handleConnectLinear = async () => {
    if (!linearKey.trim()) return

    setSaving(true)
    setError(null)

    try {
      await connectLinear({ data: { apiKey: linearKey } })
      setLinearKey('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!userId) return
    await removeLinearKey({ userId })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Linear Section */}
      <div className="py-5 border-b border-warm-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg text-warm-800 font-display">Linear</span>
            {isLinearConnected && (
              <div className="w-1.5 h-1.5 rounded-full bg-status-success" />
            )}
          </div>
          {isLinearConnected && (
            <button
              onClick={handleDisconnect}
              className="text-xs text-warm-400 hover:text-status-error transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>

        {isLinearConnected ? (
          <div className="text-xs text-warm-500 font-mono">
            Issues · Projects · Teams
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={linearKey}
                onChange={(e) => setLinearKey(e.target.value)}
                placeholder="lin_api_..."
                className="w-full px-3 py-2 text-sm border border-warm-300 rounded-lg focus:outline-none focus:border-sage-500 font-mono pr-10 bg-warm-50"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-status-error">{error}</p>
            )}

            <button
              onClick={handleConnectLinear}
              disabled={!linearKey.trim() || saving}
              className="w-full py-2 text-sm bg-warm-800 text-warm-50 rounded-lg hover:bg-warm-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Connecting...' : 'Connect Linear'}
            </button>

            <a
              href="https://linear.app/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-warm-400 hover:text-warm-600 transition-colors"
            >
              <span>Get API key from Linear</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* Other integrations (coming soon) */}
      <div className="mt-2 space-y-0">
        {[
          { name: 'Google', services: 'Coming soon' },
          { name: 'Notion', services: 'Coming soon' },
        ].map((integration, i) => (
          <div key={i} className="py-5 border-b border-warm-200 opacity-50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg text-warm-800 font-display">{integration.name}</span>
            </div>
            <div className="text-xs text-warm-400 font-mono">{integration.services}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AppsCanvas({ onClose }: AppsCanvasProps) {
  const [activeTab, setActiveTab] = useState<CanvasTab>('files')

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header with tabs and close */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeTab === 'files'
                ? 'bg-sage-100 text-sage-700'
                : 'text-warm-500 hover:text-warm-700 hover:bg-warm-100'
            }`}
          >
            Files
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeTab === 'integrations'
                ? 'bg-sage-100 text-sage-700'
                : 'text-warm-500 hover:text-warm-700 hover:bg-warm-100'
            }`}
          >
            Integrations
          </button>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-warm-400 hover:text-warm-600 transition-colors rounded-lg hover:bg-warm-100"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="flex-1 min-h-0 flex flex-col"
      >
        {activeTab === 'files' ? <FilesView /> : <IntegrationsView />}
      </motion.div>
    </div>
  )
}
