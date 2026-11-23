#!/usr/bin/env bash
# ops/backup.sh — backup logis PostgreSQL (Neon / VPS / docker).
# Pakai: DATABASE_URL=postgres://... ./ops/backup.sh
# Output: backups/mbctv-YYYYmmdd-HHMMSS.sql.gz + .sha256, retensi 14 hari.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL belum diisi. Contoh: postgres://mbc:pass@host:5432/mbctv?sslmode=require}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DEST="${DEST:-$(cd "$(dirname "$0")/.." && pwd)/backups}"
mkdir -p "$DEST"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="$DEST/mbctv-$STAMP.sql.gz"

echo "→ backup mulai: $OUT"
if command -v pg_dump >/dev/null 2>&1; then PGD=pg_dump; else PGD="$(ls /usr/lib/postgresql/*/bin/pg_dump 2>/dev/null | tail -1)"; fi
[ -n "${PGD:-}" ] || { echo "❌ pg_dump tidak ditemukan (apt install postgresql-client)"; exit 1; }

# Supabase/Neon punya schema internal (auth, storage, realtime) yang bukan milik kita dan
# tidak boleh ikut; untuk host terkelola, cadangkan schema public saja.
SKEMA=""
case "$DATABASE_URL" in
  *supabase.co*|*supabase.com*|*pooler.supabase.com*) SKEMA="--schema=public" ;;
esac
HOST_DB="$(printf '%s' "$DATABASE_URL" | sed -E 's#^[a-z]+://([^@]*@)?([^:/]+).*#\2#')"
echo "→ target: $HOST_DB ${SKEMA:-(semua schema)}"

# --no-security-labels: dump tetap bisa dipulihkan ke klaster lain (role aplikasi
# seperti mbc_app belum tentu ada di sana; GRANT/policy dibuat ulang setelah restore).
"$PGD" "$DATABASE_URL" $SKEMA --no-owner --no-privileges --no-security-labels | gzip -9 > "$OUT"

# Verifikasi dump tidak kosong & bisa dibaca
gzip -t "$OUT"
SIZE=$(du -h "$OUT" | cut -f1)
TABLES=$(gzip -dc "$OUT" | grep -c '^CREATE TABLE' || true)
COPY=$(gzip -dc "$OUT" | grep -c '^COPY ' || true)
[ "$TABLES" -ge 5 ] || { echo "❌ dump mencurigakan: hanya $TABLES tabel"; exit 1; }
[ "$COPY" -ge 5 ] || { echo "❌ dump tidak memuat data (COPY: $COPY)"; exit 1; }
echo "   tabel: $TABLES · bagian data: $COPY"

( cd "$DEST" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )
echo "✅ backup OK — $SIZE, $TABLES tabel, sha256 tersimpan"

# Retensi
find "$DEST" -name 'mbctv-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete | sed 's/^/   hapus (retensi): /'
echo "→ total backup tersimpan: $(ls -1 "$DEST"/mbctv-*.sql.gz 2>/dev/null | wc -l)"
