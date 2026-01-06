import { LinearClient } from '@linear/sdk'

// Per-user client cache
const clients = new Map<string, LinearClient>()

export function getLinearClient(apiKey: string, userId: string): LinearClient {
  if (!clients.has(userId)) {
    clients.set(userId, new LinearClient({ apiKey }))
  }
  return clients.get(userId)!
}

export function invalidateLinearClient(userId: string): void {
  clients.delete(userId)
}
