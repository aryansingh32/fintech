#!/usr/bin/env bash
# Build and (re)start the production stack on the Oracle VM. Run from the
# repo root on the VM (e.g. /opt/sptc-finance):
#
#   ./infra/oracle/deploy.sh
#
# Safe to re-run for every future deploy: it pulls the latest code, rebuilds
# only what changed, and restarts with zero manual steps. Migrations and the
# idempotent seed run automatically inside the backend container's entrypoint
# (apps/backend/docker-entrypoint.sh) before the app starts.
set -euo pipefail
cd "$(dirname "$0")/../.."

COMPOSE="docker compose -f infra/oracle/docker-compose.prod.yml --env-file apps/backend/.env.production"

if [ ! -f apps/backend/.env.production ]; then
  echo "Missing apps/backend/.env.production - copy .env.production.example and fill it in first." >&2
  exit 1
fi

if [ -d .git ]; then
  echo "==> Pulling latest code"
  git pull --ff-only
else
  echo "==> Skipping git pull (this directory isn't a git checkout - code was" >&2
  echo "    copied here directly, e.g. via rsync). Update the code yourself" >&2
  echo "    before running this, or 'git init' + set the origin remote once" >&2
  echo "    your changes are committed and pushed." >&2
fi

echo "==> Building images"
$COMPOSE build

echo "==> Starting stack"
$COMPOSE up -d

echo "==> Pruning old images"
docker image prune -f >/dev/null

echo "==> Status"
$COMPOSE ps

echo "==> Recent backend logs"
$COMPOSE logs --tail 40 backend
