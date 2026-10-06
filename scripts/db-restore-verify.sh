#!/usr/bin/env bash
set -euo pipefail

backup="${1:-}"
if [ -z "$backup" ] || [ ! -f "$backup" ]; then
  echo "Usage: RAM_RESTORE_DATABASE_URL=... npm run db:restore:verify -- /path/to/backup.dump" >&2
  exit 1
fi

if [ -z "${RAM_RESTORE_DATABASE_URL:-}" ]; then
  echo "RAM_RESTORE_DATABASE_URL is required" >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ] && [ "$RAM_RESTORE_DATABASE_URL" = "$DATABASE_URL" ]; then
  echo "Refusing to restore into DATABASE_URL. Use a separate fresh recovery database." >&2
  exit 1
fi

table_count=$(psql "$RAM_RESTORE_DATABASE_URL" -Atc "
  SELECT count(*)
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> '_prisma_migrations';
")

if [ "$table_count" != "0" ]; then
  echo "Refusing to restore: recovery database is not empty." >&2
  exit 1
fi

if [ -f "$backup.sha256" ]; then
  sha256sum --check "$backup.sha256"
fi

pg_restore   --no-owner   --no-acl   --dbname="$RAM_RESTORE_DATABASE_URL"   "$backup"

DATABASE_URL="$RAM_RESTORE_DATABASE_URL" npm run db:migrate:status

echo "Restore completed into the separate recovery database."
echo "Validate application smoke tests and record counts before any cutover."
