import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import handler from './dist/server/server.js'

const app = new Hono()

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
app.all('*', (c) => handler.fetch(c.req.raw))

const port = Number(process.env.PORT) || 3000
console.log(`Server listening on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
