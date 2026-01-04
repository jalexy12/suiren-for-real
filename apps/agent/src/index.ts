import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import chat from './routes/chat'
import health from './routes/health'
import title from './routes/title'
import { authMiddleware } from './middleware/auth'
import { initializeSkills } from './services/agent'

// Initialize skills before starting server
await initializeSkills()

const app = new Hono()

// Allowed origins for CORS
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

// Global middleware
app.use('*', logger())
app.use('*', cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}))

// Public routes (no auth required)
app.route('/health', health)
app.get('/', (c) => c.json({ name: 'suiren-agent', status: 'ok' }))

// Protected routes (auth required)
app.use('/chat/*', authMiddleware)
app.use('/title/*', authMiddleware)
app.route('/chat', chat)
app.route('/title', title)

const port = parseInt(process.env.PORT || '3001')
console.log(`Agent server running on port ${port}`)

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120, // 2 minutes for long-running agent requests
}