#!/usr/bin/env bash
# ops/jaga-tunnel.sh — penjaga tunnel publik.
#
# Tujuan: quick tunnel bisa "tidur" lalu dicabut server setelah idle. Skrip ini
# menembak URL publik setiap INTERVAL detik sehingga koneksi tetap aktif, dan
# melaporkan segera bila URL tidak sehat.
#
# Pakai: URL=https://xxx.trycloudflare.com ./ops/jaga-tunnel.sh
set -uo pipefail

URL="${URL:?URL publik belum diisi}"
INTERVAL="${INTERVAL:-50}"
LOG="${LOG:-/tmp/jaga-tunnel.log}"
gagal=0

echo "[$(date -u +%H:%M:%S)] penjaga mulai → $URL (tiap ${INTERVAL}s)" | tee -a "$LOG"

while true; do
  kode=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL/api/status" 2>/dev/null)
  [ -n "$kode" ] || kode=000
  if [ "$kode" = "200" ]; then
    gagal=0
  else
    gagal=$((gagal + 1))
    echo "[$(date -u +%H:%M:%S)] ⚠️  tidak sehat: HTTP $kode (gagal berturut: $gagal)" | tee -a "$LOG"
  fi
  # verifikasi isi sesekali, bukan hanya kode HTTP
  if [ $((RANDOM % 20)) -eq 0 ]; then
    judul=$(curl -s --max-time 20 "$URL/" | grep -o '<title>[^<]*' | head -1 | sed 's/<title>//')
    echo "[$(date -u +%H:%M:%S)] cek isi: ${judul:-TIDAK ADA JUDUL}" | tee -a "$LOG"
  fi
  sleep "$INTERVAL"
done
