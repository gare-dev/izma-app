FROM oven/bun:1 AS deps
WORKDIR /app

# Install dependencies from monorepo root
COPY package.json bun.lock* ./
COPY packages/ packages/
COPY apps/web/package.json apps/web/

RUN bun install 

# ── Build ────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY apps/web/ apps/web/

RUN cd apps/web && bun run build

# ── Production ───────────────────────────────────────────────────────────────
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next apps/web/.next
COPY --from=builder /app/apps/web/public apps/web/public
COPY --from=builder /app/apps/web/package.json apps/web/package.json
COPY --from=builder /app/apps/web/next.config.ts apps/web/next.config.ts
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages packages

EXPOSE 5050

CMD ["bun", "run", "--cwd", "apps/web", "start"]