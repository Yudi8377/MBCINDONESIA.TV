# MBCINDONESIA.TV — Pembangunan dari Blueprint Strategis

**Dokumen sumber:** `uploads/BLUEPRINT STRATEGIS MBCINDONESIA.TV.pdf` (26 hal, Rancangan Strategis untuk Dewan Direksi MBC Indonesia Group).
**Status:** Aplikasi berjalan dengan **backend nyata (Express + PostgreSQL 17)** dan frontend interaktif — tetap **prototipe/demo**, bukan sistem produksi final dan bukan bukti kesiapan operasional penuh (Blueprint §16).

> ⚠️ **Jawaban atas pertanyaan "kenapa saya tidak melihat pekerjaan yang sudah diselesaikan?"**
> Tidak ada pekerjaan sebelumnya yang tersimpan: workspace ini kosong saat sesi dimulai (hanya PDF blueprint yang Anda unggah), tidak ada sesi/agen sebelumnya yang menyimpan artefak, dan screenshot yang Anda maksud **tidak ikut terlampir** pada pesan Anda. Semua yang ada sekarang dibangun dari nol.

---

## 0. Menuju Go-Live (mulai di sini bila ingin deploy)

| Dokumen | Isi |
|---|---|
| **[DATABASE-SUPABASE.md](DATABASE-SUPABASE.md)** | Menyambung ke Supabase: buat proyek → connection string → `node setup-supabase.js` → verifikasi `/api/health` (Neon tetap didukung) |
| **[RESPONSIVE.md](RESPONSIVE.md)** | Perbaikan tampilan Android/tablet/iOS + cara uji (`ops/responsive-audit.js`) |
| **[NEWSROOM.md](NEWSROOM.md)** | Dapur produksi: CMS editorial, alur persetujuan 4 tahap, 9 agen AI, pemandu pengunjung "Nusa", rekomendasi pisah-aplikasi |
| **[STATUS-GO-LIVE.md](STATUS-GO-LIVE.md)** | Ringkasan satu halaman: apa yang sudah selesai, apa yang menunggu MBC, estimasi waktu, risiko terbuka |
| **[GO-LIVE.md](GO-LIVE.md)** | Langkah operasional 10 gerbang: Neon, server, domain+TLS, verifikasi, ganti akun demo, backup harian, Play Store, rollback |
| **[UAT-CHECKLIST.md](UAT-CHECKLIST.md)** | Lembar UAT untuk Direksi (A. website, B. akses/RBAC, C. modul, D. non-fungsional) + kolom tanda tangan §17 |
| `ops/` | `backup.sh` · `restore.sh` · `healthcheck.sh` (18 pemeriksaan) · `check-html.js` · `systemd/` · `nginx/` |
| `server/Dockerfile` + `docker-compose.yml` | Image produksi multi-stage, non-root, healthcheck, tini |
| `.github/workflows/ci.yml` | CI: 45 uji API + Postgres service, audit HTML/PWA/aset, Android build, Docker build |
| Tag `v1.0.0-rc1` | Rilis kandidat yang siap di-UAT |

Verifikasi cepat setelah deploy: `BASE_URL=https://mbcindonesia.tv ./ops/healthcheck.sh` → harus **SEMUA LULUS**.
Drill yang sudah dieksekusi: `pg_dump` 13 tabel → restore ke DB uji → baris identik (`programs=8 episodes=26 users=4 audit=5`).

**Pemulihan cepat database lokal di sandbox/VM baru:** `server/scripts/dev-db.sh` (pasang PG bila hilang, init cluster di `/home/user/mbcdata`, buat role/db, muat schema; tambah `--seed` untuk data contoh).

---

## 1. Isi Paket

```
mbcindonesia/
├── website/                    ← WEBSITE PUBLIK + WEB APP (statis, di-serve oleh Express)
│   ├── index.html              ← Beranda: hero, live strip, katalog VOD dari /api/programs (fallback data statis), newsletter terhubung API
│   ├── watch.html              ← Pemutar video + komentar tersimpan di PostgreSQL + JSON-LD VideoObject
│   ├── live.html               ← Live TV (HLS + fallback), jadwal siaran berjalan, obrolan simulasi
│   ├── 404.html                ← Halaman 404 bermerek
│   ├── manifest.webmanifest    ← PWA (id + shortcuts Live/Program/Workspace) + sw.js + ikon
│   ├── sitemap.xml / robots.txt
│   ├── assets/                 ← CSS, JS, 9 gambar AI
│   ├── berita.html             ← Berita & analisis publik (ringkasan AI + rujukan literasi)
│   ├── assets/js/ai-news.js    ← Mesin analisis berita (klien: ringkasan, sentimen, entitas, pustaka)
│   ├── assets/js/companion.js  ← AI Companion "Nusa" (pemandu pengunjung)
│   └── newsroom/               ← NEWSROOM INTERNAL: CMS editorial + multi-agent AI + cms.js
│                                 (gerbang 401 untuk anonim; tidak ditautkan dari situs publik)
├── server/                     ← BACKEND NYATA (Node 20 + Express 4 + PostgreSQL 17)
│   ├── newsroom-api.js         ← ~40 endpoint /api/newsroom/* (CMS, editorial, AI, moderasi)
│   ├── agents.js               ← Mesin multi-agent AI (9 agen, deterministik)
│   ├── cms-schema.sql          ← 15 tabel editorial (artikel, revisi, approval, AI, analitik)
│   ├── cms-seed.js             ← Data contoh newsroom (idempotent)
│   ├── content-library.json    ← Pustaka rujukan literasi (dipakai agen & pemandu)
│   ├── server.js               ← REST API + static hosting + security headers + rate limit
│   ├── db.js                   ← Pool pg — lokal (default) atau Neon (DATABASE_URL)
│   ├── schema.sql              ← 14 tabel (users, programs, episodes, crm_deals, production_projects,
│   │                             ad_slots, campaigns, invoices, approvals, master_items, audit_log,
│   │                             newsletter_subscribers, comments) — migrasi idempotent
│   ├── seed.js                 ← Data contoh (idempotent; jalankan ulang untuk reset demo)
│   ├── package.json / .env.example
│   └── (README bagian §6 di dokumen ini)
├── android/                    ← APLIKASI ANDROID NATIVE (Kotlin + WebView) — lihat android/README.md
├── ops/                        ← backup.sh, restore.sh, healthcheck.sh, systemd/, nginx/
├── .github/workflows/ci.yml    ← CI/CD (backend+DB, frontend/PWA, Android, Docker)
├── GO-LIVE.md                  ← Runbook deploy produksi
├── UAT-CHECKLIST.md            ← Lembar UAT + sign-off Direksi
└── README.md                   ← Dokumen ini
```

## 2. Cara Menjalankan (satu perintah, backend + frontend)

```bash
cd mbcindonesia/server
npm install
export DATABASE_URL='postgres://mbc:mbc_dev_password@127.0.0.1:5432/mbctv'  # default dev lokal
psql "$DATABASE_URL" -f schema.sql && node seed.js                         # buat tabel + isi contoh
npm start        # → http://localhost:8080/  (internal: /newsroom/)
```

Tanpa server sekalipun (preview statis), seluruh situs tetap berfungsi: katalog memakai data statis, newsletter/komentar menyimpan ke localStorage, dan Newsroom menampilkan pill **MODE OFFLINE**.

**Akun demo** (kata sandi semua `demo123`) — autentikasi server bcrypt + JWT 12 jam, RBAC dipaksakan di API:

| Email | Peran | Akses API |
|---|---|---|
| direktur@mbcindonesia.tv | Direktur Utama | Semua endpoint |
| finance@mbcindonesia.tv | Manager Keuangan | Dasbor, Keuangan (approval), Master Data, Laporan (CSV), Audit |
| sales@mbcindonesia.tv | Account Executive | Dasbor, CRM (CRUD/pindah), Iklan & Sponsorship, Audit |
| redaksi@mbcindonesia.tv | Produser Redaksi | Dasbor, Produksi & Studio, Audit |

## 3. API Ringkas

Publik: `GET /api/health` · `GET /api/programs` · `GET|POST /api/comments` · `POST /api/newsletter`
Auth: `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/password` (ganti sandi sendiri) · `PATCH /api/auth/profile` · `GET /api/state` (payload di-filter per peran)
CRM: `POST /api/crm/deals` · `PATCH /api/crm/deals/:id/stage` · `DELETE /api/crm/deals/:id`
Produksi: `POST /api/produksi/projects` · `POST /api/produksi/projects/:id/advance`
Iklan: `POST /api/ads/campaigns/:id/proof`
Keuangan: `POST /api/keuangan/approvals/:ref` (`approve|reject`) · `POST /api/keuangan/piutang/:inv/remind` · `GET /api/laporan/kpi.csv`
Master: `POST /api/master/:kind` · `DELETE /api/master/:kind/:id` (`klien|vendor|produk`)
Tata kelola: `POST /api/audit` (append-only)

Observabilitas & CI: `GET /api/metrics` (peran `direksi`; uptime, memori, jumlah baris per tabel) · `GET /.well-known/assetlinks.json` (Android App Links — isi fingerprint sebelum rilis) · `node scripts/smoke.js` (45 uji API end-to-end) · `ops/healthcheck.sh` (22 pemeriksaan pasca-deploy) · `node ops/check-html.js` (audit HTML/a11y/tautan) · `BASE_URL=… node ops/responsive-audit.js` (56 kombinasi halaman × perangkat) · tangkapan layar di `docs/screens/`

Semua mutasi menulis **audit_log** di PostgreSQL (siapa, apa, kapan). `GET /api/state` hanya mengembalikan section yang boleh dilihat perannya (uji: token sales → endpoint CSV & Keuangan menjawab **403**).

## 4. Migrasi ke Neon PostgreSQL (Blueprint §9.2)

```bash
# 1. Buat project Neon (region Singapore disarankan untuk Indonesia), salin pooled connection string
# 2. psql "postgres://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/mbctv?sslmode=require" -f schema.sql
# 3. Neon branch terpisah untuk development (Blueprint: branch dev terpisah dari produksi)
# 4. DATABASE_URL=<neon url> JWT_SECRET=<openssl rand -hex 48> npm start
```
`db.js` mendeteksi host Neon dan mengaktifkan SSL otomatis. **Tidak ada** koneksi langsung dari frontend ke database — hanya melalui API.

## 5. Aplikasi Android — dua jalur

1. **PWA (langsung jalan):** Chrome Android → menu ⋮ → *Instal aplikasi* (shortcuts Live/Program/Workspace tersedia).
2. **APK/AAB native:** folder `android/` — WebView HTTPS-only + App Links + layar offline; build di Android Studio (`android/README.md`).

## 6. Pemetaan Blueprint → Implementasi

| Blueprint | Implementasi |
|---|---|
| §6.1 Platform publik (beranda, detail, player responsif, katalog, pencarian, SEO/OG/JSON-LD/sitemap, a11y skip-link, kontras, reduced-motion) | `index.html`, `watch.html`, `live.html`, `404.html`, `sitemap.xml` |
| §6.1 Live streaming | `live.html` (HLS test-stream sebagai contoh; produksi: encoder + CDN resmi) |
| §6.2 Production Studio (brief→naskah→produksi→editing→review→tayang) | Workspace → **Produksi & Studio**, tersimpan di tabel `production_projects` |
| §6.5 AI Multi-Agent (batasan & pengawasan manusia) | Asisten AI internal rule-based, terlabel demo; tidak dapat menyetujui pembayaran/payroll/akses |
| §7.1 Executive Management | **Dasbor Direksi** + strip *Live dari PostgreSQL* (pipeline & approval menunggu dihitung dari DB) |
| §7.2 Master Data (penanggung jawab, jejak perubahan) | **Master Data** (Klien/Vendor/Produk & Harga) → tabel `master_items`, setiap ubah → `audit_log` |
| §7.3 CRM & Sales | **CRM & Pipeline** kanban drag&drop → tabel `crm_deals` (CRUD + pindah tahap via API) |
| §7.4 Accounting/Finance (pemisahan tugas, jejak audit) | **Keuangan**: piutang aging, approval pembayaran (hanya Direksi/Finance; segregation of duties), ekspor CSV |
| §7.7–7.8 Programming & Advertising (pemisahan editorial–iklan, label Berbayar, bukti tayang) | **Iklan & Sponsorship**: inventaris slot, pemenuhan kontrak, unggah bukti tayang → `campaigns.done` |
| §7.9 BI & Reporting (definisi metrik konsisten) | **Laporan & BI** kartu skor KPI; `GET /api/laporan/kpi.csv` di-generate server |
| §8 RBAC, least privilege, segregation of duties, human oversight, audit trail append-only | 4 peran dipaksakan di server (bukan hanya UI); `audit_log` tanpa endpoint hapus |
| §9 Arsitektur (GitHub/Neon/deployment terpisah) | `server/` siap-Neon; GitHub Actions contoh di `android/README.md`; push repo ini sebagai `mbcindonesia-tv` |
| §10 Roadmap (Fase 2–3 demo) | Modul setara Fase 2–3; ERP (akuntansi/payroll penuh) Fase 4 — lihat §7 |
| §13 KPI | Laporan & BI (angka contoh, belum baseline riil) |

## 7. Batasan Jujur & Pekerjaan Lanjutan

1. **Demo, bukan produksi.** Belum ada TLS (terminate di reverse proxy/Cloudflare saat deploy), refresh token, CSRF token (mitigasi: header `Authorization`, bukan cookie), rate-limit berbagi antar-instance (pakai Redis), maupun logging terstruktur/monitoring.
2. **Password demo `demo123`** & `JWT_SECRET` default — WAJIB diganti; hapus akun demo atau paksa ganti password di produksi.
3. **Angka keuangan fiktif** untuk ilustrasi; jurnal akuntansi, posting GL, pajak (PPh/PPN), dan payroll belum diimplementasikan — itu lingkup Fase 4–5 dengan ahli akuntansi & hukum (§7.4–7.5).
4. **Audit trail** sudah append-only di server (tanpa DELETE) — tetapi belum WORM/immutable storage atau eksternal log sink.
5. **Video** memakai sampel publik + HLS test-stream; ganti dengan VOD berlisensi & CDN dengan token. **Gambar** key visual buatan AI; logo adalah rancangan contoh.
6. **Android**: source valid; APK belum di-build di sandbox (tanpa Android SDK). PWA adalah jalur instan.
7. Verifikasi otomatis: 25 smoke test (online ke PostgreSQL + offline fallback) — lihat riwayat; `node seed.js` mengembalikan data demo ke kondisi awal.
8. Sebelum operasional penuh, penuhi 10 kriteria **Blueprint §16** (uji auth server ✓ sebagian via API test, uji keamanan independen, migrasi DB, validasi akuntansi, DR drill, SOP insiden, UAT, persetujuan Direksi).

## 8. Struktur Kerja Produksi yang Disarankan

1. Repo GitHub `mbcindonesia-tv` (branch `main` = produksi terlindungi; PR + review wajib).
2. CI: lint → test → build → deploy preview (e.g., Vercel/Render/Fly.io atau VPS + Caddy/Nginx + PM2) → UAT → produksi.
3. Neon: branch `dev`/`preview` per PR; migrasi via `psql -f` terkontrol (Blueprint §9.3); backup harian + uji restore.
4. Ganti data statis KPI dashboard dengan materialized view dari tabel riil; sambungkan BI (Metabase/Superset) ke replika baca Neon.
5. Integrasi MBCINDONESIA.ID via API terkontrol (Blueprint §4) — **jangan** share database.

---
*Disiapkan sebagai tindak lanjut blueprint, bukan pernyataan kesiapan operasional (catatan status dokumen blueprint, hal. 26). Angka investasi, struktur organisasi final, dan jadwal kontraktual menunggu validasi Dewan Direksi.*

---

## 🌐 Deploy permanen ke Vercel (jalur utama sekarang)

Aplikasi ini sudah disiapkan agar bisa berjalan di Vercel **tanpa mengubah arsitektur**:

| Bagian | Cara kerja di Vercel |
|---|---|
| Situs publik (`website/`) | Disajikan **CDN Vercel** (`outputDirectory: website`) |
| API + `/newsroom/` | Satu serverless function `api/index.js` yang memakai ulang `server/server.js` |
| Database | **Supabase pooler** via env `SUPABASE_DB_URL` (jangan pakai alamat direct — IPv6) |
| Rahasia | Env var Vercel: `SUPABASE_DB_URL`, `JWT_SECRET` (jangan pernah di file) |

**Langkah (5 menit):**
1. Push repo ini ke `https://github.com/Yudi8377/MBCINDONESIA.TV` (branch `main`).
2. Buka https://vercel.com/new → **Import Git Repository** → pilih repo tersebut.
   Framework: **Other** (biarkan deteksi otomatis `vercel.json`).
3. Tambahkan Environment Variables (Production + Preview):
   - `SUPABASE_DB_URL` = `postgresql://postgres.<ref>:<sandi>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
   - `JWT_SECRET` = hasil `openssl rand -hex 48`
   - `APP_VERSION` = `1.5.0`
   - `AKUN_MODE` = `pratayang` (atau `email` bila `AKUN_EMAIL_WEBHOOK` tersedia)
4. **Deploy** → dapat URL `https://mbcindonesia-tv.vercel.app` (permanen, HTTPS otomatis).
5. Cek: `/api/health` harus `db:true` dan `provider:"supabase"`.

> Setiap `git push` ke `main` = deploy otomatis. Rollback cukup satu klik dari dashboard.

### Kalau ingin domain sendiri
Vercel → Project → Settings → Domains → tambah `mbcindonesia.tv`, lalu arahkan nameserver/A-record
sesuai instruksi yang muncul. Tanpa domain sendiri, URL `*.vercel.app` **sudah permanen**.

---

## MBC Single Account (1.5.0)

Satu akun untuk seluruh layanan: pendaftaran, masuk, verifikasi email (OTP), pemulihan akun,
2FA TOTP, dan dasbor anggota di `/akun/`.

| Halaman | Fungsi |
|---|---|
| `/daftar.html` | pendaftaran anggota publik (nama, email, sandi ≥8 huruf+angka, persetujuan S&K) |
| `/masuk.html` | masuk, mendukung 2FA |
| `/lupa.html` | minta kode pemulihan → tetapkan kata sandi baru |
| `/akun/` | dasbor: profil, keamanan, perangkat aktif, status layanan |

**Data disimpan tanpa migrasi wajib:** `users` (identitas + `pass_hash`), `ai_findings` (catatan JSON
`profil`/`sesi`/`otp`/`2fa`), `audit_log` (jejak aktivitas). Akun DB `mbc_app` tidak berhak DDL;
`docs/MIGRASI-1.5.0.sql` opsional untuk struktur relasional.

**Agar kode OTP benar-benar terkirim ke email**, pasang salah satu di Environment Variables:

```
RESEND_API_KEY=re_xxxxxxxx      # kanal utama (Resend, gratis 100 email/hari)
AKUN_EMAIL_DARI=MBC Indonesia <no-reply@mbcindonesia.tv>
AKUN_EMAIL_TERUSAN=halo@mbcindonesia.tv   # salinan untuk bantuan manual (opsional)
```

atau `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS` (butuh paket `nodemailer`), atau `AKUN_EMAIL_WEBHOOK`.
Tanpa kredensial: pendaftaran & masuk tetap berfungsi, verifikasi email dibantu manual oleh dukungan.

**Uji sebelum rilis (jangan di produksi):**

```bash
createdb -h /tmp -p 5433 mbcuji && pg_restore -h /tmp -p 5433 -d mbcuji --no-owner backups/mbc-*.dump
cd server && SUPABASE_DB_URL='postgresql://uji@localhost:5433/mbcuji?host=/tmp' \
  JWT_SECRET=uji AKUN_PRATAYANG_KODE=1 BATAS_KIRIM_JAM=50 node server.js &
JWT_SECRET=uji python3 ops/uji-akun-1.5.0.py       # 54 kasus API
JWT_SECRET=uji python3 ops/uji-ui-akun-1.5.0.py    # 29 kasus UI (Playwright)
```

> `AKUN_PRATAYANG_KODE=1` **hanya** untuk DB uji — memungkinkan skrip membaca kode dari respons.
> Di produksi kode tidak pernah ditampilkan ke publik.
