#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/rukotvornoe}"
BACKEND_DIR="${BACKEND_DIR:-$APP_ROOT/backend}"
DB_PATH="${DB_PATH:-$BACKEND_DIR/data/app.sqlite}"
UPLOADS_DIR="${UPLOADS_DIR:-$BACKEND_DIR/uploads}"
BACKUP_ROOT="${BACKUP_ROOT:-$APP_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

TIMESTAMP="$(date +%F_%H-%M-%S)"
WORK_DIR="$(mktemp -d)"
ARCHIVE_PATH="$BACKUP_ROOT/rukotvornoe_backup_${TIMESTAMP}.tar.gz"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

if [ ! -f "$DB_PATH" ]; then
  echo "Database file not found: $DB_PATH" >&2
  exit 1
fi

if [ ! -d "$UPLOADS_DIR" ]; then
  echo "Uploads directory not found: $UPLOADS_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
mkdir -p "$WORK_DIR/uploads"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$WORK_DIR/app.sqlite'"
else
  cp "$DB_PATH" "$WORK_DIR/app.sqlite"
  [ -f "${DB_PATH}-wal" ] && cp "${DB_PATH}-wal" "$WORK_DIR/app.sqlite-wal" || true
  [ -f "${DB_PATH}-shm" ] && cp "${DB_PATH}-shm" "$WORK_DIR/app.sqlite-shm" || true
fi

cp -a "$UPLOADS_DIR/." "$WORK_DIR/uploads/"

cat > "$WORK_DIR/backup-info.txt" <<EOF
created_at=$TIMESTAMP
db_path=$DB_PATH
uploads_dir=$UPLOADS_DIR
EOF

tar -czf "$ARCHIVE_PATH" -C "$WORK_DIR" .

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$ARCHIVE_PATH" > "${ARCHIVE_PATH}.sha256"
fi

find "$BACKUP_ROOT" -type f -name "rukotvornoe_backup_*.tar.gz" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_ROOT" -type f -name "rukotvornoe_backup_*.tar.gz.sha256" -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $ARCHIVE_PATH"
