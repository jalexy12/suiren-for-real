FROM oven/bun:1-debian AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/agent/package.json ./apps/agent/
RUN bun install

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Production
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/agent ./apps/agent
COPY --from=builder /app/convex ./convex
COPY --from=builder /app/node_modules ./node_modules

WORKDIR /app/apps/agent
EXPOSE 3001
CMD ["bun", "src/index.ts"]
