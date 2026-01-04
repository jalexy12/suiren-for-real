import { Hono } from 'hono'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { MODELS } from '../config'

const title = new Hono()

title.post('/', async (c) => {
  const { message } = await c.req.json()

  if (!message || typeof message !== 'string') {
    return c.json({ error: 'Message required' }, 400)
  }

  const result = await generateText({
    model: anthropic(MODELS.fast),
    system: 'Generate a brief, descriptive title (3-6 words) for a conversation. Return ONLY the title, no quotes or extra punctuation.',
    prompt: message,
  })

  return c.json({ title: result.text.trim() })
})

export default title
