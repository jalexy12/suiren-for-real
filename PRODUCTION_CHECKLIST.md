# Production Checklist

**Status:** SECURITY HARDENED - Deployment guide added
**Last Updated:** 2026-01-05
**Blocker Count:** 0 Critical, 2 High (remaining), 4 Medium

---

## Deployment Guide

### Prerequisites

Before deploying, you need accounts with:
- [Clerk](https://clerk.com) - Authentication
- [Convex](https://convex.dev) - Backend
- [Render](https://render.com) - Hosting (both web + agent)
- [Anthropic](https://console.anthropic.com) - Claude API

---

### Step 1: Clerk Production Instance

1. **Create Production Instance**
   - Clerk Dashboard → Development dropdown → "Create production instance"
   - Clone dev settings or start fresh (SSO connections must be reconfigured manually)

2. **Configure Domain**
   - Add your domain in Clerk Dashboard → Domains
   - Add the DNS records Clerk provides (allow 48h for propagation)
   - Click "Deploy certificates" when DNS is ready

3. **Create JWT Template for Convex**
   - Clerk Dashboard → JWT Templates → New Template
   - Name: `convex` (exact, case-sensitive)
   - Use the pre-built Convex template
   - Copy the **Issuer URL** (e.g., `https://clerk.yourdomain.com`)

4. **Get Production Keys**
   - Clerk Dashboard → API Keys
   - Copy `pk_live_...` (Publishable Key)
   - Copy `sk_live_...` (Secret Key)

5. **Update OAuth Providers** (if using social login)
   - Replace dev OAuth credentials with production ones for each provider

---

### Step 2: Convex Production Setup

1. **Set Environment Variables in Convex Dashboard**
   - Go to your Convex project → Settings → Environment Variables
   - Add: `CLERK_JWT_ISSUER_DOMAIN` = your Clerk Issuer URL from Step 1.3

2. **Generate Deploy Key**
   - Convex Dashboard → Project Settings → Deploy Keys
   - Create a "Production" deploy key
   - Save it securely (you'll add it to Render)

3. **Deploy Backend**
   ```bash
   npx convex deploy
   ```

4. **Note Production URL**
   - Copy your production Convex URL (e.g., `https://your-project.convex.cloud`)

---

### Step 3: Render Deployment

Both the web app and agent are deployed to Render from a single Blueprint.

#### Option A: One-Click Blueprint Deploy (Recommended)

1. **Push to GitHub** (if not already)

2. **Create Blueprint**
   - Render Dashboard → Blueprints → New Blueprint
   - Connect your GitHub repo
   - Render auto-detects `render.yaml` in the root

3. **Set Environment Variables**
   After Blueprint creates the services, add these in each service's Environment tab:

   **suiren-web:**
   | Variable | Value |
   |----------|-------|
   | `VITE_CONVEX_URL` | `https://your-project.convex.cloud` |
   | `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
   | `VITE_AGENT_URL` | `https://suiren-agent.onrender.com` |
   | `CONVEX_DEPLOY_KEY` | From Step 2.2 |

   **suiren-agent:**
   | Variable | Value |
   |----------|-------|
   | `CLERK_SECRET_KEY` | `sk_live_...` |
   | `CONVEX_URL` | `https://your-project.convex.cloud` |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `ALLOWED_ORIGINS` | `https://suiren-web.onrender.com` |

4. **Deploy**
   - Render auto-deploys on push to main
   - Or trigger manually from Dashboard

#### Option B: Manual Service Creation

1. **Create Agent Service**
   - Render Dashboard → New → Web Service
   - Connect GitHub repo
   - Name: `suiren-agent`
   - Root Directory: `apps/agent`
   - Runtime: Docker
   - Add environment variables (see above)

2. **Create Web Service**
   - Render Dashboard → New → Web Service
   - Connect GitHub repo
   - Name: `suiren-web`
   - Root Directory: `apps/web`
   - Runtime: Node
   - Build Command: `bun install && npx convex deploy --cmd 'bun run build'`
   - Start Command: `node .output/server/index.mjs`
   - Add environment variables (see above)

---

### Step 4: Verify Production

Run these checks after deployment:

```bash
# 1. Health checks
curl https://suiren-agent.onrender.com/health
curl https://suiren-web.onrender.com  # Should load without errors

# 2. Auth flow
# - Sign up with a new account
# - Verify redirect to /chat works
# - Verify chat messages are sent/received

# 3. CORS
# - Open browser console on your domain
# - Verify no CORS errors when chatting

# 4. Data isolation
# - Create a conversation as User A
# - Sign in as User B
# - Verify User B cannot see User A's conversations
```

---

### Environment Variables Summary

#### Web (Render: suiren-web)
```env
VITE_CONVEX_URL=https://your-project.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_AGENT_URL=https://suiren-agent.onrender.com
CONVEX_DEPLOY_KEY=prod:...  # For build step only
```

#### Agent (Render: suiren-agent)
```env
CLERK_SECRET_KEY=sk_live_...
CONVEX_URL=https://your-project.convex.cloud
ANTHROPIC_API_KEY=sk-ant-...
ALLOWED_ORIGINS=https://suiren-web.onrender.com
```

#### Convex Dashboard
```env
CLERK_JWT_ISSUER_DOMAIN=https://clerk.yourdomain.com
```

---

### Rollback Procedures

**Web & Agent (Render)**
- Render Dashboard → Select service → Events → Click previous deploy → Rollback

**Convex**
- Convex Dashboard → Deployments → View history
- Note: Schema changes may require data migrations

---

## Security Checklist (All Complete)

### Critical Blockers (Ship-Stoppers) - ALL FIXED

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

## Recommended Before Launch

### [ ] OBS-001: Add Error Tracking (Sentry)

Install Sentry for error visibility in production:

**Agent:**
```bash
cd apps/agent
bun add @sentry/bun
```

```typescript
// apps/agent/src/index.ts
import * as Sentry from '@sentry/bun'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
})
```

**Web:**
```bash
cd apps/web
bun add @sentry/react
```

### [ ] OBS-002: Configure Render Health Checks

Render auto-detects `/health` endpoints. Verify your agent has one:
```typescript
// apps/agent/src/routes/health.ts
app.get('/', (c) => c.json({ status: 'ok', timestamp: Date.now() }))
```

### [ ] OBS-003: Scale Up for Production

In Render Dashboard, upgrade instance types:
- **Agent**: Starter ($7/mo) or Standard ($25/mo) for production traffic
- **Web**: Starter ($7/mo) for SSR workloads
- Free tier has cold starts and limited resources

---

## Nice to Have (Post-Launch Polish)

- [ ] Add request rate limiting to agent API (prevent runaway API costs)
- [ ] Add structured logging (replace console.log with pino or similar)
- [ ] Set up CI/CD pipeline with typecheck gate
- [ ] Add integration tests for auth flow
- [ ] Add request timeouts to agent (currently unlimited)
- [ ] Add API versioning for backwards compatibility

---

## Quick Reference

### Deploy Commands
```bash
# Both services auto-deploy on push to main
# Manual deploy via Render Dashboard → Service → Manual Deploy

# Convex (run locally or in CI)
npx convex deploy
```

### Check Logs
```bash
# Render logs: Dashboard → Service → Logs tab

# Convex logs
npx convex logs
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 on /chat | Invalid/expired Clerk token | Check `CLERK_SECRET_KEY` in Render env |
| CORS error | Wrong `ALLOWED_ORIGINS` | Update Render env with production domain |
| "Unauthenticated" in Convex | Wrong JWT issuer | Check `CLERK_JWT_ISSUER_DOMAIN` in Convex env |
| Agent timeout | Long-running tool call | Check tool implementation, add timeout |
| Cold start delays | Free tier instance | Upgrade to Starter ($7/mo) |

---

## Sign-Off

| Check | Owner | Date |
|-------|-------|------|
| All Critical fixed | Claude | 2026-01-04 |
| Deployment guide written | Claude | 2026-01-05 |
| Security review passed | | |
| Auth flow tested e2e | | |
| CORS verified in prod | | |
| Monitoring in place | | |

---

*This checklist is the source of truth. Security items are complete. Follow the Deployment Guide above to launch.*
