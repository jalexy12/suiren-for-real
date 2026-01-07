import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import pino from 'pino'
import handler from './dist/server/server.js'

const isDev = process.env.NODE_ENV !== 'production'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev ? { target: 'pino-pretty' } : undefined,
})

const app = new Hono()

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now()
  const reqId = crypto.randomUUID().slice(0, 8)
  c.set('reqId', reqId)

  logger.info({ reqId, method: c.req.method, path: c.req.path }, 'request started')

  try {
    await next()
    logger.info({
      reqId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration: Date.now() - start
    }, 'request completed')
  } catch (err) {
    logger.error({
      reqId,
      method: c.req.method,
      path: c.req.path,
      duration: Date.now() - start,
      error: serializeError(err)
    }, 'request failed')
    throw err
  }
})

// Global error handler
app.onError((err, c) => {
  const reqId = c.get('reqId') || 'unknown'
  logger.error({ reqId, error: serializeError(err) }, 'unhandled error')

  return c.json({
    error: err.message || 'Internal Server Error',
    code: err.code || err.name || 'UNKNOWN',
    reqId,
    // Include cause chain in non-prod
    ...(isDev && { stack: err.stack, cause: err.cause ? serializeError(err.cause) : undefined })
  }, err.status || 500)
})

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      VITE_CONVEX_URL: process.env.VITE_CONVEX_URL ? 'set' : 'NOT SET',
      VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY ? 'set' : 'NOT SET',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? 'set' : 'NOT SET',
    }
  })
})

// Debug endpoint (only in non-prod or with secret header)
app.get('/debug', (c) => {
  const authHeader = c.req.header('x-debug-key')
  const debugKey = process.env.DEBUG_KEY

  if (process.env.NODE_ENV === 'production' && authHeader !== debugKey) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return c.json({
    env: Object.keys(process.env)
      .filter(k => k.startsWith('VITE_') || k.startsWith('CLERK_') || k.startsWith('CONVEX_') || k === 'NODE_ENV' || k === 'PORT')
      .reduce((acc, k) => {
        acc[k] = k.includes('SECRET') || k.includes('KEY') ? '[REDACTED]' : process.env[k]
        return acc
      }, {}),
    versions: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    }
  })
})

// Serve static assets from dist/client
app.use('/assets/*', serveStatic({ root: './dist/client' }))
app.use('/favicon.ico', serveStatic({ root: './dist/client' }))
app.use('/favicon.png', serveStatic({ root: './dist/client' }))
app.use('/favicon-16x16.png', serveStatic({ root: './dist/client' }))
app.use('/android-chrome-192x192.png', serveStatic({ root: './dist/client' }))
app.use('/android-chrome-512x512.png', serveStatic({ root: './dist/client' }))
app.use('/apple-touch-icon.png', serveStatic({ root: './dist/client' }))
app.use('/site.webmanifest', serveStatic({ root: './dist/client' }))

// Pass all other requests to TanStack Start handler
app.all('*', async (c) => {
  const reqId = c.get('reqId') || 'unknown'
  try {
    const response = await handler.fetch(c.req.raw)
    return response
  } catch (err) {
    logger.error({
      reqId,
      url: c.req.url,
      error: serializeError(err)
    }, 'TanStack handler error')
    throw err
  }
})

function serializeError(err) {
  if (!err) return null
  return {
    message: err.message,
    name: err.name,
    code: err.code,
    status: err.status,
    stack: err.stack,
    cause: err.cause ? serializeError(err.cause) : undefined,
    // Clerk-specific fields
    clerkError: err.clerkError,
    errors: err.errors,
    // Any other enumerable properties
    ...Object.fromEntries(
      Object.entries(err).filter(([k]) => !['message', 'name', 'stack', 'cause'].includes(k))
    )
  }
}

const port = Number(process.env.PORT) || 3000

logger.info({
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  envCheck: {
    VITE_CONVEX_URL: !!process.env.VITE_CONVEX_URL,
    VITE_CLERK_PUBLISHABLE_KEY: !!process.env.VITE_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
  }
}, 'server starting')

serve({ fetch: app.fetch, port })
