#!/usr/bin/env bash
# ops/tunnel-otomatis.sh — supervisor tunnel publik yang menyembuhkan diri.
#
# Masalah: quick tunnel trycloudflare.com kadang diputus edge Cloudflare (semua halaman → 530).
# Solusi: skrip ini memantau /api/healthz; bila gagal berturut-turut, tunnel lama dibunuh dan
#         dibuat tunnel BARU. URL terbaru selalu ditulis ke ops/url-terkini.txt.
#
# Pakai: PORT=8080 ./ops/tunnel-otomatis.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8080}"
BIN="${CLOUDFLARED:-/home/user/tools/cloudflared}"
URLFILE="$ROOT/ops/url-terkini.txt"
LOG="$ROOT/ops/tunnel-otomatis.log"
CEK="${CEK:-20}"          # detik antar pemeriksaan
BATAS_GAGAL="${BATAS_GAGAL:-3}"
gagal=0

catat() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }

mulai_tunnel() {
  : > /tmp/cf-auto.log
  "$BIN" tunnel --url "http://127.0.0.1:$PORT" --protocol http2 --no-autoupdate --loglevel info \
      > /tmp/cf-auto.log 2>&1 &
  PID_TUNNEL=$!
  for _ in $(seq 1 40); do
    URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-auto.log | head -1)
    [ -n "${URL:-}" ] && break
    sleep 1
  done
  if [ -z "${URL:-}" ]; then catat "GAGAL membuat tunnel (tidak ada URL)"; return 1; fi
  echo "$URL" > "$URLFILE"
  catat "tunnel baru: $URL (pid $PID_TUNNEL)"
  return 0
}

bersihkan() { [ -n "${PID_TUNNEL:-}" ] && kill "$PID_TUNNEL" 2>/dev/null; }
trap 'bersihkan; exit 0' INT TERM

BACKOFF=15
mulai_tunnel || { catat "tunnel pertama gagal — menunggu ${BACKOFF}s"; sleep "$BACKOFF"; mulai_tunnel || exit 1; }

while true; do
  sleep "$CEK"
  kode=$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$URL/api/healthz" 2>/dev/null)
  [ -n "$kode" ] || kode=000
  if [ "$kode" = "200" ]; then
    gagal=0
  else
    gagal=$((gagal+1))
    catat "tidak sehat: HTTP $kode (berturut $gagal/$BATAS_GAGAL) pada $URL"
    if [ "$gagal" -ge "$BATAS_GAGAL" ]; then
      catat "memutar tunnel karena tidak sehat"
      kill "$PID_TUNNEL" 2>/dev/null
      sleep 2
      gagal=0
      if ! mulai_tunnel; then
        catat "gagal memutar tunnel — backoff ${BACKOFF}s (Cloudflare mungkin menolak sementara)"
        sleep "$BACKOFF"
        BACKOFF=$(( BACKOFF * 2 > 90 ? 90 : BACKOFF * 2 ))
      else
        BACKOFF=15
      fi
    fi
  fi
done
