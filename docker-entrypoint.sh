#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "[entrypoint] Bootstrapping admin user..."
  node prisma/bootstrap-admin.cjs
fi

echo "[entrypoint] Starting server..."
exec node server.js
