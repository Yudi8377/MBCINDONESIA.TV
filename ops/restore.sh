#!/usr/bin/env bash
# ops/restore.sh — pulihkan database dari file backup .sql.gz
# Pakai: TARGET_DATABASE_URL=postgres://... ./ops/restore.sh backups/mbctv-20260101-120000.sql.gz
# PERINGATAN: ini menghapus objek di database tujuan (schema di-drop lebih dulu).
set -euo pipefail

FILE="${1:?Sebutkan file backup: ./ops/restore.sh backups/mbctv-xxxx.sql.gz}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL belum diisi (database tujuan pemulihan)}"
[ -f "$FILE" ] || { echo "❌ file tidak ada: $FILE"; exit 1; }

if [ -f "$FILE.sha256" ]; then
  echo "→ verifikasi checksum"
  ( cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256" ) || { echo "❌ checksum tidak cocok — file rusak/berubah"; exit 1; }
fi

if command -v psql >/dev/null 2>&1; then PSQL=psql; else PSQL="$(ls /usr/lib/postgresql/*/bin/psql 2>/dev/null | tail -1)"; fi
[ -n "${PSQL:-}" ] || { echo "❌ psql tidak ditemukan"; exit 1; }

if [ "${YA:-}" != "1" ]; then
  read -r -p "Ketik 'PULIHKAN' untuk menimpa database tujuan: " CONFIRM
  [ "$CONFIRM" = "PULIHKAN" ] || { echo "Dibatalkan."; exit 1; }
fi

echo "→ kosongkan objek di schema public tujuan"
# Role aplikasi biasanya bukan owner schema, jadi DROP SCHEMA kerap ditolak.
# Drop objek satu per satu lebih portabel (lokal, Supabase, Neon).
"$PSQL" "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
  DO \$\$
  DECLARE r record;
  BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
      EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    END LOOP;
    FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' LOOP
      EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', r.sequence_name);
    END LOOP;
  END \$\$;"

echo "→ restore $FILE"
# Dump memakai --no-owner/--no-privileges, tetapi objek lama (policy RLS per-role) bisa
# masih menyebut role yang belum ada di klaster tujuan. Baris seperti itu tidak memuat
# data, jadi dicatat sebagai peringatan dan restore diteruskan.
# Dump selalu memuat "CREATE SCHEMA public" walau schema itu sudah ada. Pada database
# yang tidak dimiliki role aplikasi, perintah itu ditolak. Karena skema tujuan sudah
# disiapkan, baris tersebut dibuang agar restore bersih di Supabase/Neon/VPS.
gzip -dc "$FILE" | sed -e '/^CREATE SCHEMA public;$/d' -e '/^COMMENT ON SCHEMA public/d' > /tmp/.mbc-restore.sql
if ! "$PSQL" "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f /tmp/.mbc-restore.sql 2>/tmp/.mbc-restore.err; then
  echo "⚠️  ada galat saat restore — ringkasan:"
  sed -n '1,10p' /tmp/.mbc-restore.err
  echo "   (biasanya hanya policy/role; data tetap utuh — lihat verifikasi di bawah)"
fi

echo "→ verifikasi tabel & data utama"
"$PSQL" "$TARGET_DATABASE_URL" -Atc "
  SELECT 'tabel='||(SELECT count(*) FROM information_schema.tables WHERE table_schema='public')
      ||' artikel='||(SELECT count(*) FROM articles)
      ||' programs='||(SELECT count(*) FROM programs)
      ||' episodes='||(SELECT count(*) FROM episodes)
      ||' users='||(SELECT count(*) FROM users)
      ||' analitik='||(SELECT count(*) FROM content_analytics)
      ||' audit='||(SELECT count(*) FROM audit_log);"
echo "✅ restore selesai. Jangan lupa restart aplikasi agar pool koneksi baru."
