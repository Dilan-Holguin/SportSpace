#!/bin/sh
set -e

echo "Waiting for PostgreSQL and applying migrations..."
attempt=1
until ../../node_modules/.bin/prisma migrate deploy; do
  if [ "$attempt" -ge 30 ]; then
    echo "Prisma migrate failed after ${attempt} attempts" >&2
    exit 1
  fi
  echo "Database not ready (attempt ${attempt}/30); retrying in 5s..."
  attempt=$((attempt + 1))
  sleep 5
done

echo "Seeding development data..."
node -r ts-node/register prisma/seed.ts

echo "Starting SportSpace API..."
exec node dist/main.js
