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

# postgresql-client-16 (to match the sptc-postgres server major version exactly -
# pg_dump from an older client against a newer server is unsupported and can
# fail or silently miss objects) from the official PGDG apt repo, since
# Debian bookworm's own repo only ships postgresql-client-15. Used by
# BackupService to produce the nightly encrypted database dump.
RUN apt-get update && apt-get install -y --no-install-recommends wget gnupg ca-certificates \
    && install -d /usr/share/postgresql-common/pgdg \
    && wget -qO /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-16 \
    && apt-get purge -y --auto-remove wget gnupg \
    && rm -rf /var/lib/apt/lists/*

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
