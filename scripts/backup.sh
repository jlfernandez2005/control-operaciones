#!/usr/bin/env bash
set -euo pipefail
umask 077
DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$DIR"
FILE="$DIR/control-$(date +%Y%m%d-%H%M%S).db"
if [[ "${BACKUP_DOCKER:-0}" == 1 ]]; then
  docker compose exec -T app node --input-type=module -e 'import {DatabaseSync} from "node:sqlite";if(process.env.TURSO_DATABASE_URL)throw Error("Usa respaldo del proveedor Turso");const db=new DatabaseSync(process.env.DB_PATH);db.exec("VACUUM INTO '\''/app/data/control-snapshot.db'\''");db.close();'
  docker compose cp app:/app/data/control-snapshot.db "$FILE"
  docker compose exec -T app rm /app/data/control-snapshot.db
else
  python3 - "${DB_PATH:-./data/control.db}" "$FILE" <<'PY'
import sqlite3,sys,pathlib
if not pathlib.Path(sys.argv[1]).is_file(): raise SystemExit('Base local no encontrada')
with sqlite3.connect(sys.argv[1]) as source, sqlite3.connect(sys.argv[2]) as dest: source.backup(dest)
PY
fi
chmod 600 "$FILE"
echo "Respaldo: $FILE"
