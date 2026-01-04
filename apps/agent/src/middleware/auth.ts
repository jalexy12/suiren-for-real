import { createMiddleware } from 'hono/factory'
import { verifyToken } from '@clerk/backend'

declare module 'hono' {
  interface ContextVariableMap {
    userId: string
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })

    if (!payload.sub) {
      return c.json({ error: 'Invalid token: no subject' }, 401)
    }

    c.set('userId', payload.sub)
    await next()
  } catch (error) {
    console.error('Auth error:', error)
    return c.json({ error: 'Invalid token' }, 401)
  }
})
