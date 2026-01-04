// Centralized configuration - all magic strings go here

export const MODELS = {
  /** Primary model for agent conversations - Claude Sonnet 4.5 */
  agent: 'claude-sonnet-4-5',
  /** Subagent model for delegated tasks - Claude Sonnet 4.5 */
  subagent: 'claude-sonnet-4-5',
  /** Fast model for title generation and lightweight tasks - Claude Haiku 4.5 */
  fast: 'claude-haiku-4-5',
} as const

export const AGENT_CONFIG = {
  /** Max steps for subagent before stopping */
  subagentMaxSteps: 15,
  /** Max web searches per request */
  maxWebSearches: 10,
} as const

export const PATHS = {
  /** Default working directory for user environments */
  userHome: '/home/sui',
} as const
