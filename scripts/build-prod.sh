#!/usr/bin/env bash
# Production build script.
# Run from project root: bash scripts/build-prod.sh
set -euo pipefail

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building backend (clears dist/)..."
pnpm --filter @workspace/api-server run build

echo "==> Building frontend..."
BASE_PATH=/ \
VITE_API_BASE_URL=/api \
NODE_ENV=production \
pnpm --filter @workspace/reels-panel run build

echo "==> Copying frontend dist → backend dist/public..."
FRONTEND_DIST="artifacts/reels-panel/dist/public"
BACKEND_STATIC="artifacts/api-server/dist/public"
rm -rf "$BACKEND_STATIC"
cp -r "$FRONTEND_DIST" "$BACKEND_STATIC"
echo "    Copied $(find "$BACKEND_STATIC" -type f | wc -l) files"

echo ""
echo "Build complete."
echo "Start with: bash scripts/start-prod.sh"
echo "  or:       NODE_ENV=production PORT=3000 node artifacts/api-server/dist/index.mjs"
