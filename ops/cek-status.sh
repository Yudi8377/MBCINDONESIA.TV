#!/usr/bin/env bash
# ops/cek-status.sh — pantau /api/status dan kirim peringatan bila tidak sehat.
#
# Dipanggil systemd timer (5 menit) atau cron. Keluar != 0 bila gagal sehingga
# systemd menandai unit "failed" (bisa dihubungkan ke alerting apa pun).
#
# Variabel (EnvironmentFile /etc/mbcindonesia/backup.env):
#   BASE_URL          default http://127.0.0.1:8080
#   ALERT_WEBHOOK     opsional: URL webhook (Slack/Discord/Telegram gateway) untuk notifikasi
#   AMBANG_5XX        default 5   — jumlah error 5xx yang dianggap perlu perhatian
#   AMBANG_LATENSI    default 2000 (ms) — latensi DB yang dianggap lambat
set -uo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
AMBANG_5XX="${AMBANG_5XX:-5}"
AMBANG_LATENSI="${AMBANG_LATENSI:-2000}"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT

CODE=$(curl -s -o "$TMP" -w '%{http_code}' --max-time 15 "$BASE_URL/api/status" 2>/dev/null)
[ -n "$CODE" ] || CODE=000
BODY="$(cat "$TMP")"

lapor() {  # $1 = judul, $2 = detail
  echo "❌ $1 — $2"
  if [ -n "${ALERT_WEBHOOK:-}" ]; then
    curl -s -o /dev/null --max-time 10 -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\"⚠️ MBCINDONESIA.TV: $1 — $2\"}" "$ALERT_WEBHOOK" || true
    echo "   (webhook dikirim)"
  fi
  exit 1
}

[ "$CODE" = "200" ] || lapor "service tidak sehat" "HTTP $CODE dari $BASE_URL/api/status"

baca() { printf '%s' "$BODY" | sed -n "s/.*\"$1\":\([0-9]*\).*/\1/p"; }
DB_OK=$(printf '%s' "$BODY" | grep -c '"db":{"ok":true')
LAT=$(printf '%s' "$BODY" | sed -n 's/.*"latency_ms":\([0-9]*\).*/\1/p' | head -1)
ERR=$(baca err5xx)
LAMBAT=$(baca request_lambat)
ART=$(baca artikel)
UPTIME=$(baca uptime_s)

[ "$DB_OK" -ge 1 ] || lapor "database tidak terjangkau" "$(printf '%s' "$BODY" | head -c 200)"
[ "${LAT:-0}" -le "$AMBANG_LATENSI" ] || lapor "latensi DB tinggi" "${LAT} ms > ${AMBANG_LATENSI} ms"
[ "${ERR:-0}" -lt "$AMBANG_5XX" ] || lapor "banyak error 5xx" "${ERR} respons 5xx sejak start"

echo "✅ sehat · db ${LAT} ms · 5xx ${ERR:-0} · lambat ${LAMBAT:-0} · artikel ${ART:-?} · uptime ${UPTIME:-?}s"
