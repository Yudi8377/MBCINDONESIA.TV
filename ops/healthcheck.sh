#!/usr/bin/env bash
# ops/healthcheck.sh — pemantauan ringkas pasca-deploy (cocok untuk cron / uptime checker).
# Pakai: BASE_URL=https://mbcindonesia.tv ./ops/healthcheck.sh
set -uo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
FAIL=0

check() { # nama, url, harapan_status
  local code
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$2" || echo 000)
  if [ "$code" = "$3" ]; then printf 'PASS  %-38s %s\n' "$1" "$code";
  else printf 'FAIL  %-38s %s (harap %s)\n' "$1" "$code" "$3"; FAIL=$((FAIL+1)); fi
}

echo "== healthcheck $BASE_URL — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
check "/ (beranda)"                     "$BASE_URL/"                          200
check "/watch.html"                     "$BASE_URL/watch.html"                200
check "/live.html"                      "$BASE_URL/live.html"                 200
check "/privasi.html"                   "$BASE_URL/privasi.html"              200
check "/syarat.html"                    "$BASE_URL/syarat.html"               200
check "/newsroom/ (anonim → 401)"       "$BASE_URL/newsroom/"                 401
check "/berita.html"                    "$BASE_URL/berita.html"               200
check "/api/newsroom/public-list"        "$BASE_URL/api/newsroom/public-list"  200
check "/newsroom/ (harus noindex)"       "$BASE_URL/newsroom/"                 401
check "/api/health"                     "$BASE_URL/api/health"                200
check "/manifest.webmanifest"           "$BASE_URL/manifest.webmanifest"      200
check "/sw.js"                          "$BASE_URL/sw.js"                     200
check "/sitemap.xml"                    "$BASE_URL/sitemap.xml"               200
check "/robots.txt"                     "$BASE_URL/robots.txt"                200
check "/.well-known/assetlinks.json"    "$BASE_URL/.well-known/assetlinks.json" 200
check "/halaman-tidak-ada (harus 404)"  "$BASE_URL/halaman-tidak-ada"         404
check "/api/tidak-ada (JSON 404)"       "$BASE_URL/api/tidak-ada"             404

echo "== keamanan header"
H=$(curl -sI -m 10 "$BASE_URL/" | tr -d '\r')
for h in "x-content-type-options" "referrer-policy" "permissions-policy" "content-security-policy"; do
  if echo "$H" | grep -qi "^$h:"; then echo "PASS  header $h"; else echo "FAIL  header $h tidak ada"; FAIL=$((FAIL+1)); fi
done
if [ "${BASE_URL%%:*}" = "https" ]; then
  if echo "$H" | grep -qi '^strict-transport-security:'; then echo "PASS  header HSTS"; else echo "FAIL  HSTS wajib di HTTPS"; FAIL=$((FAIL+1)); fi
fi

echo "== kompresi"
ENC=$(curl -s -o /dev/null -m 10 -H 'Accept-Encoding: gzip' -w '%{size_download}' -D - "$BASE_URL/assets/css/site.css" | grep -i 'content-encoding' | tr -d '\r')
[ -n "$ENC" ] && echo "PASS  gzip aktif ($ENC)" || echo "⚠️  gzip tidak terdeteksi di /assets/css/site.css"

echo "== isi /api/health"
curl -s -m 10 "$BASE_URL/api/health"; echo

echo "-------------------------------------------"
[ "$FAIL" -eq 0 ] && echo "✅ SEMUA PEMERIKSAAN LULUS" || echo "❌ $FAIL pemeriksaan gagal"
exit "$FAIL"
