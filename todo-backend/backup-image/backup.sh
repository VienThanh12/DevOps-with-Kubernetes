#!/usr/bin/env bash
set -euo pipefail

# Expect PG* env from ConfigMap/Secret and GCS_BUCKET from ConfigMap
: "${PGHOST:?PGHOST not set}"
: "${PGPORT:?PGPORT not set}"
: "${PGDATABASE:?PGDATABASE not set}"
: "${PGUSER:?PGUSER not set}"
: "${PGPASSWORD:?PGPASSWORD not set}"

if [ -z "${GCS_BUCKET:-}" ] || echo "$GCS_BUCKET" | grep -q "CHANGE_ME_BUCKET"; then
  echo "ERROR: GCS_BUCKET is not set to a valid bucket (current: '$GCS_BUCKET')." >&2
  exit 2
fi

DATE=$(date -u +%Y%m%d-%H%M%S)
OUT="/tmp/todos-${DATE}.sql.gz"
echo "[backup] Dumping ${PGHOST}:${PGPORT}/${PGDATABASE} -> ${OUT}"
pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" --format=plain | gzip -9 > "${OUT}"
echo "[backup] Dump complete"

# Auth for gsutil (default path can be overridden)
GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-/var/secrets/google/key.json}"
gcloud auth activate-service-account --key-file "$GOOGLE_APPLICATION_CREDENTIALS"

DEST="${GCS_BUCKET}/todos/${DATE}.sql.gz"
echo "[backup] Uploading ${OUT} to ${DEST}"
gsutil cp "${OUT}" "${DEST}"
echo "[backup] Upload complete"
