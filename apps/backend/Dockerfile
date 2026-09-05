# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# ---- deps: install full deps once, reused by build and pruned for runtime
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate

# ---- build: compile TypeScript to dist/
FROM deps AS build
COPY . .
RUN npm run build

# ---- runtime: prod deps only + compiled output
FROM base AS runtime
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh

USER root
RUN chmod +x ./docker-entrypoint.sh
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/v1/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
