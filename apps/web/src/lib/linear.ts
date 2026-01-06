import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { LinearClient } from '@linear/sdk'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!)

export const connectLinear = createServerFn({ method: 'POST' })
  .inputValidator((input: { apiKey: string }) => input)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) {
      throw new Error('Unauthorized')
    }

    const { apiKey } = data
    if (!apiKey?.trim()) {
      throw new Error('API key required')
    }

    // Validate key by making a test API call
    const client = new LinearClient({ apiKey })
    await client.viewer

    // Get teams
    const teams = await client.teams()
    const defaultTeam = teams.nodes[0]

    if (!defaultTeam) {
      throw new Error('No teams found in your Linear workspace')
    }

    // Create Sui's project
    const projectPayload = await client.createProject({
      name: 'Sui Tasks',
      description: 'Tasks managed by Sui agent',
      teamIds: [defaultTeam.id],
    })
    const project = await projectPayload.project

    if (!project) {
      throw new Error('Failed to create Sui Tasks project')
    }

    // Save to Convex
    await convex.mutation(api.userSettings.upsert, {
      userId,
      linearApiKey: apiKey,
      linearDefaultTeamId: defaultTeam.id,
      linearAgentProjectId: project.id,
    })

    return { success: true, teamName: defaultTeam.name, projectId: project.id }
  }
)
