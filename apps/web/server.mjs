import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import handler from './dist/server/server.js'

const app = new Hono()

// Health check - shows env status
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    env: {
      VITE_CONVEX_URL: process.env.VITE_CONVEX_URL || 'NOT SET',
      VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY ? process.env.VITE_CLERK_PUBLISHABLE_KEY.substring(0, 20) + '...' : 'NOT SET',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? 'set (starts with ' + process.env.CLERK_SECRET_KEY.substring(0, 10) + '...)' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV || 'not set',
    }
  })
})

// Serve static assets
app.use('/assets/*', serveStatic({ root: './dist/client' }))
app.use('/favicon.ico', serveStatic({ root: './dist/client' }))

// Pass to TanStack Start - LOG EVERYTHING
app.all('*', async (c) => {
  const url = c.req.url
  const method = c.req.method

  console.log(`[REQ] ${method} ${url}`)

  try {
    const response = await handler.fetch(c.req.raw)

    // If it's an error response, clone and log the body
    if (response.status >= 400) {
      const cloned = response.clone()
      let body
      try {
        body = await cloned.text()
      } catch (e) {
        body = '[could not read body]'
      }

      console.error(`[ERR] ${method} ${url} -> ${response.status}`)
      console.error(`[ERR] Response body: ${body}`)
      console.error(`[ERR] Response headers:`, Object.fromEntries(response.headers.entries()))
    } else {
      console.log(`[OK] ${method} ${url} -> ${response.status}`)
    }

    return response
  } catch (err) {
    console.error(`[EXCEPTION] ${method} ${url}`)
    console.error(`[EXCEPTION] Name: ${err.name}`)
    console.error(`[EXCEPTION] Message: ${err.message}`)
    console.error(`[EXCEPTION] Stack: ${err.stack}`)
    if (err.cause) {
      console.error(`[EXCEPTION] Cause: ${JSON.stringify(err.cause, null, 2)}`)
    }

    return c.json({
      error: err.message,
      name: err.name,
      stack: err.stack
    }, 500)
  }
})

const port = Number(process.env.PORT) || 3000
console.log(`[STARTUP] Port: ${port}`)
console.log(`[STARTUP] NODE_ENV: ${process.env.NODE_ENV}`)
console.log(`[STARTUP] VITE_CONVEX_URL: ${process.env.VITE_CONVEX_URL || 'NOT SET'}`)
console.log(`[STARTUP] VITE_CLERK_PUBLISHABLE_KEY: ${process.env.VITE_CLERK_PUBLISHABLE_KEY ? 'SET' : 'NOT SET'}`)
console.log(`[STARTUP] CLERK_SECRET_KEY: ${process.env.CLERK_SECRET_KEY ? 'SET' : 'NOT SET'}`)

serve({ fetch: app.fetch, port })
