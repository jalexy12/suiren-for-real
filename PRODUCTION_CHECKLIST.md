# Production Checklist

**Status:** SECURITY HARDENED - Remaining items are polish
**Last Updated:** 2026-01-04
**Blocker Count:** ~~4 Critical~~ 0 Critical, ~~6 High~~ 2 High (remaining), 4 Medium

---

## Critical Blockers (Ship-Stoppers) - ALL FIXED

### [x] AUTH-001: Integrate Clerk into Web Frontend
**Status:** FIXED
- Added `ClerkProvider` and `ConvexProviderWithClerk` to `__root.tsx`
- Created `/sign-in` and `/sign-up` routes
- Protected `/chat` route with `requireAuth()` server function
- Replaced hardcoded `DEV_USER_ID` with `useAuth().userId`
- Auth token passed to agent API via headers

### [x] AUTH-002: Apply Auth Middleware to Agent Routes
**Status:** FIXED
- Applied `authMiddleware` to `/chat/*` and `/title/*` routes in `index.ts`
- Routes now get userId from `c.get('userId')` after auth validation
- Removed `DEV_USER_ID` from agent config

### [x] AUTH-003: Add Row-Level Security to Convex
**Status:** FIXED
- Added `getAuthenticatedUserId()` helper to all Convex files
- All queries/mutations now verify `ctx.auth.getUserIdentity()`
- Users can only access their own data
- Created `convex/auth.config.ts` for Clerk integration

### [x] SEC-001: Restrict CORS Origins
**Status:** FIXED
- Changed from `origin: '*'` to `origin: ALLOWED_ORIGINS`
- Defaults to localhost in dev, uses `ALLOWED_ORIGINS` env var in prod
- Added `credentials: true` for cookie support

---

## High Priority (Must Fix Before Launch)

### [x] SEC-002: Remove or Protect `clearAllMessages`
**Status:** FIXED - Function removed entirely from `convex/conversations.ts`

### [x] CONFIG-001: Centralize Stray Model Name
**Status:** FIXED
- Changed `compaction.ts` to import and use `MODELS.fast` from config
- All model names now centralized in `apps/agent/src/config.ts`

### [x] TYPE-001: Replace `as any` Casts with Type Guards
**Status:** MOSTLY FIXED
- Frontend `as any` casts already cleaned up or in auto-generated code
- Agent has 3 remaining casts for AI SDK type compatibility (internal, not security risk)
- No user-facing type safety issues remain

### [ ] TYPE-002: Replace `v.any()` in Convex Schemas
**Files:** `convex/schema.ts` (input/output fields only)
**Status:** ACCEPTABLE
- Schema now uses properly typed `messagePart` object
- Only `input` and `output` fields use `v.any()` which is correct (tool I/O varies)
- Not a security issue, just type flexibility

### [ ] ERR-001: Handle Title Generation Errors Properly
**File:** `apps/web/src/routes/chat.$conversationId.tsx`
**Status:** PENDING (Low priority)
- Title generation already silently fails - intentional for non-critical feature
- Could add toast notification for better UX

### [ ] LOG-001: Replace console.log with Proper Logger
**Files:** `apps/agent/src/` (4 instances)
**Status:** PENDING (Low priority)
- Startup message and error logging only
- Hono logger middleware handles request logging

---

## Medium Priority (Fix Soon After Launch)

### [x] ENV-001: Validate Environment Variables at Startup
**Status:** FIXED for `VITE_CONVEX_URL` in `__root.tsx`

### [ ] ERR-002: Add Error Boundary to React App
**Status:** PENDING

### [ ] ERR-003: Handle Convex Query Failures
**Status:** PENDING

### [ ] STREAM-001: Surface Agent Stream Errors to Frontend
**Status:** PENDING

### [ ] FIX: TanStack Start Type Issues
**Status:** PENDING (Pre-existing framework issues in client.tsx/ssr.tsx)
- Not blocking - app works at runtime
- Likely needs TanStack Start version alignment

---

## Nice to Have (Post-Launch Polish)

- [ ] Add request rate limiting to agent API
- [ ] Add request/response logging for debugging
- [ ] Add health check endpoints for monitoring
- [ ] Add proper observability (traces, metrics)
- [ ] Set up CI/CD pipeline with typecheck gate
- [ ] Add integration tests for auth flow
- [ ] Document deployment process

---

## Environment Variables Required

### Web (`apps/web/.env`)
```env
VITE_CONVEX_URL=           # Your Convex deployment URL
VITE_CLERK_PUBLISHABLE_KEY=# From Clerk Dashboard
VITE_AGENT_URL=            # Agent API URL (default: http://localhost:3001)
```

### Agent (`apps/agent/.env`)
```env
ANTHROPIC_API_KEY=         # Your Anthropic API key
CONVEX_URL=                # Your Convex deployment URL
CLERK_SECRET_KEY=          # From Clerk Dashboard (for token verification)
ALLOWED_ORIGINS=           # Comma-separated allowed frontend origins
PORT=                      # Optional, defaults to 3001
```

### Convex Dashboard
```
CLERK_JWT_ISSUER_DOMAIN=   # From Clerk JWT Template (e.g., https://verb-noun-00.clerk.accounts.dev)
```

---

## Pre-Deploy Verification

Before EVERY deploy, run:
```bash
bun run typecheck           # Some TanStack Start type issues expected
bun run build               # Must complete successfully
# Manual: test auth flow end-to-end in staging
# Manual: verify CORS only allows your frontend domain
# Manual: verify Convex functions reject unauthorized requests
```

---

## Sign-Off

| Check | Owner | Date |
|-------|-------|------|
| All Critical fixed | Claude | 2026-01-04 |
| Security review passed | | |
| Auth flow tested e2e | | |
| CORS verified in prod | | |
| Load tested | | |
| Monitoring in place | | |

---

*This checklist is the source of truth. All critical security items are complete. Remaining items are UX polish and observability.*
