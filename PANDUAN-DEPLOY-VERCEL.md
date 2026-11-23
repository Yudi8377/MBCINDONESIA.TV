# 🚀 Deploy Vercel — status per 23 Nov 2026 05:40 UTC

## Yang SUDAH selesai (dikerjakan otomatis)

| # | Item | Bukti |
|---|---|---|
| 1 | **Database Supabase hidup kembali** — `uoepuofjitaozrlmxomk` | REST `401`, pooler menerima login, 28 tabel, `articles` 7 baris |
| 2 | **API lokal tersambung ke Supabase** | `/api/health` → `{"ok":true,"db":true,"provider":"supabase","pooler":true,"tls":true}` |
| 3 | **Proyek Vercel dibuat** `mbcindonesia-tv` | `prj_uFBaXNU8q0FH2vqLALEjKxsjL5aN` (team `team_nnTGRBz6Ql1mC0nWiHwJ43vw`) |
| 4 | **Env var produksi terpasang** (terenkripsi) | `SUPABASE_DB_URL`, `JWT_SECRET`, `APP_VERSION=1.4.7` |
| 5 | **Build config siap** | `outputDirectory: website`, `installCommand`, function `api/index.js` + `includeFiles` |
| 6 | **Celah keamanan ditutup** | `/newsroom`, `/newsroom/`, `/newsroom/index.html` → di-rewrite ke function (bukan file statis) sehingga 401 + cookie `mbc_gate` berlaku |

## Yang TERSISA — hanya satu, dan butuh akun Anda

Deploy butuh **sumber kode**. Dua jalur sama-sama tertutup untuk saya:

- **Lewat Git** → akun Vercel belum memasang integrasi GitHub:
  `To link a GitHub repository, you need to install the GitHub integration first`.
  Repo `Yudi8377/MBCINDONESIA.TV` juga masih **0 commit**.
- **Lewat unggahan file langsung (tanpa Git)** → API Vercel menolak:
  `The projectSettings object is required for new projects` — konektor tidak punya parameter untuk itu.

Pilih **satu** dari dua cara berikut.

---

## Cara A — GitHub (paling permanen, auto-deploy tiap push)

**A1.** Pasang integrasi GitHub: buka https://vercel.com/account/login-connections →
**Connect GitHub** → pilih akun `Yudi8377` → beri akses ke repo `MBCINDONESIA.TV`
(atau "All repositories").

**A2.** Masukkan kode ke repo (dari komputer Anda, setelah mengekstrak
`mbc-siap-push/mbcindonesia-tv-siap-push.zip`):

```bash
cd mbcindonesia
git init
git add .
git commit -m "feat: MBCINDONESIA.TV — situs + newsroom + API (siap deploy)"
git branch -M main
git remote add origin https://github.com/Yudi8377/MBCINDONESIA.TV.git
git push -u origin main
```

> Saat diminta sandi, pakai **Personal Access Token** (GitHub → Settings → Developer settings →
> Fine-grained token → repo `MBCINDONESIA.TV` → **Contents: Read and write**).

**A3.** Hubungkan repo ke proyek yang sudah ada: https://vercel.com/`<team>`/mbcindonesia-tv/settings/git
→ **Connect Git Repository** → pilih `MBCINDONESIA.TV`, branch `main`.

**A4.** Tekan **Deploy** (atau cukup `git push` berikutnya). URL permanen:
`https://mbcindonesia-tv.vercel.app`. Env var & pengaturan sudah terpasang — **jangan diubah**.

---

## Cara B — Tanpa GitHub (CLI, ±2 menit)

Buat token Vercel: https://vercel.com/account/tokens → **Create Token** (scope team Anda, expiry 7 hari).

Di komputer Anda (Node 20+), folder hasil ekstrak ZIP:

```bash
npm i -g vercel
cd mbcindonesia
vercel login                       # atau: ekspor VERCEL_TOKEN=<token>
vercel link --yes --project mbcindonesia-tv --scope <slug-team-anda>
vercel deploy --prod
```

Saat ditanya:
- *Set up and deploy?* → **Y**
- *Link to existing project?* → **Y** → `mbcindonesia-tv`
- *Want to modify settings?* → **N** (semua sudah di `vercel.json`)

Kalau CLI memaksa membuat proyek baru, hapus dulu yang lama atau pakai nama `mbcindonesia-tv-2`
lalu salin env var (`vercel env pull` / **Settings → Environment Variables**).

---

## Monitor uptime (opsional tapi disarankan)

Setelah live, pantau **`https://<domain>/api/healthz`** (selalu 200, tanpa DB) di
UptimeRobot/BetterStack tiap 5 menit. Pantau `/api/health` lebih jarang (mis. 30 menit) karena
endpoint itu benar-benar menyentuh database.

## Verifikasi setelah live (wajib, 5 perintah)

```bash
D=https://mbcindonesia-tv.vercel.app
curl -s $D/api/health        # {"ok":true,"db":true,"provider":"supabase","tls":true}
curl -s $D/api/status        # counts: artikel 7, tayang 2, pengguna 4, program 8
curl -o /dev/null -w '%{http_code}\n' $D/                    # 200
curl -o /dev/null -w '%{http_code}\n' $D/newsroom/           # 401  ← CMS tetap tertutup
curl -s -X POST $D/api/newsroom/gate -H 'Content-Type: application/json' \
  -d '{"email":"direktur@mbcindonesia.tv","password":"demo123"}'   # {"ok":true,...}
```

Login 4 peran (sandi `demo123`) di `$D/newsroom/gerbang.html`:
`direktur@` (direksi) · `redaksi@` (editorial) · `finance@` (finance) · `sales@` (sales).
**Ganti sandi sebelum dipublikasikan luas**: `node ops/audit-akun.js --ganti` dengan `SUPABASE_DB_URL` aktif.

---

## Kalau deploy gagal — kirim 3 hal ini ke saya

1. Teks error di **Deployments → Build Logs**.
2. Hasil `curl -s https://<domain>/api/health`.
3. Status proyek Supabase di dashboard (ACTIVE_HEALTHY / paused).

Saya lanjutkan: perbaiki config, setel ulang env, migrasi data, dan uji RBAC 4 peran di URL produksi.

---

## Link sementara yang aktif sekarang (terverifikasi)

`https://comparing-thesaurus-mails-manga.trycloudflare.com`

- DNS publik (DoH Cloudflare) → `104.16.230.132`, `104.16.231.132`
- Judul halaman dari server luar (`r.jina.ai`) → **"MBC INDONESIA — Televisi Digital Indonesia"**
- `/`, `/berita.html`, `/watch.html`, `/live.html`, `/newsroom/gerbang.html` → 200
- `/api/health` → `provider: supabase`, `/api/status` → 7 artikel / 4 pengguna / 8 program
- Login 4 peran → token JWT terbit ✅

Tunnel ini akan **berubah** bila proses di sandbox berhenti; URL Vercel di atas bersifat permanen.
