import { Hono } from 'hono'
import { createAgent } from '../services/agent'
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  type UIMessage,
} from 'ai'

const chat = new Hono()

chat.post('/', async (c) => {
  const body = await c.req.json()
  // Messages come from client - trust the shape matches UIMessage at runtime
  const messages = (body.messages || []) as UIMessage[]
  const conversationId = body.conversationId as string | undefined

  // Ensure all messages have IDs
  const uiMessages = messages.map((msg, i) => ({
    ...msg,
    id: msg.id || `msg-${i}-${Date.now()}`,
  }))

  // Get authenticated userId and tokens from middleware
  const userId = c.get('userId')
  const convexToken = c.get('convexToken')

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        // Create agent with writer for subagent progress streaming
        const agent = await createAgent(userId, writer, convexToken, conversationId)

        // Convert UI messages to model messages
        const modelMessages = await convertToModelMessages(uiMessages)

        const result = await agent.stream({
          messages: modelMessages,
        })

        // Merge the agent's stream into our stream and wait for completion
        await writer.merge(result.toUIMessageStream())
      } catch (err) {
        console.error('Stream error:', err)
        throw err
      }
    },
  })

  return createUIMessageStreamResponse({ stream })
})

export default chat
