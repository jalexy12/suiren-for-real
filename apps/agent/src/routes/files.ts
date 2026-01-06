import { Hono } from 'hono'
import { AgentFS } from 'agentfs-sdk'

const files = new Hono()

// Bootstrap home directory structure
async function ensureHomeDir(agent: Awaited<ReturnType<typeof AgentFS.open>>) {
  const homeDirs = ['/home', '/home/sui', '/home/sui/notes', '/home/sui/skills', '/home/sui/memory', '/home/sui/artifacts', '/home/sui/threads']
  for (const dir of homeDirs) {
    try {
      await agent.fs.mkdir(dir)
    } catch {
      // Directory may already exist
    }
  }
}

// List directory contents
files.get('/', async (c) => {
  const userId = c.get('userId')
  const path = c.req.query('path') || '/home/sui'

  try {
    const agent = await AgentFS.open({ id: userId })
    await ensureHomeDir(agent)
    const rawEntries = await agent.fs.readdirPlus(path)
    const entries = rawEntries.map((e) => ({
      name: e.name,
      isDirectory: e.stats.isDirectory(),
    }))
    return c.json({ path, entries })
  } catch (error) {
    console.error('Files route error:', error)
    return c.json({ error: 'Directory not found', path, details: String(error) }, 404)
  }
})

// Read file content
files.get('/content', async (c) => {
  const userId = c.get('userId')
  const path = c.req.query('path')

  if (!path) {
    return c.json({ error: 'Path query parameter required' }, 400)
  }

  try {
    const agent = await AgentFS.open({ id: userId })
    const content = await agent.fs.readFile(path)
    return c.json({ path, content: content.toString('utf-8') })
  } catch (error) {
    return c.json({ error: 'File not found', path }, 404)
  }
})

// Get file/directory stats
files.get('/stat', async (c) => {
  const userId = c.get('userId')
  const path = c.req.query('path')

  if (!path) {
    return c.json({ error: 'Path query parameter required' }, 400)
  }

  try {
    const agent = await AgentFS.open({ id: userId })
    const stats = await agent.fs.stat(path)
    return c.json({ path, stats })
  } catch (error) {
    return c.json({ error: 'Path not found', path }, 404)
  }
})

// Create thread directory and initial notes file
files.post('/thread', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{ threadPath: string; title: string }>()
  const { threadPath, title } = body

  if (!threadPath || !title) {
    return c.json({ error: 'threadPath and title required' }, 400)
  }

  try {
    const agent = await AgentFS.open({ id: userId })
    await ensureHomeDir(agent)

    // Create the thread directory (parent /home/sui/threads is ensured above)
    try {
      await agent.fs.mkdir(threadPath)
    } catch {
      // Directory may already exist
    }

    // Create the notes file
    const notesPath = `${threadPath}/notes.md`
    const initialContent = `---
summary:
---

# ${title}

Notes will be added here as you explore.
`
    await agent.fs.writeFile(notesPath, initialContent)

    return c.json({ success: true, threadPath, notesPath })
  } catch (error) {
    console.error('[files] Thread creation error:', error)
    return c.json({ error: 'Failed to create thread', details: String(error) }, 500)
  }
})

export default files
