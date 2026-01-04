# Suiren

## Overview

Suiren is an intelligent agent platform. The agent, Sui, manages your life by connecting your calendar, tasks, notes, email, reminders, and other services into a unified, conversational interface.

The core insight: most personal productivity tools are fragmented. Calendar is separate from tasks is separate from notes is separate from email. Sui acts as the connective tissue—a single agent that understands your entire context and can operate across all of them.

Unlike chatbots with bolted-on plugins and ephemeral memory, Sui compounds context over time. It's not a tool you use—it's an operating layer that learns how you work.

---

## Product Philosophy

### Chat-First, UI When You Feel Friction

The primary interface is conversational. Users talk to Sui:

- "What's tomorrow look like?"
- "Remind me to call Sarah at 3pm"
- "Add milk to my grocery list"
- "When am I free this week?"

UI components (calendar view, task list, notes browser) exist but are secondary. They emerge when the conversation needs them—a canvas that appears alongside the chat showing relevant context. The agent can invoke these views, or the user can browse them directly.

The principle: build the agent functionality first, UI later. If users keep asking for a visual way to see something, that's when we build it.

### The Agent Has a Home

Sui is not a stateless chatbot. Each user's agent has persistent state:

- A filesystem for organization (notes, documents, artifacts)
- Memory of past conversations and preferences
- An audit log of every action taken

This state constitutes the agent's "home"—a portable, queryable record of everything the agent knows and has done. It's implemented as a SQLite database that can be snapshotted, restored, and inspected.

### Connect When Needed

Users don't connect external services upfront. They connect when they first need them.

Day one, without connecting anything, Sui can:
- Take and search notes (AgentFS)
- Manage the filesystem (AgentFS)
- Search the web
- Fetch and read web pages
- Have conversations, think through problems

When a user tries to use a capability that requires a connection (e.g., "What's on my calendar?"), both the agent and the canvas surface the connection flow. The agent explains and offers to connect; the canvas shows an empty state with a connect CTA.

### Mini-Apps as Capabilities

Functionality is organized into "mini-apps"—discrete capabilities like Calendar, Tasks, Notes, Reminders, Email. Each mini-app consists of:

- A schema (data structure in Convex)
- Tools (functions the agent can call)
- Skills (SKILL.md files that teach Sui workflows and patterns for the domain)
- UI components (optional, built when needed)

Skills augment tools. Tools define *what* Sui can do; skills teach *how* to do it well. A Calendar skill might encode patterns like "when scheduling a meeting, check for conflicts first" or "morning meetings should have 15-minute buffers." Skills use progressive disclosure—only the name and description load at startup; full content loads when relevant.

Mini-apps are the building blocks. The agent orchestrates them based on user intent.

---

## Architecture

### High-Level Stack

```
┌─────────────────────────────────────────────────────────┐
│  TanStack Start                                          │
│  - UI (React)                                            │
│  - SSR/routing                                           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Fly.io                                                  │
│  - Bun runtime                                           │
│  - Hono server                                           │
│  - Agent endpoints                                       │
│  - SSE streaming                                         │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│   AgentFS     │           │    Convex     │
│   (Turso)     │           │               │
│               │           │  - Calendar   │
│  - Files      │           │  - Tasks      │
│  - KV state   │           │  - Notes      │
│  - Memory     │           │  - Reminders  │
│  - Audit log  │           │  - Real-time  │
└───────────────┘           └───────────────┘
        │
        │
┌───────▼───────┐
│    Clerk      │
│  - Auth       │
│  - User mgmt  │
└───────────────┘
```

### Component Responsibilities

**TanStack Start**

The frontend framework. Handles:

- Server-side rendering
- Client-side routing
- React components for the chat interface and mini-app UIs
- Real-time subscriptions to Convex

**Fly.io (Bun + Hono)**

The compute layer. Stateless application servers that:

- Receive chat requests
- Execute the agent loop (call Claude, run tools, stream responses)
- Stream responses back to the client via SSE
- Read/write to AgentFS and Convex

The Fly machines are a shared pool, not per-user. Any machine can serve any user because all state is external. Auto-scales based on demand.

**AgentFS (Turso)**

The agent's persistent home. Each user has their own AgentFS database—a SQLite file hosted on Turso. Contains:

- **Virtual filesystem**: POSIX-like file and directory operations. The agent can create, read, update, delete files. Used for notes, documents, artifacts, any unstructured data.
- **KV store**: Fast key-value storage for agent state, preferences, context.
- **Tool call audit log**: Append-only record of every tool the agent has invoked. Used for debugging, observability, and compliance.

AgentFS provides:

- Portability: the entire agent state is a single SQLite file
- Queryability: inspect agent behavior with SQL
- Snapshots: copy the database to create a restore point

**Convex**

The structured data layer for user-facing information that needs real-time sync to the UI:

- Calendar events
- Tasks and to-dos
- Notes metadata (the content may live in AgentFS, but the index lives here)
- Reminders

Convex is chosen because:

- Real-time subscriptions are native (UI updates instantly when data changes)
- TypeScript-first schemas
- Handles the "live" data that the UI needs to render

**Clerk**

Authentication and user management. Handles:

- Sign up / sign in flows
- Session management
- User metadata

### Data Model

**AgentFS (per user)**

```
/home/sui/
├── notes/
│   ├── 2025-01-03-meeting-notes.md
│   ├── project-ideas.md
│   └── reading-list.md
├── skills/
│   ├── calendar/
│   │   └── SKILL.md
│   ├── tasks/
│   │   └── SKILL.md
│   └── notes/
│       └── SKILL.md
├── memory/
│   ├── preferences.json
│   └── context.json
└── artifacts/
    └── generated-report.pdf
```

Plus KV store:

```
user:preferences -> { theme: "dark", timezone: "America/New_York" }
agent:context -> { current_focus: "work", recent_topics: [...] }
```

Plus audit log (append-only):

```
| timestamp | tool_name | input | output | duration_ms |
|-----------|-----------|-------|--------|-------------|
| ...       | calendar  | {...} | {...}  | 120         |
| ...       | web_search| {...} | {...}  | 450         |
```

**Convex (per user)**

Tables:

- `calendar_events`: id, userId, title, start, end, location, description, source
- `tasks`: id, userId, title, completed, dueDate, priority, list
- `reminders`: id, userId, message, triggerAt, recurring, completed
- `notes`: id, userId, title, path (reference to AgentFS file), createdAt, updatedAt

### Data Isolation

Each user has:

- Their own AgentFS database in Turso (separate SQLite file)
- Their own records in Convex (filtered by userId)
- Their own Clerk user record

The Fly machines are shared, but they authenticate each request via Clerk and route to the appropriate user's data.

---

## Agent Design

### The Agent Loop

When a user sends a message:

```
1. Request arrives at Fly (Hono endpoint)
2. Authenticate via Clerk, get userId
3. Load agent context from AgentFS (recent memory, preferences)
4. Construct system prompt with available tools
5. Call Claude via AI SDK
6. Stream response tokens back to client via SSE
7. If Claude invokes a tool:
   a. Execute the tool (may read/write AgentFS or Convex)
   b. Log the tool call to AgentFS audit log
   c. Return result to Claude
   d. Continue streaming
8. When complete, persist any memory updates to AgentFS
```

**Future: Proactive Agent**

V1 is reactive—Sui responds to user messages. In the future, Sui will be able to set reminders for itself, allowing it to wake up and take action without user prompting (e.g., "check in tomorrow if I haven't finished this task").

### Tool Execution

Tools are functions the agent can call. Each tool has:

- A name and description (for Claude to understand when to use it)
- A schema (parameters it accepts)
- An implementation (what it actually does)

**Built-in Tools**

Sui uses Anthropic's built-in tools where available:
- `web_search`: Search the web for current information
- `web_fetch`: Fetch and read web page content

These require no implementation—they're native Claude capabilities.

**Tool Search**

As the tool library grows, we use the tool search tool to avoid loading all definitions into context. Tools marked with `defer_loading: true` are discoverable but don't consume context until needed. Claude searches the tool catalog and loads only what's relevant for the current task.

This keeps context efficient and maintains tool selection accuracy as we scale beyond 30+ tools.

**Compaction**

For long-running tasks, we implement compaction: when context approaches the limit, the agent summarizes conversation history and replaces the full history with the summary. This lets Sui work on extended tasks without losing coherence.

**Custom Tools**

Example tool: `create_note`

```typescript
{
  name: "create_note",
  description: "Create a new note with the given title and content",
  parameters: {
    title: { type: "string", description: "The note title" },
    content: { type: "string", description: "The note content in markdown" }
  },
  execute: async ({ title, content }, { agentFs, convex, userId }) => {
    // Write file to AgentFS
    const path = `/home/sui/notes/${slugify(title)}.md`;
    await agentFs.fs.writeFile(path, content);

    return { success: true, path };
  }
}
```

### Memory and Context

The agent maintains memory at multiple levels:

**Conversation context**: The current conversation is held in the message array passed to Claude. No special handling needed.

**Long-term memory**: Notes, documents, historical context. Stored in AgentFS filesystem. Queried when relevant (e.g., user asks "what did I write about X?").

**Structured data**: Calendar, tasks, reminders. Stored in Convex. Queried by tools when needed.

### Streaming

Responses stream via Server-Sent Events (SSE). The AI SDK handles this natively:

```typescript
import { streamText } from 'ai';

app.post('/chat', async (c) => {
  const { messages } = await c.req.json();
  
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages,
    tools,
  });
  
  return result.toDataStreamResponse();
});
```

The client receives tokens as they're generated, providing immediate feedback.

---

## V1 Capabilities

### Memory (Filesystem)

Table stakes. The agent can:

- Create, read, update, delete files in its filesystem
- Organize files into directories
- Search file contents
- Remember preferences and context

This is implemented via AgentFS.

### Calendar

The agent can:

- View upcoming events ("What's on my calendar tomorrow?")
- Create events ("Schedule a meeting with Sarah at 2pm")
- Update events ("Move my 3pm to 4pm")
- Delete events ("Cancel my dentist appointment")

Integration: MCP server for Google Calendar or direct API integration (TBD).

Data: Events synced to Convex for real-time UI display.

### Tasks

The agent can:

- Create tasks ("Add 'buy groceries' to my to-do list")
- List tasks ("What do I need to do today?")
- Complete tasks ("Mark 'send invoice' as done")
- Organize tasks by list, priority, due date

Data: Stored in Convex.

### Notes

The agent can:

- Create notes ("Take a note: meeting discussed Q1 roadmap...")
- Read notes ("What did I write about the project?")
- Search notes ("Find my notes mentioning budget")
- Update notes ("Add to my reading list: [book title]")

Data: Content in AgentFS filesystem, metadata/index in Convex.

### Reminders

The agent can:

- Set reminders ("Remind me to call mom at 5pm")
- List pending reminders
- Clear reminders

Implementation: Stored in Convex. Background job (cron or queue) checks for due reminders and triggers notifications.

### Web Search & Fetch

Built-in Anthropic tools. No implementation required:
- `web_search`: Search the web for current information
- `web_fetch`: Fetch and read full web page content

These work without any external connections.

### Email

The agent can:

- Read recent emails ("Any important emails today?")
- Summarize email threads
- Draft replies ("Draft a response to Sarah's email")
- Send emails (with user confirmation)

Integration: MCP server for Gmail or direct API integration (TBD).

---

## UI Design

### Layout

The interface has two panels:

```
┌────────────────────────┬────────────────────────┐
│                        │                        │
│                        │                        │
│      Chat Panel        │      Canvas Panel      │
│                        │                        │
│  - Message history     │  - Mini-app UIs        │
│  - Input field         │  - Calendar view       │
│  - Streaming response  │  - Task list           │
│                        │  - Note viewer         │
│                        │                        │
└────────────────────────┴────────────────────────┘
```

The chat panel is always visible. The canvas panel shows contextually relevant UI components—either invoked by the agent or selected by the user.

### Canvas Components

Each mini-app can render a canvas component:

- **Calendar canvas**: Day/week view of upcoming events
- **Tasks canvas**: List of tasks, filterable by status/list
- **Notes canvas**: Note browser and viewer
- **Weather canvas**: Current conditions and forecast
- **Connections canvas**: Connected integrations status

The agent can invoke these:

```
User: "What's tomorrow look like?"
Agent: [calls calendar tool, returns events]
Agent: "You have 4 things scheduled tomorrow..."
Canvas: [renders calendar view for tomorrow]
```

### Capability Discovery

The app grid provides passive discovery—users can browse what's available. Additional patterns help users learn what Sui can do:

- **Contextual suggestions in the input**: Ghost text that cycles example queries ("Try: What's tomorrow look like?")
- **First-message prompts**: Instead of just "What do you need?", offer 2-3 tappable starting points
- **App grid hover states**: Show example queries for each app on hover

### Tool Call Display

When the agent uses tools, the UI shows a minimal indicator:

```
● calendar › tomorrow's events
● web_search › "weather forecast pittsburgh"
```

This gives transparency into what the agent is doing without cluttering the conversation.

---

## Infrastructure

### Fly Configuration

```toml
[build]
  builder = "dockerfile"

[env]
  NODE_ENV = "production"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

Machines auto-stop when idle, auto-start on request. At least one machine stays warm to minimize cold starts.

### Environment Variables

```
ANTHROPIC_API_KEY=...
CLERK_SECRET_KEY=...
CONVEX_URL=...
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
```

### Deployment

- Push to main triggers deploy to Fly
- Convex schema changes deploy via `npx convex deploy`
- Database migrations handled by Convex

---

## Security

### Authentication

All requests authenticated via Clerk. The Fly server validates the session token and extracts the userId.

### Data Isolation

- AgentFS: Each user has a separate database URL in Turso
- Convex: All queries filtered by userId
- No cross-user data access possible

### API Keys

External service API keys (Google Calendar, Gmail, etc.) stored encrypted per-user. The agent uses them on behalf of the user.

### Audit Log

Every tool invocation is logged to AgentFS. This provides:

- Debugging: What did the agent do?
- Compliance: Full record of actions
- Transparency: User can inspect what happened

---

## Development Roadmap

### Phase 1: Foundation

- [ ] Project scaffolding (Bun, Hono, TanStack Start)
- [ ] Clerk authentication integration
- [ ] AgentFS setup and basic file operations
- [ ] Convex schema for core data types
- [ ] Basic agent loop with streaming
- [ ] Minimal chat UI
- [ ] Web search integration

### Phase 2: Core Capabilities

- [ ] Memory tools (read/write files, KV)
- [ ] Calendar integration
- [ ] Tasks CRUD
- [ ] Notes CRUD
- [ ] Reminders with notifications

### Phase 3: UI Polish

- [ ] Canvas panel implementation
- [ ] Calendar canvas
- [ ] Tasks canvas
- [ ] Notes canvas
- [ ] Tool call display


---

## Open Questions

These items need resolution but are not blocking V1:

1. **External integrations architecture**: MCP servers vs. direct API integrations vs. hybrid. Will be determined as each integration is built.

2. **Reminder notifications**: Push notifications? Email? SMS? Need to decide delivery mechanism.

3. **Offline/sync**: What happens if Convex is temporarily unavailable? Is eventual consistency acceptable?

4. **Rate limiting**: How to handle users who make excessive requests? Anthropic API costs are non-trivial.

5. **Multi-device**: How does the experience work across phone and desktop? Is there a mobile app or just responsive web?

---

## Glossary

- **Sui**: The agent. Short for Suiren.
- **AgentFS**: The filesystem and state layer for the agent. Built on Turso (SQLite).
- **Mini-app**: A discrete capability (Calendar, Tasks, Notes, etc.) consisting of schema, tools, skills, and optional UI.
- **Skill**: A SKILL.md file that teaches Sui domain-specific workflows and patterns. Augments tools with procedural knowledge.
- **Canvas**: The right panel of the UI that displays contextual mini-app interfaces.
- **Tool**: A function the agent can invoke to take action or retrieve information.
- **Compaction**: Summarizing conversation history when approaching context limits, allowing extended tasks without losing coherence.