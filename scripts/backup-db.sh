#!/usr/bin/env bash
# Skrip Backup Otomatis Database Travel App
# Menyimpan salinan travel.db ke /root/.hermes/backups/daily/ dengan integritas OK

BACKUP_DIR="/root/.hermes/backups/daily"
DB_PATH="/root/travel-app/data/travel.db"
TS=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$BACKUP_DIR/travel-$TS.db"

mkdir -p "$BACKUP_DIR"

if [ -f "$DB_PATH" ]; then
  # Cek integritas sebelum backup
  sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "ok"
  if [ $? -eq 0 ]; then
    cp "$DB_PATH" "$OUT_FILE"
    echo "[$TS] Backup sukses: $OUT_FILE"
    
    # Pertahankan hanya 30 backup terakhir (hapus yang lebih lama)
    ls -t "$BACKUP_DIR"/travel-*.db | tail -n +31 | xargs -r rm --
  else
    echo "[$TS] ERROR: Gagal backup, database tidak utuh (integrity_check gagal)!" >&2
    exit 1
  fi
else
  echo "[$TS] ERROR: Database $DB_PATH tidak ditemukan!" >&2
  exit 1
fi
