#!/usr/bin/env bash
# dev-db.sh — siapkan PostgreSQL lokal untuk MBCINDONESIA.TV (idempotent).
# Mengatasi fakta bahwa sandbox/container sering ME-RESET paket sistem (apt),
# sehingga data dir disimpan di /home/user/mbcdata agar PERSISTEN antar-sesi.
# Pemakaian:  ./scripts/dev-db.sh [--seed]
set -euo pipefail

PGBIN=/usr/lib/postgresql/17/bin
DATA=/home/user/mbcdata
export PGPORT=5432

echo "== 1/5: pastikan PostgreSQL 17 terpasang"
if [ ! -x "$PGBIN/initdb" ]; then
  echo "   memasang postgresql via apt…"
  sudo -n apt-get update -qq
  sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql
fi

echo "== 2/5: init data dir (hanya jika belum ada)"
if [ ! -s "$DATA/PG_VERSION" ]; then
  rm -rf "$DATA"; mkdir -p "$DATA"
  "$PGBIN/initdb" -D "$DATA" -E UTF8 --locale=C.UTF-8 --auth-local=trust --auth-host=scram-sha-256 >/dev/null
  echo "   data dir baru: $DATA"
else
  echo "   data dir sudah ada: $DATA"
fi

echo "== 3/5: jalankan server (hanya jika belum berjalan)"
if ! "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  "$PGBIN/pg_ctl" -D "$DATA" -l "$DATA/server.log" -o "-p $PGPORT -c listen_addresses=127.0.0.1 -k $DATA" start
  sleep 2
else
  echo "   sudah berjalan"
fi

echo "== 4/5: role & database (idempotent)"
"$PGBIN/psql" -h "$DATA" -p $PGPORT -U "$(whoami)" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='mbc') THEN
    CREATE ROLE mbc LOGIN PASSWORD 'mbc_dev_password';
  END IF;
END
$$;
SQL
"$PGBIN/psql" -h "$DATA" -p $PGPORT -U "$(whoami)" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='mbctv'" | grep -q 1 \
  || "$PGBIN/psql" -h "$DATA" -p $PGPORT -U "$(whoami)" -d postgres -c "CREATE DATABASE mbctv OWNER mbc"

echo "== 5/5: skema"
"$PGBIN/psql" "postgres://mbc:mbc_dev_password@127.0.0.1:$PGPORT/mbctv" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/../schema.sql" >/dev/null

if [ "${1:-}" = "--seed" ]; then
  (cd "$(dirname "$0")/.." && node seed.js)
fi

echo "✅ PostgreSQL siap → postgres://mbc:mbc_dev_password@127.0.0.1:$PGPORT/mbctv"
