interface ContextIndicatorProps {
  usagePercent: number
  inputTokens?: number
}

export function ContextIndicator({
  usagePercent,
  inputTokens,
}: ContextIndicatorProps) {
  const getColor = () => {
    if (usagePercent >= 80) return 'bg-red-400'
    if (usagePercent >= 60) return 'bg-amber-400'
    return 'bg-emerald-400'
  }

  const formatTokens = (tokens?: number) => {
    if (!tokens) return '0'
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
    return tokens.toString()
  }

  return (
    <div className="flex items-center gap-2 text-xs text-stone-500">
      <div className="w-16 h-1 bg-stone-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>
      <span className="font-mono tabular-nums">{Math.round(usagePercent)}%</span>
      {inputTokens !== undefined && (
        <span className="text-stone-400">({formatTokens(inputTokens)} in)</span>
      )}
    </div>
  )
}
