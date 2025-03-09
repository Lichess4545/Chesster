FROM node:22 AS base

FROM base AS deps
RUN corepack enable && \
  corepack prepare pnpm@10.0.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm fetch
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install

FROM base AS build
RUN corepack enable && \
  corepack prepare pnpm@10.0.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm fetch
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install
COPY . .
RUN pnpm build
RUN ls -la dist

FROM base
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY wait-for-postgres.sh ./
RUN chmod +x wait-for-postgres.sh
# Install PostgreSQL client for the wait script
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Default to production, can be overridden in docker-compose for dev
ENV NODE_ENV=production
EXPOSE 3000
# Default command runs the production app
CMD ["node", "./dist/index.js"]
