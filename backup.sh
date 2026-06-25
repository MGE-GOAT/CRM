#!/usr/bin/env bash
# Spun CRM — nightly database backup. Keeps the last 14 days.
# Wired into cron by deploy.sh; can also be run manually.
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-/opt/spun-crm-backups}"
mkdir -p "$BACKUP_DIR"

STAMP=$(date +%F_%H%M)
FILE="$BACKUP_DIR/crm_${STAMP}.sql.gz"

docker compose exec -T db pg_dump -U crm crm | gzip > "$FILE"
echo "[backup] wrote $FILE"

# prune backups older than 14 days
find "$BACKUP_DIR" -name 'crm_*.sql.gz' -mtime +14 -delete
echo "[backup] pruned backups older than 14 days"
