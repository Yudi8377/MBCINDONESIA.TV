#!/usr/bin/env bash
# Backup database produksi MBC Indonesia (Supabase) — skema public, format kustom + hash SHA-256.
# Catatan: skema auth/storage milik Supabase tidak disertakan (hak akses terbatas); untuk
# backup penuh gunakan menu Database ▸ Backups di dasbor Supabase.
#
# Pakai:
#   SUPABASE_DB_URL='postgresql://...' ./ops/backup-db.sh [folder-tujuan]
#
# Jadwal harian lewat cron (02.15 setiap hari):
#   15 2 * * * SUPABASE_DB_URL='postgresql://...' /path/ops/backup-db.sh /var/backups/mbc
#
# Uji restore (wajib dicoba minimal sekali sebulan, JANGAN ke database produksi):
#   createdb uji_restore && pg_restore -d uji_restore backups/mbc-TERBARU.dump
set -euo pipefail

[ -z "${SUPABASE_DB_URL:-}" ] && { echo "SUPABASE_DB_URL belum diisi"; exit 1; }
TUJUAN="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M)"
BERKAS="$TUJUAN/mbc-$STAMP.dump"

mkdir -p "$TUJUAN"
echo "[$(date +%H:%M:%S)] mulai backup -> $BERKAS"
# hanya skema public: akun aplikasi tidak berhak membaca skema auth/storage milik Supabase
pg_dump "$SUPABASE_DB_URL" \
  --schema=public --no-owner --no-privileges --format=custom --compress=9 \
  --file="$BERKAS"

# sidik jari untuk memastikan berkas tidak rusak saat disimpan
sha256sum "$BERKAS" | tee "$BERKAS.sha256"

# verifikasi isi dump bisa dibaca
pg_restore --list "$BERKAS" > /dev/null && echo "[ok] dump dapat dibaca (pg_restore --list)"

# simpan 14 backup terakhir, sisanya dihapus
ls -1t "$TUJUAN"/mbc-*.dump 2>/dev/null | tail -n +15 | while read -r lama; do
  rm -f "$lama" "$lama.sha256"; echo "[hapus] $lama"
done
echo "[$(date +%H:%M:%S)] selesai — $(du -h "$BERKAS" | cut -f1)"
