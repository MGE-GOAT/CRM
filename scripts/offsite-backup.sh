#!/usr/bin/env bash
# Off-site DB backup → S3-compatible object storage (e.g. ArvanCloud Object Storage).
# Run nightly via cron. Keeps backups OFF the server so a total host loss is survivable.
#
# Requires: awscli (apt-get install -y awscli) and these env vars (put in /opt/nexus-crm/.backup.env):
#   S3_ENDPOINT   e.g. https://s3.ir-thr-at1.arvanstorage.ir
#   S3_BUCKET     e.g. spun-crm-backups
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   (from ArvanCloud Object Storage)
#   BACKUP_RETENTION_DAYS  (optional, default 30)
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .backup.env ] && set -a && . ./.backup.env && set +a

: "${S3_ENDPOINT:?set S3_ENDPOINT}" "${S3_BUCKET:?set S3_BUCKET}"
: "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"

STAMP=$(date +%F_%H%M)
TMP="/tmp/crm_${STAMP}.sql.gz"

echo "[offsite] dumping database..."
docker compose exec -T db pg_dump -U crm crm | gzip > "$TMP"

echo "[offsite] uploading to s3://$S3_BUCKET ..."
aws --endpoint-url "$S3_ENDPOINT" s3 cp "$TMP" "s3://$S3_BUCKET/crm_${STAMP}.sql.gz"

rm -f "$TMP"

# prune old remote backups
echo "[offsite] pruning backups older than ${RETENTION} days..."
cutoff=$(date -d "-${RETENTION} days" +%s)
aws --endpoint-url "$S3_ENDPOINT" s3 ls "s3://$S3_BUCKET/" | while read -r d t _ name; do
  [ -z "${name:-}" ] && continue
  fdate=$(echo "$name" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1) || continue
  [ -z "$fdate" ] && continue
  if [ "$(date -d "$fdate" +%s)" -lt "$cutoff" ]; then
    aws --endpoint-url "$S3_ENDPOINT" s3 rm "s3://$S3_BUCKET/$name"
  fi
done
echo "[offsite] done."
