FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies from monorepo root
COPY package.json bun.lock* ./
COPY packages/ packages/
COPY apps/server/package.json apps/server/

RUN bun install 

# Copy server source
COPY apps/server/ apps/server/

EXPOSE 3001

CMD ["bun", "run", "apps/server/src/index.ts"]