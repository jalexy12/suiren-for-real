import { z } from 'zod'

// AI SDK v6 UIMessage format
export const UIMessagePartSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
}).passthrough()

export const UIMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(UIMessagePartSchema),
}).passthrough()

export const ChatRequestSchema = z.object({
  messages: z.array(UIMessageSchema),
})
export type ChatRequest = z.infer<typeof ChatRequestSchema>
