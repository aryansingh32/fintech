#!/bin/sh
set -e

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

echo "==> Running Prisma seed..."
npx ts-node -O '{"module":"commonjs"}' prisma/seed.ts || echo "Seed script completed or already seeded."

echo "==> Starting backend application..."
exec "$@"
