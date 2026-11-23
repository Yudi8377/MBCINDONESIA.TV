# MBCINDONESIA.TV — Server API

Express 4 + PostgreSQL 17. Lihat `../README.md` untuk gambaran lengkap,
`../GO-LIVE.md` untuk runbook deploy, dan `../UAT-CHECKLIST.md` untuk lembar uji.

## Perintah

```bash
npm install
npm run db:setup                    # pasang PG bila perlu, init cluster, role/db, muat schema (idempotent)
npm run db:seed                     # isi data contoh (idempotent — reset demo)
npm start                           # http://0.0.0.0:8080  (newsroom: /newsroom/)
npm run dev                         # node --watch (restart otomatis)
npm run smoke                       # 45 uji API end-to-end (butuh DB mbctv_ci; lihat .github/workflows/ci.yml)
```

Produksi: `NODE_ENV=production node server.js` — server **menolak start** bila `JWT_SECRET` kosong.

## Environment

| Variabel | Default | Keterangan |
|---|---|---|
| `NODE_ENV` | `development` | `production` → wajib `JWT_SECRET`, log lebih ringkas |
| `DATABASE_URL` | `postgres://mbc:mbc_dev_password@127.0.0.1:5432/mbctv` | Lokal dev. Produksi: URL **Neon** dengan `?sslmode=require` (SSL otomatis) |
| `JWT_SECRET` | acak sementara (dev) | WAJIB di produksi: `openssl rand -hex 48` |
| `PORT` | `8080` | Port HTTP |
| `PG_POOL_MAX` | `10` | Maks. koneksi pool |

`.env` dibaca otomatis oleh loader minimal di `server.js` (tanpa dependensi). File ini
**tidak boleh** di-commit (sudah masuk `.gitignore` dan `.dockerignore`). Contoh: `.env.example`, `.env.production.example`.

## Endpoint penting

| Endpoint | Akses | Fungsi |
|---|---|---|
| `GET /api/health` | publik | liveness + status DB (`{"ok":true,"db":true}`) |
| `GET /api/programs` · `GET|POST /api/comments` · `POST /api/newsletter` | publik | konten situs |
| `POST /api/auth/login` · `GET /api/auth/me` | publik / token | JWT 12 jam |
| `POST /api/auth/password` · `PATCH /api/auth/profile` | token | ganti sandi sendiri (min. 10 char, `demo123` ditolak) & ubah nama/email |
| `GET /api/state` | token | snapshot data, **difilter per peran** |
| `GET /api/metrics` | `direksi` | uptime, memori, jumlah baris tiap tabel |
| `GET /api/laporan/kpi.csv` | `direksi`, `finance` | ekspor CSV |
| `GET /.well-known/assetlinks.json` | publik | Android App Links (isi SHA-256 rilis) |
| mutasi CRM / Produksi / Iklan / Keuangan / Master / Audit | per peran | semua menulis `audit_log` |
| `/api/newsroom/*` (~40 endpoint) | `editorial`, `direksi` saja | CMS artikel, alur persetujuan, kalender, media, analitik, moderasi |
| `/api/newsroom/ai/*` | `editorial`, `direksi` | 9 agen AI: run, pipeline, sweep, findings, antrean job |
| `POST /api/newsroom/gate` | publik (rate-limited) | login halaman gerbang; set cookie `HttpOnly` `mbc_gate` |
| `GET /api/newsroom/public-list` · `/public/:slug` | publik | artikel tayang untuk situs publik |

## Keamanan & ketahanan yang sudah terpasang

- bcrypt + JWT 12 jam; RBAC dipaksakan **di server** pada setiap endpoint mutasi.
- Rate limit: login 20×/5 menit/IP, komentar 30×/jam/IP (in-memory; multi-instance → Redis).
- Header: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Content-Security-Policy`.
- `compression` gzip (aset CSS/JS/HTML ~11,8 KB → ~4,3 KB) · `trust proxy` untuk IP asli di balik nginx.
- Error 500 tidak membocorkan stack; `/api/*` tak dikenal → JSON 404.
- Graceful shutdown SIGTERM/SIGINT: `server.close()` → `pool.end()`, paksa keluar setelah 10 dtk.
- Audit log **append-only**: tidak ada endpoint DELETE untuk audit.
- `npm audit` = **0 kerentanan** (target: tanpa high/critical).
- Backup/restore teruji: `../ops/backup.sh`, `../ops/restore.sh` (checksum + verifikasi jumlah baris).

## Catatan produksi

- Akun seed `*@mbcindonesia.tv` / `demo123` **wajib** diganti sebelum domain publik (GO-LIVE §5).
- Untuk skala multi-instance: pindahkan rate limit ke Redis, JWT ke cookie `HttpOnly; SameSite=Lax`, dan tambahkan WAF/CDN.
- Container: `docker compose up -d --build` (image multi-stage, user non-root, healthcheck, tini) — `../ops/systemd/` dan `../ops/nginx/` untuk jalur VPS.
