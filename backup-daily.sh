#!/usr/bin/env bash
# Run on an external trusted host, not an ephemeral Render instance.
set -euo pipefail
umask 077
: "${SISFIA_BACKUP_DIR:?Define un directorio privado externo}"
[[ "$SISFIA_BACKUP_DIR" = /* ]] || { echo 'Usa una ruta absoluta'; exit 1; }
mkdir -p "$SISFIA_BACKUP_DIR"
chmod 700 "$SISFIA_BACKUP_DIR"
cd "$(dirname "$0")/.."
exec 9>"$SISFIA_BACKUP_DIR/.backup.lock"
flock -n 9 || { echo 'Ya existe un respaldo en curso'; exit 1; }
file="$SISFIA_BACKUP_DIR/SISFIA-respaldo-$(date -u +%Y%m%dT%H%M%SZ).json"
node scripts/full-backup.js "$file"
node scripts/restore-full-backup.js "$file"
# No automatic deletion: retention is defined by the institution.
