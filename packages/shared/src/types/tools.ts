import { z } from 'zod'

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.object({
    type: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
  })),
})
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>

export const AGENTFS_ROOT = '/home/sui'
export const AGENTFS_PATHS = {
  notes: `${AGENTFS_ROOT}/notes`,
  skills: `${AGENTFS_ROOT}/skills`,
  memory: `${AGENTFS_ROOT}/memory`,
  artifacts: `${AGENTFS_ROOT}/artifacts`,
} as const
