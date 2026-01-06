import { tool } from 'ai'
import { z } from 'zod'
import type { ConvexHttpClient } from 'convex/browser'
import type { UIMessageStreamWriter } from 'ai'
import { getLinearClient } from './client'
import type { api } from '../../lib/convex'

export const LINEAR_PROMPT = 'You have Linear integration. Use it when users mention tasks, issues, or todos.'

interface LinearContext {
  userId: string
  apiKey: string
  defaultTeamId?: string
  agentProjectId?: string
  convex: ConvexHttpClient
  api: typeof api
  writer?: UIMessageStreamWriter
}

export function createLinearTools(ctx: LinearContext) {
  const { userId, apiKey, defaultTeamId, agentProjectId, convex, api } = ctx
  const client = getLinearClient(apiKey, userId)

  const linear_list_issues = tool({
    description: `List issues from Linear. Returns paginated results.`,
    inputSchema: z.object({
      teamId: z.string().optional().describe('Filter by team ID'),
      projectId: z.string().optional().describe('Filter by project ID'),
      first: z.number().optional().describe('Number of issues to return (default 25)'),
      cursor: z.string().optional().describe('Pagination cursor for next page'),
    }),
    execute: async ({ teamId, projectId, first, cursor }) => {
      try {
        const issues = await client.issues({
          first: first ?? 25,
          after: cursor,
          filter: {
            team: teamId ? { id: { eq: teamId } } : undefined,
            project: projectId ? { id: { eq: projectId } } : undefined,
          },
        })

        return {
          success: true,
          issues: issues.nodes.map((issue) => ({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
          })),
          pagination: {
            hasMore: issues.pageInfo.hasNextPage,
            nextCursor: issues.pageInfo.endCursor,
          },
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  })

  const linear_create_issue = tool({
    description: `Create a new issue in Linear. Priority: 1=Urgent, 2=High, 3=Normal, 4=Low, 0=None`,
    inputSchema: z.object({
      title: z.string().describe('Issue title'),
      description: z.string().optional().describe('Issue description (Markdown)'),
      teamId: z.string().optional().describe('Team ID (uses default if not specified)'),
      projectId: z.string().optional().describe('Project ID'),
      priority: z.number().min(0).max(4).optional().describe('Priority level'),
    }),
    execute: async ({ title, description, teamId, projectId, priority }) => {
      try {
        const resolvedTeamId = teamId ?? defaultTeamId
        if (!resolvedTeamId) {
          // Get first team as fallback
          const teams = await client.teams()
          if (!teams.nodes.length) {
            return { success: false, error: 'No teams available' }
          }
          const fallbackTeamId = teams.nodes[0].id
          const payload = await client.createIssue({
            teamId: fallbackTeamId,
            title,
            description,
            projectId,
            priority,
          })
          const issue = await payload.issue
          if (!issue) {
            return { success: false, error: 'Failed to create issue' }
          }
          return {
            success: true,
            issue: {
              id: issue.id,
              identifier: issue.identifier,
              title: issue.title,
              url: issue.url,
            },
          }
        }

        const payload = await client.createIssue({
          teamId: resolvedTeamId,
          title,
          description,
          projectId,
          priority,
        })
        const issue = await payload.issue
        if (!issue) {
          return { success: false, error: 'Failed to create issue' }
        }
        return {
          success: true,
          issue: {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url,
          },
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  })

  const linear_update_issue = tool({
    description: `Update an existing Linear issue.`,
    inputSchema: z.object({
      issueId: z.string().describe('Issue ID'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      priority: z.number().min(0).max(4).optional().describe('New priority'),
      stateId: z.string().optional().describe('New state/status ID'),
    }),
    execute: async ({ issueId, title, description, priority, stateId }) => {
      try {
        const issue = await client.issue(issueId)
        const payload = await issue.update({
          title,
          description,
          priority,
          stateId,
        })
        const updated = await payload.issue
        if (!updated) {
          return { success: false, error: 'Failed to update issue' }
        }
        return {
          success: true,
          issue: {
            id: updated.id,
            identifier: updated.identifier,
            title: updated.title,
            url: updated.url,
          },
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  })

  const linear_get_context = tool({
    description: `Get Linear workspace context: teams, projects, and workflow states.`,
    inputSchema: z.object({
      includeStates: z.boolean().optional().describe('Include workflow states for each team'),
    }),
    execute: async ({ includeStates }) => {
      try {
        const teams = await client.teams()
        const projects = await client.projects()

        const teamsData = await Promise.all(
          teams.nodes.map(async (team) => {
            const data: { id: string; name: string; key: string; states?: { id: string; name: string; type: string }[] } = {
              id: team.id,
              name: team.name,
              key: team.key,
            }

            if (includeStates) {
              const states = await team.states()
              data.states = states.nodes.map((s) => ({
                id: s.id,
                name: s.name,
                type: s.type,
              }))
            }

            return data
          })
        )

        return {
          success: true,
          teams: teamsData,
          projects: projects.nodes.map((p) => ({
            id: p.id,
            name: p.name,
            state: p.state,
          })),
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  })

  const linear_agent_task = tool({
    description: `Create a task for yourself (Sui) to work on later. Goes to your dedicated "Sui Tasks" project.`,
    inputSchema: z.object({
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task details'),
      priority: z.number().min(0).max(4).optional().describe('Priority level'),
      context: z.string().optional().describe('Conversation context to include'),
    }),
    execute: async ({ title, description, priority, context }) => {
      try {
        if (!agentProjectId || !defaultTeamId) {
          return { success: false, error: 'Agent project not configured. Ask user to reconnect Linear.' }
        }

        const fullDescription = context
          ? `${description || ''}\n\n---\n**Conversation context:**\n${context}`.trim()
          : description

        const payload = await client.createIssue({
          teamId: defaultTeamId,
          projectId: agentProjectId,
          title,
          description: fullDescription,
          priority,
        })
        const issue = await payload.issue
        if (!issue) {
          return { success: false, error: 'Failed to create task' }
        }
        return {
          success: true,
          issue: {
            id: issue.id,
            identifier: issue.identifier,
            url: issue.url,
          },
          message: `Created task ${issue.identifier} in Sui Tasks project`,
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
  })

  return {
    linear_list_issues,
    linear_create_issue,
    linear_update_issue,
    linear_get_context,
    linear_agent_task,
  }
}
