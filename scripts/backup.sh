#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
if docker compose ps app --status running >/dev/null 2>&1; then
  docker compose exec -T app sh -c 'cp /app/data/control.db /app/data/control.db.bak'
  docker compose cp app:/app/data/control.db "$BACKUP_DIR/control-$STAMP.db"
else
  cp ./data/control.db "$BACKUP_DIR/control-$STAMP.db"
fi
find "$BACKUP_DIR" -name 'control-*.db' -mtime +"$KEEP_DAYS" -delete
echo "✅ Backup: $BACKUP_DIR/control-$STAMP.db (retención ${KEEP_DAYS}d)"