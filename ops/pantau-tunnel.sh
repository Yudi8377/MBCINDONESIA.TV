#!/usr/bin/env bash
# ops/pantau-tunnel.sh — catat SETIAP gangguan tunnel ke CSV agar bisa diukur, bukan dikira-kira.
# Pakai: URL=https://xxx.trycloudflare.com INTERVAL=10 DURASI=600 ./ops/pantau-tunnel.sh
set -uo pipefail
URL="${URL:?URL publik belum diisi}"
INTERVAL="${INTERVAL:-10}"
DURASI="${DURASI:-600}"
CSV="${CSV:-/tmp/pantau-tunnel.csv}"
[ -f "$CSV" ] || echo "waktu,kode,ms" > "$CSV"
mulai=$(date +%s); total=0; gagal=0
while [ $(( $(date +%s) - mulai )) -lt "$DURASI" ]; do
  t0=$(date +%s%3N)
  kode=$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$URL/api/healthz" 2>/dev/null)
  [ -n "$kode" ] || kode=000
  t1=$(date +%s%3N)
  echo "$(date -u +%H:%M:%S),$kode,$((t1-t0))" >> "$CSV"
  total=$((total+1)); [ "$kode" = "200" ] || gagal=$((gagal+1))
  sleep "$INTERVAL"
done
echo "== $total permintaan, $gagal gagal ($(awk "BEGIN{printf \"%.1f\", $gagal*100/$total}")%)"
echo "== kode yang muncul:"; tail -n +2 "$CSV" | cut -d, -f2 | sort | uniq -c | sort -rn
