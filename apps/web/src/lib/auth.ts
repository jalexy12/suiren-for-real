import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { redirect } from '@tanstack/react-router'

/**
 * Server function to get authenticated user or redirect to sign-in.
 * Use this in route beforeLoad to protect routes.
 */
export const requireAuth = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { userId } = await auth()

    if (!userId) {
      throw redirect({ to: '/sign-in' })
    }

    return { userId }
  }
)

/**
 * Server function to get auth state without redirecting.
 * Returns null userId if not authenticated.
 */
export const getAuthState = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { userId } = await auth()
    return { userId }
  }
)
