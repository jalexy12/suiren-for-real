# CLAUDE.md

## Rules (Break These and We Have Problems)

### Verification
- Work is NOT done until verified. Run `bun run typecheck`. Test in browser. No exceptions.
- "It should work" is not verification. Prove it works or admit you couldn't verify.
- If typecheck fails, fix it before saying you're done.

### Type Safety
- No `any`. No `unknown` escape hatches. No `as` casts to silence errors.
- These are not "temporary"—they're bugs you're hiding. Fix the actual type.
- Complex types go in `packages/shared`. Define them properly.
- **Convex schemas**: No `v.any()`. Define the actual shape or use a union.
- **AI SDK message parts**: Define proper interfaces for text, tool-call, tool-result parts. Don't cast to any.
- **Environment variables**: Use proper Vite types or define them. No `(import.meta as any).env`.

### Getting Unstuck
- Stuck? Web search the docs. Read node_modules source. Read existing code.
- NEVER guess API signatures. Look them up. The answer exists.
- Don't iterate blindly hoping something works. Understand WHY it's broken first.
- Ask me only after you've actually tried the above.

### Code Quality
- READ existing code before touching it. Match the patterns that are there.
- No placeholder code. No TODOs. No "we can improve this later."
- No over-engineering. Solve exactly what's asked. Stop there.
- Dead code gets deleted, not commented out.
- **No console.log in production code.** Use a proper logger or remove it.
- **No fire-and-forget promises.** Handle errors or explicitly acknowledge the risk.

### Configuration
- **No hardcoded values that vary by environment.** Model names, URLs, user IDs → config/constants.
- If you're typing the same string literal in multiple files, you've already failed. Make it a constant.
- Model names go in one place: `apps/agent/src/config.ts` or similar.

### Dependencies
- Before adding ANY library: verify recent commits, wide usage, proper types.
- Check `package.json` first—is something already there that does this?
- New dep = last resort, not first instinct.

### State Management
- URL params for anything that should survive refresh. Period.
- If you put a navigation ID in useState, you've already failed.

---

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Bun |
| Frontend | TanStack Start + React |
| API | Hono |
| AI | **AI SDK v6 Agents** |
| Backend | Convex |
| Auth | Clerk |

### AI SDK v6 - Agents
We use the agent architecture with tool loops:
- `agent()` function from `ai` package with `maxSteps` for multi-turn tool execution
- Agent manages its own loop—you don't manually loop over tool calls
- Tools defined with `tool()` from `ai` with Zod schemas
- See `apps/agent/src/services/agent.ts` for the pattern
- **Docs change constantly**—web search "vercel ai sdk agents" before assuming anything

---

## Structure
```
apps/
  web/          # TanStack Start + Clerk (:3000)
  agent/        # Hono on Bun (:3001)
packages/
  shared/       # Shared types (USE THIS)
convex/         # Backend (root)
```

## Commands
```bash
bun install                     # Install deps
bun run dev:convex              # Terminal 1 - Convex backend
bun run dev:web                 # Terminal 2 - Web frontend (:3000)
bun run dev:agent               # Terminal 3 - Agent API (:3001, auto-restarts on changes)
bun run typecheck               # RUN THIS EVERY TIME

# Restart agent (kills existing process and starts fresh)
bun run restart:agent
```

**Note:** The agent uses `bun --watch` so it auto-restarts when files change. Use `restart:agent` only if it crashes or gets stuck.

## Standard Libs (use these, don't reinvent)
- `lucide-react` for icons
- `date-fns` for dates
- `framer-motion` for animation

## Key Files
- `apps/agent/src/services/agent.ts` - Agent with tool loop
- `apps/web/src/routes/chat.tsx` - Chat layout
- `apps/web/src/routes/chat.$conversationId.tsx` - Chat content
- `convex/schema.ts` - Database schema
- `packages/shared/` - Shared types between apps

## Known Tech Debt
- **Auth not wired up**: DEV_USER_ID constant used instead of Clerk auth. See:
  - `apps/agent/src/middleware/auth.ts` (middleware exists, not applied)
  - `apps/agent/src/config.ts` (DEV_USER_ID)
  - `apps/web/src/config.ts` (DEV_USER_ID)
  - Need to: apply auth middleware, send tokens from web, use real userId
- **TanStack Start type errors**: `client.tsx` and `ssr.tsx` have type errors due to TanStack Start's typing issues
  - App works at runtime, types are broken upstream
  - Track: https://github.com/TanStack/router/issues

## Gotchas
- TanStack Start, Convex, AI SDK APIs change constantly. Verify docs are current.
- just-bash: sandboxed virtual FS per user at `/home/sui`
