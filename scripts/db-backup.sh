#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

output="${1:-ram-backup-$(date -u +%Y%m%dT%H%M%SZ).dump}"
pg_dump "$DATABASE_URL"   --format=custom   --no-owner   --no-acl   --file="$output"

sha256sum "$output" > "$output.sha256"
echo "Backup written to $output"
echo "Checksum written to $output.sha256"
