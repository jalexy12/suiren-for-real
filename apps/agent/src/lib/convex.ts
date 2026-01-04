import { ConvexHttpClient } from "convex/browser"
import { api } from "../../../../convex/_generated/api"

const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL

if (!convexUrl) {
  throw new Error("CONVEX_URL environment variable is required")
}

export const convex = new ConvexHttpClient(convexUrl)
export { api }
