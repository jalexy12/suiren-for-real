# CLAUDE.md

## Rules (Break These and We Have Problems)

### Verification
- Work is NOT done until verified. Run `bun run typecheck`. Test in browser. No exceptions.
- "It should work" is not verification. Prove it works or admit you couldn't verify.
- If typecheck fails, fix it before saying you're done.
- **Exception**: `client.tsx` and `ssr.tsx` have upstream TanStack Start type errors—ignore those.

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

### Simplicity is King
- Small APIs. Minimal surface area. The best code is code that doesn't exist.
- Every function, parameter, and field is a liability. Justify its existence.
- If you can solve it with less, solve it with less.

### No Unrequested Changes
- **Do NOT add ANYTHING not explicitly requested.** If it wasn't asked for, don't add it.
- Before adding ANY new schema field, API parameter, or data structure: **ASK FIRST**.

### Configuration
- **No hardcoded values that vary by environment.** Model names, URLs, user IDs → config/constants.
- If you're typing the same string literal in multiple files, you've already failed. Make it a constant.
- Model names go in one place: `apps/agent/src/config.ts` or similar.

### Dependencies
- Before adding ANY library: verify recent commits, wide usage, proper types.
- Check `package.json` first—is something already there that does this?
- New dep = last resort, not first instinct.
- **State that survives refresh → URL params.** Don't put navigation IDs in useState.

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

### AI SDK - Agents
- `ToolLoopAgent` from `ai` with callbacks: `prepareStep`, `onStepFinish`, `onFinish`
- Tools defined with `tool()` from `ai` + Zod schemas
- See `apps/agent/src/services/agent.ts` for the pattern
- **Docs change constantly**—web search before assuming anything

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

## Gotchas
- TanStack Start, Convex, AI SDK APIs change constantly. Verify docs are current.
- just-bash: sandboxed virtual FS per user at `/home/sui`
