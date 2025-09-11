#!/usr/bin/env sh
set -e

# Wait for Postgres if host provided
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL is set, attempting to run migrations..."
  ./node_modules/.bin/knex --knexfile ./dist/knexfile.js migrate:latest || (echo "Migrations failed"; exit 1)
  ./node_modules/.bin/knex --knexfile ./dist/knexfile.js seed:run || echo "Seeds skipped or failed"
else
  echo "DATABASE_URL not set, skipping migrations"
fi

exec "$@"
