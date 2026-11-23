#!/usr/bin/env bash
# ops/push-github.sh — satu perintah untuk memasukkan kode ke repo GitHub lalu auto-deploy Vercel.
#
# Pakai:
#   GITHUB_TOKEN=ghp_xxx ./ops/push-github.sh
#   # atau tanpa token (akan ditanya interaktif / kredensial manager)
#   ./ops/push-github.sh
#
# Token yang dibutuhkan: Fine-grained PAT dengan izin **Contents: Read and write**
# pada repo Yudi8377/MBCINDONESIA.TV.
set -euo pipefail

REPO="${REPO:-https://github.com/Yudi8377/MBCINDONESIA.TV.git}"
BRANCH="${BRANCH:-main}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -n "${GITHUB_TOKEN:-}" ]; then
  REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO#https://github.com/}"
else
  REMOTE="$REPO"
fi

echo "→ repo  : $REPO"
echo "→ branch: $BRANCH"

# Pastikan ada identitas commit
git config user.email >/dev/null 2>&1 || git config user.email "deploy@mbcindonesia.tv"
git config user.name  >/dev/null 2>&1 || git config user.name  "MBC Deploy"

# Pastikan semua perubahan ikut
if [ -n "$(git status --porcelain)" ]; then
  echo "→ menyimpan perubahan yang belum di-commit"
  git add -A
  git commit -m "chore: snapshot sebelum push ke GitHub ($(date -u +%Y-%m-%dT%H:%MZ))"
fi

# Pastikan .env tidak pernah ikut
if git ls-files --error-unmatch server/.env >/dev/null 2>&1; then
  echo "!! BERHENTI: server/.env terdeteksi di index git. Jalankan: git rm --cached server/.env"
  exit 1
fi

git branch -M "$BRANCH"
git remote remove origin >/dev/null 2>&1 || true
git remote add origin "$REMOTE"

echo "→ mengirim ke GitHub…"
set +e
git push -u origin "$BRANCH" 2>&1 | sed -E 's#(https://)[^@]*@#\1***@#g'
kode=${PIPESTATUS[0]}
set -e

if [ "$kode" -ne 0 ]; then
  cat <<'MSG'

GAGAL mengirim. Penyebab paling sering:
  • Token tidak punya izin "Contents: Read and write" pada repo ini
  • Repo sudah punya commit lain (riwayat berbeda). Bila memang begitu, jalankan:
        git push -u origin main --force
    (HANYA bila Anda yakin isi repo lama tidak dibutuhkan)
  • Branch default repo bukan "main" → pakai BRANCH=master ./ops/push-github.sh
MSG
  exit "$kode"
fi

echo
echo "✅ Terkirim ke GitHub."
echo "Langkah terakhir (di dashboard Vercel):"
echo "   Project mbcindonesia-tv → Settings → Git → Connect Git Repository → MBCINDONESIA.TV (branch $BRANCH)"
echo "   lalu Deploy. Setelah itu setiap 'git push' otomatis menjadi deploy produksi."
