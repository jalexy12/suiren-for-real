import { ChevronDown, Archive } from 'lucide-react'
import { useState } from 'react'

interface SummaryMessageProps {
  summary: string
  messageCount: number
  compactionId?: string
  tokensSaved?: number
  onViewArchive?: (compactionId: string) => void
}

export function SummaryMessage({
  summary,
  messageCount,
  compactionId,
  tokensSaved,
  onViewArchive,
}: SummaryMessageProps) {
  const [expanded, setExpanded] = useState(false)

  const formatTokens = (tokens?: number) => {
    if (!tokens) return '0'
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
    return tokens.toString()
  }

  return (
    <div className="border border-stone-200 rounded-lg bg-stone-50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-stone-100 transition-colors"
      >
        <Archive className="h-4 w-4 text-stone-400 flex-shrink-0" />
        <span className="text-sm text-stone-500 font-serif">
          Conversation compacted
        </span>
        <span className="text-xs text-stone-400 ml-auto">
          {messageCount} messages
        </span>
        <ChevronDown
          className={`h-4 w-4 text-stone-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-stone-200">
          <div className="text-stone-700 font-serif text-sm whitespace-pre-wrap leading-relaxed">
            {summary}
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-stone-400">
            {tokensSaved !== undefined && tokensSaved > 0 && (
              <span>Saved ~{formatTokens(tokensSaved)} tokens</span>
            )}
            {onViewArchive && compactionId && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onViewArchive(compactionId)
                }}
                className="hover:text-stone-600 underline"
              >
                View original messages
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
