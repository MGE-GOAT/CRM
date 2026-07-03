#!/usr/bin/env sh
# Data-retention + disk-hygiene for the Nexus CRM. Run weekly from host cron:
#   0 3 * * 0  cd /opt/nexus-crm && ./scripts/prune.sh >> /var/log/nexus-prune.log 2>&1
# Prunes ever-growing, low-value rows and reclaims Docker/tmp disk so the box
# can't slowly fill up. Adjust the horizons to taste.
set -eu
cd "$(dirname "$0")/.."

echo "[prune $(date -u +%FT%TZ)] start"

# --- DB retention (chat grows fastest; keep interaction history longer) ---
docker compose exec -T db psql -U crm -d crm <<'SQL' || echo "prune: db step failed (continuing)"
DELETE FROM "Message"  WHERE "createdAt" < now() - interval '12 months';
DELETE FROM "Reminder" WHERE "done" = true AND "date" < now() - interval '6 months';
DELETE FROM "Activity" WHERE "createdAt" < now() - interval '24 months';
SQL

# --- Disk hygiene ---
# Old per-deploy backups in /tmp
find /tmp -maxdepth 1 -name 'pre-deploy-*.tgz' -mtime +3 -delete 2>/dev/null || true
# Dangling images + build cache (keeps :latest and :rollback)
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --keep-storage 2GB >/dev/null 2>&1 || true

echo "[prune] done; disk:"
df -h / | tail -1
