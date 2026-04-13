#!/usr/bin/env bash
# Production start script.
# Loads .env if present, pushes schema, starts server.
# Run from project root: bash scripts/start-prod.sh
set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "==> Loaded .env"
fi

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SESSION_SECRET:?SESSION_SECRET is required}"
: "${PORT:=3000}"
: "${NODE_ENV:=production}"

export DATABASE_URL SESSION_SECRET PORT NODE_ENV

echo "==> Pushing database schema..."
pnpm --filter @workspace/db run push

echo "==> Starting server on port $PORT..."
exec node --enable-source-maps artifacts/api-server/dist/index.mjs
