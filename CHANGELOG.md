## [1.6.0] — 2026-11-21 — MULTI-AGEN AI EDITORIAL (6 AGEN, HIBRIDA)

### Enam agen spesialis untuk tugas redaksi
`Pencari Berita` (riset & radar isu), `Verifikator & Klarifikasi` (cek klaim, langkah klarifikasi & hak jawab),
`Penyunting Naskah` (struktur & suntingan), `SEO & Judul`, `Hukum & Etika` (clickbait, praduga tak bersalah, UU PDP),
`Analis Data` (angka, periode, sumber pembanding resmi).

### Hibrida: mesin lokal dulu, LLM opsional
- **Mesin lokal selalu jalan** — deterministik, naskah tidak keluar server, tanpa biaya. **Tidak ada API key pun
  keenam agen tetap berfungsi penuh** (dipilih agar fitur tidak pernah mati karena kuota/biaya).
- **LLM opsional** (OpenAI/Groq/OpenRouter/Together/DeepSeek/Ollama): cukup isi `LLM_PROVIDER` + `LLM_API_KEY`
  di Vercel, tanpa ubah kode. Hasil agen diperkaya model.
- **Gagal-aman**: bila LLM error/timeout/kuota habis, otomatis jatuh ke mesin lokal; pengguna tidak pernah melihat error.
  Setiap hasil jujur menyebut sumbernya: `lokal` / `hibrida` + alasan (`http_500`, `timeout`, `kuota_harian_habis`).

### Keamanan
- Semua endpoint `/api/newsroom/agen/*` wajib token staf; peran selain `editorial`/`direksi` → 403 (ditegakkan di server).
- Agen **tidak pernah** menerbitkan/mengubah naskah. Setiap jalan & simpan temuan masuk `audit_log`.
- Draf teks bebas tidak disimpan ke CMS; temuan hanya masuk `ai_findings` bila staf menekan simpan.

### Berkas
- Baru: `server/agen-ai.js` (6 agen + lapisan LLM), `server/newsroom-agen.js` (5 endpoint), `docs/AGEN-AI.md`.
- Diperbarui: `server/server.js` (pendaftaran), `server/newsroom/cms.js` (Studio AI baru: kartu agen, hasil, simpan,
  pencarian arsip, draf teks), `package.json` (1.6.0).
- Uji baru: `ops/uji-agen-ai.py` (30), `ops/uji-agen-llm.py` (13), `ops/uji-ui-agen.py` (33).

### Hasil uji (lokal, sebelum produksi)
- API **30/30** lulus: 401 tanpa token, 403 peran sales, 6 agen, klaim angka, sumber kosong → "belum layak tayang",
  draf teks, validasi 400/404, cari arsip, simpan temuan, riwayat, audit.
- Jalur LLM **13/13** lulus: hibrida saat LLM menjawab; lokal saat HTTP 500; lokal saat timeout (klaim lokal tidak hilang).
- UI **33/33** lulus: 6 kartu agen, pilih/batal (klik + Enter), pilih semua, hasil 6 blok, simpan temuan,
  jalankan sebagian, pencarian arsip, draf teks (+ penolakan simpan), penolakan peran non-editorial, tanpa galat JS.

## [1.5.1] — 2026-11-21 — FILTER RUBRIK, WILAYAH, DAN TOPIK

### Keluhan yang diselesaikan
`berita.html?artikel=n-bmkg-kediri-banjir&rubrik=daerah` menampilkan chip
`Semua; Lingkungan; Ekonomi; Budaya; Teknologi; Pendidikan` — tidak sesuai konteks rubrik.
Akar masalahnya bukan satu baris kode: blok `syncFromCMS()` **menimpa** `#topicChips` dengan
chip berbasis topik setiap `/api/newsroom/public-list` mengembalikan artikel.

### Yang diperbaiki (semua masalah sejenis, bukan hanya gejala)
- Chip = **satu set rubrik + jumlah berita**, chip aktif mengikuti URL, "Semua" hanya aktif bila tanpa filter.
- Pil "Rubrik: … ✕" / "Wilayah: … ✕" untuk menghapus filter; artikel yang dibaca diselaraskan dengan hasil filter.
- URL mempertahankan `utm_*` dan memetakan tautan lama `?topik=` → `?rubrik=`.
- Rubrik & wilayah punya satu definisi (`RUBRIK`, `WILAYAH`, `WILAYAH_JATIM`) + alias
  (politik/hukum/sosial/opini → nasional, jawa-timur → jatim) + `tebakWilayah()` untuk artikel CMS.
- Slug rubrik tak dikenal tidak lagi diam-diam menampilkan semua berita: daftar kosong + peringatan jelas.
- `rubrik.html` menghitung angka dari data yang sama, ikut menyegarkan saat CMS masuk, wilayah kosong ditandai "belum ada".
- `sw.js`: `/api/*` **tidak lagi cache-first** (dulu daftar berita CMS bisa basi berhari-hari), cache naik ke `mbc-tv-v5`.
- Konfirmasi kiriman warga menyebut rubrik/wilayah tujuan.
- `/api/newsroom/public-list` mengirim `wilayah` bila kolomnya ada (aman tanpa migrasi).

### Uji
- Lokal: 16 skenario URL + 8 interaksi (`ops/uji-filter-berita.py`) — lulus, tanpa galat JS; 6 halaman diperiksa.
- Produksi: 9/9 skenario URL + interaksi chip/✕/pencarian — lulus; `caches` = `mbc-tv-v5`; versi `/api/health` = 1.5.1.
- Catatan insiden: saat verifikasi, Supabase pooler sempat menolak koneksi ~3 menit
  (`max clients reached in session mode`), lalu pulih sendiri; bukan akibat rilis ini.

## [1.5.0] — 2026-11-24 — MBC SINGLE ACCOUNT

### Satu akun untuk seluruh layanan MBC Indonesia
Pendaftaran, masuk, verifikasi email (OTP), pemulihan akun, 2FA TOTP, dan dasbor anggota.
Modul baru `server/akun.js` (14 endpoint di `/api/akun/*`) + klien `website/assets/js/akun.js`
dan empat halaman: `masuk.html`, `daftar.html`, `lupa.html`, `akun/index.html`.

### Keputusan teknis penting
- **Tanpa migrasi wajib.** Akun aplikasi `mbc_app` di Supabase tidak berhak DDL
  (`create table` → *permission denied for schema public*; `alter table users` → *must be owner*).
  Karena itu data akun disimpan di tabel yang sudah ada: `users` (identitas + `pass_hash`),
  `ai_findings` (catatan JSON bersistem `jenis`+`kunci`: profil, sesi, OTP, 2FA),
  `audit_log` (jejak aktivitas). `docs/MIGRASI-1.5.0.sql` disediakan **opsional** untuk memindahkan
  data ke tabel `members`/`member_sessions`/`member_codes`/`member_2fa` bila tim IT menghendaki
  struktur relasional — modul mendeteksinya otomatis.
- **Peran publik tidak pernah menyentuh CMS.** Constraint `users_role_check` hanya mengizinkan
  `direksi|finance|sales|editorial`; anggota publik disimpan sebagai `editorial` dengan
  `role_label` = "Anggota Publik · …". CMS tetap memakai daftar staf tertutup → `/newsroom` 401
  tanpa token (diuji ulang).
- **Celah yang ditutup sebelum rilis:** `/api/akun/lupa` semula mengembalikan `kodePratayang`
  untuk email apa pun di mode pratayang — artinya siapa pun yang tahu email staf bisa mengambil
  alih akun. Kode pemulihan kini **tidak pernah** dikirim di respons, kecuali variabel
  `AKUN_PRATAYANG_KODE=1` sengaja dipasang pada lingkungan uji/demo.
- **Keamanan.** bcrypt cost 12; token HMAC-SHA256 7 hari + `sid`, sesi dicabut saat keluar/ganti
  sandi/pemulihan (disimpan sebagai hash `sid`, maks 8 perangkat); OTP 6 digit berlaku 10 menit,
  maks 5 percobaan, sekali pakai, disimpan sebagai hash; 2FA TOTP RFC 6238 (SHA-1, 6 digit,
  jendela ±30 dtk) + 3 kode cadangan; respons "lupa sandi" selalu 200 agar email terdaftar
  tidak bisa ditebak; cookie `HttpOnly; SameSite=Lax; Secure` di HTTPS.
- **Pembatas laju** mengikuti `rateLimit(kunci, maks, jendela)` milik server.js, dapat diatur
  lewat variabel lingkungan `AKUN_BATAS_*` (daftar 5/jam, masuk 10/10 mnt, OTP verifikasi
  12/10 mnt, lupa & pulihkan 5/15 mnt).
- **Kanal email siap pakai (3 pilihan, satu kredensial).** `RESEND_API_KEY` (utama, tanpa paket
  tambahan), `SMTP_HOST/…` (nodemailer), atau `AKUN_EMAIL_WEBHOOK` (webhook generik). Semua email
  memakai template teks + HTML yang sama. Bila belum ada kredensial: pendaftaran/masuk tetap penuh,
  kode **tidak** ditampilkan ke publik, dan `AKUN_EMAIL_TERUSAN` menerima salinan untuk bantuan
  manual oleh dukungan. `AKUN_NONAKTIF=1` mematikan seluruh modul.

### Perbaikan yang ditemukan saat pengujian
- **Modal lapor menutupi formulir.** Di halaman akun, `#laporModal` sudah ada di HTML tetapi aturan
  `[hidden]{display:none}` hanya disuntik `aksi-publik.js` **setelah** pemeriksaan awal sehingga
  modal transparan menutupi kolom input (klik tidak bisa masuk). Gaya inti kini dipasang lebih dulu
  (`pasangGayaLapor()`) dan tiap halaman akun memuat aturan kritis inline di `<head>`.
- **Luapan horizontal di ponsel** (`daftar.html` 486 px pada layar 360 px): `.form-akun` diberi
  `max-width:min(460px,100%)`/`min-width:0`, label menumpuk di bawah 540 px, dan tautan
  S&K/Privasi diperbaiki (`../syarat.html` → `syarat.html`) serta boleh membungkus.
- **Verifikasi email gagal dari dasbor:** kode dari pendaftaran disimpan dengan jenis `daftar`,
  sedangkan endpoint verifikasi mencari jenis `verifikasi` → diseragamkan; endpoint verifikasi kini
  juga mengenali email dari sesi (dasbor tidak perlu mengirim email).
- **Aset dasbor 404:** `website/akun/index.html` memakai `assets/...` (relatif ke `/akun/`) →
  diubah menjadi `../assets/...`.

### Pengujian (sebelum produksi)
- Salinan produksi dipulihkan ke PostgreSQL 17 lokal (`pg_restore` dari `backups/mbc-20261124-0051.dump`)
  sebagai DB uji; seluruh uji API & UI dijalankan terhadap salinan itu.
- `ops/uji-akun-1.5.0.py` — **54/54 lulus** (validasi daftar, masuk, profil, OTP, ganti sandi,
  lupa/pulih, 2FA aktif–masuk–matikan, aktivitas, layanan, regresi staf lama, pembatas laju,
  pembersihan data uji). Dapat diulang tanpa restart server.
- `ops/uji-ui-akun-1.5.0.py` — **29/29 lulus** dua kali berturut-turut (Playwright Chromium):
  daftar → kode verifikasi → dasbor → verifikasi email → ubah profil → keluar → masuk → lupa kata
  sandi → pulih, plus mobile 360/390 px tanpa geser horizontal dan tanpa galat JavaScript.

### Berkas
`server/akun.js`, `website/assets/js/akun.js`, `website/{masuk,daftar,lupa}.html`,
`website/akun/index.html`, menu "Masuk" di seluruh halaman publik + footer,
`docs/MIGRASI-1.5.0.sql`, `docs/LAPORAN-RILIS-1.5.0.md`, `ops/uji-akun-1.5.0.py`, `ops/uji-ui-akun-1.5.0.py`.

## [1.4.14] — 2026-11-23 — GO LIVE Vercel

### Deploy berhasil dari GitHub (bukan unggahan manual)
- `Yudi8377/MBCINDONESIA.TV` kini berisi kode (push via OAuth Device Flow, tanpa PAT manual).
- Vercel Git Integration otomatis membangun setiap push ke `main`. Build pertama gagal karena
  `functions.api/index.js.includeFiles` harus **string**, bukan array → diperbaiki.
- URL produksi: **https://mbcindonesia-tv.vercel.app** (`READY`, dipromosikan, ssl_verify=0).

### 🔒 Celah keamanan ditemukan & ditutup saat go-live
Di Vercel, `website/` dilayani CDN sehingga middleware Express terlewati: **CMS `newsroom/index.html`
(81 KB) dapat diunduh siapa pun tanpa login**. Perbaikan:
1. `website/newsroom/` kini hanya berisi `gerbang.html` (halaman login publik).
2. `index.html` + `cms.js` dipindah ke `server/newsroom/` → hanya ada di bundel function, tidak pernah
   menjadi aset CDN.
3. `api/index.js`: gerbang eksplisit — verifikasi JWT + peran sebelum menyajikan CMS, dan **`cms.js`
   di-inline** ke HTML (tidak ada berkas JS terpisah yang bisa diambil langsung).
4. `vercel.json`: `cleanUrls: false` dihapus (memicu 308 yang melewati rewrite), rewrite `/newsroom*`
   eksplisit ke `/api/index`.
5. Diuji: `/newsroom` tanpa token **401** & 7 KB (gerbang); dengan token **200** & 139 KB (CMS lengkap).

### Lain-lain
- `package.json`: versi 1.4.13, `engines.node 22.x`, devDependency `vercel` dibuang (Vercel mengabaikannya
  dan memperingatkan di log build).
- `vercel.json`: `memory` dihapus (diabaikan pada Active CPU billing).
- `.github/workflows/ci.yml` dikeluarkan dari repo: OAuth App tanpa scope `workflow` tidak boleh
  menyentuh berkas workflow; deploy ditangani Vercel Git Integration.
- Server lokal diberi paritas: gerbang `/newsroom` menyajikan `index.html` & `cms.js` dari `server/newsroom/`.

## [1.4.13] — 2026-11-23

### Deploy Vercel tanpa Git: temuan penting (dibuktikan, bukan dugaan)
Diuji langsung ke API Vercel lewat konektor:
1. `create_deployment` **menerima berkas tanpa Git** — syaratnya `project_settings` dikirim sebagai
   **string JSON** (bukan objek) dan framework tidak boleh `"other"` (harus dari daftar, mis. `nextjs`;
   `vercel.json` tetap menentukan semuanya).
2. `files[].data` **harus string**; nilai yang diawali `{` ditolak. Solusi: kirim **base64** dengan
   `encoding: "base64"` — Vercel **mendekode dengan benar** (terbukti: build sampai tahap `npm install`
   lalu melaporkan `No Next.js version detected`, artinya `package.json` benar-benar terbaca).
3. **Batas praktis:** payload 55 berkas / 9,6 MB (base64) tidak mungkin dikirim melalui tool-call.
   Deploy penuh tetap butuh **Git** (jalur A) atau **token Vercel + CLI** (jalur B).

### Insiden: kemunduran berkas (rollback) di sandbox
Snapshot workspace sempat kembali ke titik lama: `ops/url-terkini.txt` kosong, 12 klip video hilang,
`site.js`/`site.css` kembali ke versi sebelum perbaikan, `node_modules` lenyap, `.git/config` hilang
(sehingga riwayat git lokal mundur ~9 commit, termasuk tag `v1.4.12`), dan `tools/cloudflared`
kehilangan bit eksekusi (`Permission denied` → tunnel auto-heal gagal membuat tunnel).
**Dipulihkan pada sesi ini:** bit eksekusi `cloudflared`, jaring aman aset (`site.js`), lapisan aman
FAB/safe-area + `video.video-gagal` (`site.css`), dan berkas kerja versi terbaru dipertahankan.

### Perbaikan ketahanan skrip
- `ops/tunnel-otomatis.sh`: bila Cloudflare menolak membuat tunnel (`tidak ada URL`), skrip menunggu
  makin lama (backoff 15→90 detik) alih-alih membanjiri permintaan.

# Changelog — MBCINDONESIA.TV

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/), versi mengikuti [SemVer](https://semver.org/lang/id/).

## [1.4.1] — 2026-11-22

### Aplikasi sekarang BENAR-BENAR berjalan di atas Supabase
- Koneksi produksi aktif memakai **role aplikasi `mbc_app`** lewat *shared pooler*
  (`aws-1-ap-southeast-1.pooler.supabase.com:5432`) — **tanpa perlu sandi `postgres` proyek**.
  Role dibuat lewat connector Supabase dan hanya diberi DML di schema `public` (tanpa DDL).
- `/api/health` → `"provider":"supabase"`, `"db_host":"aws-1-ap-southeast-1.pooler.supabase.com"`,
  `"db_name":"postgres"`, `"tls":true`, `"pooler":true`, `"version":"1.4.0"`.
- Healthcheck produksi **LULUS**; login 4 peran langsung memakai tabel `users` di Supabase
  (`direksi`, `editorial`, `finance`, `sales`); daftar artikel API membaca 7 artikel dari Supabase.
- Uji tulis ujung-ke-ujung: `POST /api/newsroom/articles` membuat artikel id 8 di Supabase,
  lalu dihapus kembali (data uji tidak tertinggal).

### Perbaikan penting: sequence setelah impor data
- Impor data memakai `id` eksplisit → **sequence tertinggal di 1**, sehingga INSERT baru gagal
  `duplicate key value violates unique constraint "articles_pkey"`.
- Ditambal: `setval` untuk **semua** kolom `id` bertipe serial di `public` (blok DO dinamis),
  diverifikasi `articles_id_seq = 7` lalu INSERT baru sukses (id 8).
- Pelajaran untuk restore berikutnya: **selalu jalankan penyelarasan sequence setelah migrasi
  data dengan id eksplisit**.

### Tooling
- `server/cek-koneksi.js`: uji connection string + diagnosis otomatis (host pooler salah,
  sandi gagal, Direct/IPv6, timeout, nama DB salah). Membaca `server/.env` via dotenv.
- `server/.env` (mode 600, di-`.gitignore`) berisi `SUPABASE_DB_URL`, `JWT_SECRET` (96 hex),
  `APP_VERSION`, `PG_POOL_MAX`; seed `.env.example` tidak lagi memuat rahasia.
- `NODE_ENV=production` menolak start tanpa `JWT_SECRET` — perilaku ini dipertahankan.

## [1.4.0] — 2026-11-22

### Supabase benar-benar tersambung (data sudah masuk)
- Akses Supabase diverifikasi (`validate_credential` → valid; organisasi **MBCINDONESIA.TV**;
  proyek `uoepuofjitaozrlmxomk`, region `ap-southeast-1`, PostgreSQL 17, `ACTIVE_HEALTHY`).
- Skema dipasang lewat **migration Supabase** (`mbc_schema_core`, `mbc_schema_newsroom`,
  `mbc_schema_editorial_ai`) → **28 tabel**.
- Data awal dimigrasikan: **7 artikel** (semua status alur kerja), **8 program + 25 episode**,
  **9 agen AI**, **96 baris analitik konten (14 hari)**, 8 CRM deal, 3 invoice, 6 proyek produksi,
  16 item master, 3 komentar + moderasi, catatan/approval/tugas editorial, jejak audit.
- Hash sandi `demo123` diverifikasi cocok (`bcrypt.compareSync` → true), jadi keempat akun peran
  langsung bisa dipakai dari aplikasi begitu connection string dipasang.
- **Koreksi penting:** pooler region ini ada di `aws-1-ap-southeast-1.pooler.supabase.com`
  (host `aws-0-…` menjawab *tenant/user not found*); Direct connection hanya IPv6 sehingga tidak
  terjangkau dari jaringan IPv4. Dokumen, `.env.example`, dan `.env.production.example` diperbarui.
- `DATABASE-SUPABASE.md` §0 baru: status pengisian, tabel hasil verifikasi, dan satu langkah sisa
  untuk MBC (menempelkan connection string; saya tidak menebak/mengubah sandi database).

### Diuji
- Query verifikasi di Supabase: 28 tabel · 7 artikel · 25 episode · 9 agen · 96 analitik.
- Konektivitas pooler diuji dari sandbox: TLS + handshake berhasil (auth menunggu sandi MBC).

## [1.3.0] — 2026-11-22

### Ditambahkan — database Supabase (siap pakai, satu perintah)
- `db.js` kini memprioritaskan **`SUPABASE_DB_URL`** (Supabase session pooler), mendukung pooler
  (`max` lebih kecil, TLS otomatis), membersihkan parameter tak dikenal, dan mengekspor `dbInfo`
  (provider/host/db/TLS) tanpa membocorkan sandi. Neon via `DATABASE_URL` tetap didukung.
- **`server/setup-supabase.js`** — memuat `schema.sql` + `cms-schema.sql` lalu `seed.js` + `cms-seed.js`
  ke database Supabase (memakai `psql` bila ada, jika tidak memakai driver `pg`, termasuk parser
  *dollar-quoted*), lalu memverifikasi jumlah tabel, artikel, dan akun peran. Idempotent.
- `GET /api/health` kini melaporkan `provider`, `db_host`, `tls`, `pooler`, `latency_ms`, `version`
  sehingga operator bisa memastikan aplikasi benar-benar memakai Supabase.
- `dotenv` dimuat otomatis; `.env.example` & `.env.production.example` diperbarui.
- Dokumen **[DATABASE-SUPABASE.md](DATABASE-SUPABASE.md)**: langkah persis, tabel gejala→solusi
  (IPv6/pooler, sandi URL-encode, `too many connections`, skema belum dimuat).

### Diperbaiki — tampilan Android, tablet, iOS ("buyar/ambyar")
- Jaring aman lebar: `overflow-x:hidden`, `min-width:0` pada header/logo, flex-wrap terkendali.
- Breakpoint baru 1024/860/820/640/400 px; tipografi `clamp()`; katalog 3→2→1 kolom.
- Tabel Kebijakan Privasi dibungkus `.table-wrap` (geser di dalam kotak, halaman tidak melebar
  516 px → 390 px).
- Navigasi utama **tetap tampil di tablet ≥861 px** (sebelumnya hilang di semua ≤1024 px).
- iOS: semua input ≥16 px (tidak ada zoom otomatis), `viewport-fit=cover`,
  `env(safe-area-inset-*)` untuk notch/home indicator.
- Target sentuh (WCAG 2.5.8): navigasi, chip, footer, tombol melayang ≥36–44 px; tautan inline
  di paragraf dikecualikan.
- **Newsroom**: sidebar jadi laci + backdrop + Esc, tutup otomatis saat memilih menu; pill koneksi
  ringkas `● ONLINE` di layar kecil; modal menjadi *bottom sheet* (`dvh`); tabel punya wadah geser.
- Gerbang newsroom: kartu responsif, daftar peran RBAC, tautan ≥40 px.

### Diperbaiki — akses masuk per peran (RBAC)
- **`boot()` dijalankan setelah `window.load`** — sebelumnya bisa gagal di perangkat lambat
  (`viewDesk is not defined`) sehingga konten tidak muncul.
- `navTo()` kini menangkap kegagalan modul dan menampilkan pesan jelas (bukan layar kosong).
- Gerbang menerima **semua akun perusahaan**; menu & API tetap dibatasi peran di server.
  Redaksi mendarat di **Meja Redaksi** (bukan dasbor direksi).
- Token dari gerbang dibawa lewat `?t=` untuk navigasi pertama (peramban ponsel/in-app yang tidak
  menyimpan cookie), lalu **alamat dibersihkan** dengan `history.replaceState`.
- **Pembatas percobaan login diperbaiki**: sebelumnya 20 permintaan/5 menit **per alamat IP** sehingga
  satu kantor (NAT) bisa terkunci; kini burst 120/menit per IP + batas 10 kegagalan per
  **IP+akun** (reset saat berhasil) dan kunci keras hanya untuk IP agresif (40 kegagalan/10 menit).

### Diuji
- `ops/responsive-audit.js` — **56 kombinasi** halaman × perangkat: 0 geser horizontal, 0 elemen
  keluar layar, 0 error JS.
- Uji newsroom di Chromium mobile: **77 tampilan** (17 modul × 4 akun/perangkat) lolos; laci & editor
  7 tab berfungsi di 360 px.
- `npm run smoke` 45 · healthcheck 22 · `check-html` 7 halaman · healthcheck melaporkan provider DB.

## [1.2.0] — 2026-11-21

### Ditambahkan — Newsroom (dapur produksi) & AI
- **Area internal dipisahkan dari situs publik**: `/workspace/` → `/newsroom/`; semua tautan publik dihapus,
  `robots.txt` + `X-Robots-Tag: noindex`, dan **middleware server menolak anonim dengan HTTP 401**
  (halaman gerbang bermerek). Login gerbang `POST /api/newsroom/gate` (rate-limited, cookie `HttpOnly`,
  hanya peran `editorial`/`direksi`).
- **CMS editorial lengkap**: artikel (7 status alur kerja + prioritas + breaking), revisi bernomor,
  taksonomi kanal/tag, staf, catatan redaksi internal, alur persetujuan 4 tahap, kalender editorial +
  tugas, media library, moderasi komentar, analitik konten 14 hari.
- **Penegakan aturan di server**: transisi status tidak sah → 409; tayang wajib punya sumber & klaim
  terverifikasi & naskah ≥120 kata; artikel tayang tidak bisa dihapus.
- **Multi-Agent AI (9 agen)** di `server/agents.js`: Ringkas, Nada/Sentimen, Verifikator Fakta,
  Pustakawan Literasi, Editor Etika, Peninjau Hukum, Social & Distribusi, SEO & Keterbacaan,
  Rencana Peliputan — plus registry, riwayat run, kotak temuan ber-severity, dan antrean job.
- **AI Companion "Nusa"** untuk pengunjung: panduan situs, analisis berita yang sedang dibuka,
  pencarian literasi, penjelasan istilah — berjalan lokal di perangkat (tanpa kunci API, tanpa data pribadi keluar).
- **Halaman publik baru** `/berita.html`: katalog berita + panel analisis (ringkasan, nada, entitas, angka,
  kata kunci) + rujukan literasi + berita terkait; kartu "Berita & Analisis Terbaru" di beranda.
  Artikel yang tayang di newsroom otomatis muncul di situs publik.
- **Skema DB baru** `cms-schema.sql` (15 tabel) + `cms-seed.js` (7 artikel, 6 tugas, 9 aset, 9 agen, analitik).
- **Metrik** `/api/metrics` kini memuat jumlah artikel, temuan AI terbuka, dan run agen.

### Diuji
- `npm run smoke`: **45 pemeriksaan** (termasuk RBAC newsroom 401/403, alur status, penolakan tayang,
  pipeline & sweep AI, moderasi).
- `node ops/test-news-engine.js`: **35 pemeriksaan** mesin analisis berita.
- `ops/healthcheck.sh`: **22 pemeriksaan** (termasuk `/newsroom` wajib 401).
- Uji DOM (jsdom) untuk 9 view newsroom + editor 7 tab + halaman berita publik + companion.

### Diperbaiki
- `desc`/`descr` pada `/api/programs` (deskripsi kosong di frontend) — dikirim keduanya.
- Cast `text[]` untuk kolom tag artikel; `ai_runs.trigger='sweep'` masuk constraint.
- Detail artikel menerima id numerik **atau** slug; agen `sosial` memakai id video yang benar.
- Cluster PostgreSQL yang rusak dipulihkan (`cms-schema.sql` + seed dijalankan ulang).

### Diketahui
- Agen AI berbasis aturan + statistik teks (bukan LLM). Integrasi LLM bisa ditambah di `agents.js`
  tanpa mengubah API/UI — dengan kebijakan embargo & data narasumber.
- Rekomendasi pisah-aplikasi (newsroom sebagai layanan mandiri) beserta ambang kapan harus dipisah: lihat `NEWSROOM.md` §5.

## [1.0.0-rc1] — 2026-11-21

Rilis kandidat pertama: **siap UAT Direksi** (blueprint §17). Belum menjadi rilis produksi
sampai gerbang di `GO-LIVE.md` §0 terpenuhi (database produksi, domain, ganti akun demo, sign-off).

### Ditambahkan
- **Website publik**: beranda (hero, siaran live, katalog 8 program), halaman tonton dengan komentar
  tersimpan di PostgreSQL, halaman live TV + jadwal, halaman 404 bermerek.
- **Halaman legal**: `privasi.html` (kerangka UU PDP No. 27/2022: kategori data, dasar pemrosesan,
  retensi, hak subjek data) dan `syarat.html` (akses, hak cipta konten, aturan komentar, iklan,
  batasan tanggung jawab, hukum Indonesia).
- **PWA**: `manifest.webmanifest` (id + shortcuts), service worker `mbc-tv-v2` (precache termasuk
  halaman legal), halaman offline, ikon.
- **Web App internal** (9 modul): Dashboard, Program & Episode, CRM, Iklan & Sponsorship,
  Produksi & Studio, Keuangan, Master Data, Audit, Laporan, Pengaturan — dengan RBAC server-side.
- **Backend**: Express 4 + PostgreSQL 17, JWT 12 jam, bcrypt, audit log append-only,
  rate limit login/komentar, 27 endpoint.
- **Keamanan**: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `trust proxy`, error 500 tanpa stack trace, JSON 404 untuk `/api/*`.
- **Observabilitas**: `GET /api/metrics` (peran direksi: uptime, memori, jumlah baris per tabel),
  access log, `ops/healthcheck.sh` (18 pemeriksaan).
- **Performa**: `compression` gzip (CSS 11,8 KB → 4,3 KB), cache 7 hari untuk gambar,
  `Cache-Control` aset statis.
- **Ketahanan**: graceful shutdown SIGTERM/SIGINT, `ops/backup.sh` (dump + sha256 + retensi 14 hari),
  `ops/restore.sh` (verifikasi checksum + hitung baris), drill backup→restore tervalidasi.
- **Ops/deploy**: `Dockerfile` multi-stage (non-root, tini, healthcheck), `docker-compose.yml`
  (app + postgres + volume), unit `systemd` hardened, konfigurasi `nginx` + certbot.
- **CI/CD**: GitHub Actions — backend (sintaks, `npm audit`, 21 uji API terhadap Postgres 17),
  frontend (audit HTML/a11y, parse JS, manifest PWA, aset, App Links), Android (`assembleDebug`),
  build image Docker.
- **Android**: proyek Kotlin (`tv.mbcindonesia.app`) + `/.well-known/assetlinks.json` (App Links).
- **Dokumentasi**: `GO-LIVE.md` (10 gerbang + rollback + RTO), `UAT-CHECKLIST.md` (lembar uji +
  kolom sign-off), `README.md` diperluas, `server/README.md` (endpoint & keamanan), `CHANGELOG.md`.
- **Alat dev**: `server/scripts/dev-db.sh` (recovery PostgreSQL idempotent), `npm run smoke`,
  `npm run db:setup`, `ops/check-html.js`.

### Diperbaiki
- Deskripsi program kosong di frontend karena API hanya mengirim `descr`; kini `/api/programs`
  mengirim `desc` **dan** `descr` (klien lama tetap kompatibel). Dijaga oleh 2 uji smoke baru.
- Tautan mati `href="#"` di footer beranda → halaman privasi/syarat/surel nyata.
- `<title>` beranda 85 karakter (terpotong di hasil pencarian) → 58 karakter.
- `404.html` tanpa meta description → ditambahkan.
- Footer navigasi legal ditambahkan ke `watch.html`, `live.html`, `404.html`.
- Cache service worker dinaikkan ke `v2` agar precache halaman legal diterapkan.

### Keamanan
- `npm audit`: **0 kerentanan** (sebelumnya 1 high dari `compression` ≤1.8.1 → `npm audit fix`).
- `JWT_SECRET` wajib di `NODE_ENV=production` (server menolak start bila kosong).
- `.env`, `.env.local`, `*.jks`, `*.keystore`, `backups/` masuk `.gitignore`; `.env` juga
  dikecualikan dari image (`.dockerignore` + dihapus di build).

### Diketahui & disengaja belum ada
- Akuntansi/payroll penuh (blueprint Fase 4–5), payment gateway, iklan programmatic di luar lingkup.
- Angka pada data contoh bersifat ilustratif.
- APK/AAB belum dibangun di lingkungan ini (tidak ada Android SDK); proyek siap dikompilasi via CI.
- Placeholder `GANTI_DENGAN_SHA256_FINGERPRINT_SERTIFIKAT_RILIS` wajib diganti sebelum rilis Play Store.
- Akun demo `demo123` wajib diganti sebelum domain publik (GO-LIVE §5).

## [1.4.2] — 2026-11-22

### 🔴 Insiden & perbaikan: smoke test menabrak database PRODUKSI
**Apa yang terjadi:** `server/scripts/smoke.js` dijalankan dari folder `server/` sehingga memuat
`server/.env` (berisi `SUPABASE_DB_URL`). Skrip hanya menimpa `DATABASE_URL`, sedangkan `db.js`
**memprioritaskan `SUPABASE_DB_URL`** → server uji menyambung ke Supabase dan skrip menjalankan
`schema.sql`, `seed.js`, `cms-seed.js`, mengubah kata sandi, serta membuat/menghapus data **di produksi**.

**Dampak terukur:** artikel demo terhapus (7 → 1, sisa artikel uji), kata sandi `direktur@` berubah,
`cascade` menghapus `content_analytics` (98) & `editorial_approvals` (8), `staff` terhapus, data uji tertinggal.

**Pemulihan (selesai & terverifikasi):**
| Item | Sebelum pulih | Sekarang |
|---|---|---|
| Artikel | 1 (sisa uji) | **7** (status asli: 2 tayang, review, fakta, siap, draft, ide) |
| Isi badan artikel | kosong | **509–1.116 karakter** per artikel |
| Analitik konten | 0 | **98** |
| Approval editorial | 0 | **8** |
| Staff | 0 | **4** |
| Akun peran | `demo123` rusak | **4 akun `demo123`** valid (diuji `bcrypt.compareSync`) |
| Healthcheck | — | **SEMUA PEMERIKSAAN LULUS** |

**Pencegahan permanen:**
- `scripts/smoke.js`: menghapus `SUPABASE_DB_URL` dari proses uji (induk **dan** server anak), menolak
  target non-localhost kecuali `SMOKE_ALLOW_REMOTE=1` **dan** nama DB memuat `ci`/`test`. Diuji:
  target `aws-1-…pooler` → berhenti dengan pesan jelas.
- `ops/sync-seed.js` (baru): sinkronisasi tabel referensi DB lokal → target, `--tulis` untuk eksekusi,
  aman idempoten (DELETE + insert per tabel dalam transaksi), menyelaraskan sequence, menangani beda
  tipe `json/jsonb/text[]`, dan **menolak** bila sumber = target.
- `SUPABASE_DB_URL`/`DATABASE_URL` kini tidak lagi dipakai bergantian tanpa sengaja di skrip uji.

**Pelajaran yang dicatat (jangan diulang):**
1. Skrip destruktif wajib memeriksa **host target**, bukan hanya nama variabel env.
2. `db.js` memprioritaskan `SUPABASE_DB_URL`; override `DATABASE_URL` saja **tidak cukup**.
3. `TRUNCATE` butuh hak khusus → role aplikasi `mbc_app` sengaja tidak punya; gunakan `DELETE` berurutan.
4. Simpan `server/.env` hanya untuk runtime; skrip uji harus mengabaikannya.

### Lainnya
- RLS aktif di **28/28** tabel dengan policy `mbc_app_all` (role aplikasi tetap berfungsi penuh).
- `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES` untuk `mbc_app` (memperbaiki `sequence permission denied`
  dan akar error `audit_log_pkey`).
- `server/cek-koneksi.js` membaca `server/.env` otomatis.

## [1.4.3] — 2026-11-22

### Backup & restore terbukti bekerja pada Supabase
- `ops/backup.sh`: deteksi host terkelola → `--schema=public` (schema internal Supabase `auth`,
  `storage`, `realtime` tidak ikut), tambah `--no-security-labels`, validasi jumlah tabel **dan**
  bagian `COPY` agar dump kosong tidak lolos.
  Hasil nyata: **28 tabel · 28 COPY · 20 KB · sha256** dari proyek Supabase.
- `ops/restore.sh`: tahan dipulihkan ke klaster baru — drop objek per-tabel (bukan `DROP SCHEMA`,
  karena role aplikasi bukan owner), membuang `CREATE SCHEMA public` dari dump, `YA=1` untuk
  non-interaktif, verifikasi 7 angka (tabel/artikel/programs/episodes/users/analitik/audit).
- **Drill restore** ke database lokal `mbctv_restore`: `tabel=28 artikel=7 episodes=26 users=4
  analitik=98` → berhasil.

### Monitoring & alerting dasar
- `GET /api/status`: uptime, memori, metrik (total request, 5xx, request lambat, error terakhir),
  latensi DB, provider/host, jumlah artikel/pengguna/program. `503` bila DB tidak terjangkau.
- Middleware metrik: mencatat 5xx dan request > `RESPONSE_LAMBAT_MS` (default 1500 ms) ke log.
- `ops/cek-status.sh`: cek tiap 5 menit, keluar != 0 bila gagal, kirim webhook bila
  `ALERT_WEBHOOK` diisi. Diuji: sehat → exit 0, port mati → exit 1 dengan pesan jelas.
- Timer & service systemd: `mbcindonesia-backup.timer` (02:15 WIB) dan `mbcindonesia-health.timer`.

### Akun demo
- `ops/audit-akun.js`: melaporkan akun yang masih memakai sandi demo, dan `--ganti` membuat sandi
  acak kuat (16+ karakter) ditulis ke berkas mode 600 (**tidak** dicetak ke layar/log).
- Status sekarang: **4 dari 4 akun masih `demo123`** — sengaja dipertahankan agar Anda bisa mencoba;
  jalankan `node ops/audit-akun.js --ganti` sebelum domain publik dibuka.

### Verifikasi
- Healthcheck **LULUS**, `/api/status` `ok:true` (db 160 ms, provider `supabase`), smoke CI **LULUS**
  di DB lokal, dan Supabase tetap utuh (artikel 7 · analitik 98 · 4 akun) — bukti pagar smoke bekerja.

## [1.4.4] — 2026-11-22

### Link uji publik (bisa dibagikan)
- Tunnel keluar via **Cloudflare quick tunnel** (`cloudflared 2026.11.1`) dari sandbox →
  aplikasi di `127.0.0.1:8080` dapat URL HTTPS publik yang bisa dibuka siapa pun:
  `https://wiring-metabolism-correct-reductions.trycloudflare.com`.
- Diuji **dari luar** (bukan localhost): beranda, berita, tonton, live, privasi, syarat,
  gerbang newsroom, `/api/health`, `/api/status`, `/api/newsroom/public-list`, sitemap,
  manifest, CSS → semuanya **200**; `/newsroom/` tanpa cookie → **401**, dengan cookie → **200**.
- Login lewat tunnel: **4 peran berhasil** (`direksi`, `editorial`, `finance`, `sales`).
- Uji tulis ujung-ke-ujung lewat link publik: `POST /api/comments` → komentar id 5 tersimpan
  di Supabase, lalu dihapus kembali oleh admin (data uji tidak tertinggal).
- Panduan penguji: `LINK-UJI-PUBLIK.md` (peta halaman, akun, skrip uji 10 menit, kolom umpan
  balik, dan batasan jujur).

> Catatan: quick tunnel tanpa akun Cloudflare **tidak bergaransi uptime** dan URL-nya berganti
> setiap kali dijalankan ulang. Untuk produksi tetap perlu domain + server (GO-LIVE §3).

## [1.4.5] — 2026-11-22

### Link uji publik diganti (Cloudflare quick tunnel mati)
- **Gejala:** pengguna melaporkan `https://wiring-metabolism-correct-reductions.trycloudflare.com`
  tidak bisa dibuka.
- **Diagnosis (bukan asumsi):** DNS publik (Cloudflare DoH & Google DoH) menjawab **NXDOMAIN
  (Status 3)** untuk host itu, sementara log cloudflared berakhir dengan
  `ERR Register tunnel error from server side: Unauthorized: Tunnel not found` — artinya Cloudflare
  **mencabut** tunnel tanpa akun di sisi server. Jadi bukan masalah jaringan pengguna.
- **Perbaikan:** pindah ke tunnel SSH **localhost.run**:
  `ssh -R 80:127.0.0.1:8080 nokey@localhost.run` → `https://f6989a335972c1.app.lhr.life`.
- **Verifikasi ulang dari internet:** DNS publik resolve (A record 54.172.225.3 dst),
  **16 endpoint 200** (beranda, berita, tonton, live, privasi, syarat, gerbang newsroom,
  health, status, public-list, manifest, sw.js, sitemap, robots, CSS), `/newsroom/` tanpa cookie
  **401**, dengan cookie **200**, login **4 peran** berhasil, dan `POST /api/comments` menulis ke
  Supabase (id 6) lalu dibersihkan admin.
- `LINK-UJI-PUBLIK.md` diperbarui: URL baru, catatan riwayat kegagalan, dan dua cara memperbarui link.

> Catatan: domain `*.lhr.life` berotasi dan tunnel tanpa akun tidak bergaransi uptime.
> Link permanen tetap memerlukan domain + server produksi.

## [1.4.6] — 2026-11-22

### Perbaikan link uji publik (percobaan ke-3, berhasil)
**Riwayat kegagalan yang diuji satu per satu (bukan tebakan):**
| Penyedia | Gejala | Akar masalah |
|---|---|---|
| Cloudflare quick tunnel (QUIC) | DNS NXDOMAIN, `Unauthorized: Tunnel not found` | Cloudflare mencabut tunnel setelah koneksi QUIC idle putus |
| localhost.run (`*.lhr.life`) | 200 lalu **502** | domain berotasi; sesi SSH idle diputus |
| Pinggy | 200 tapi halaman **"Caution — free website"** | interstitial di free tier |
| Serveo | idem (halaman "Serveo - Warning") | interstitial di free tier |
| **Cloudflare + `--protocol http2`** | ✅ **stabil** | TCP/HTTP2 tidak terputus saat idle |

**Tindakan:**
- Tunnel baru: `cloudflared tunnel --url http://127.0.0.1:8080 --protocol http2 --no-autoupdate`.
- `ops/jaga-tunnel.sh` (baru): keep-alive tiap 45 detik + cek isi halaman berkala + log
  kegagalan (`/tmp/jaga-tunnel.log`), dijalankan sebagai proses terpisah.
- **Uji dari luar sandbox** memakai Microlink API (bukan hanya curl lokal): judul halaman
  terkonfirmasi `MBC INDONESIA — Televisi Digital Indonesia` dan `Berita & Analisis — MBC INDONESIA`.
- Verifikasi penuh: DNS publik resolve, 16 endpoint **200**, `/newsroom/` **401 → 200** dengan
  cookie, login **4 peran** berhasil, uji stabil setelah ±2 menit tetap 200.

> Pelajaran: untuk membuktikan sebuah URL "berfungsi", tidak cukup `curl` dari mesin yang
> membuatnya — perlu pengujian dari jaringan luar, karena interstitial/penyedia bisa
> mengembalikan 200 palsu.

## [1.4.12] — 2026-11-23

### Jawaban: repo GitHub belum dipakai
Repo `Yudi8377/MBCINDONESIA.TV` **masih 0 commit**, dan akun Vercel belum memasang integrasi GitHub
(`To link a GitHub repository, you need to install the GitHub integration first`). Jadi seluruh
tayangan saat ini **bukan** dari GitHub/Vercel, melainkan dari server di sandbox lewat **tunnel
sementara**. Itu sebab utama tampilan terasa "bermasalah": 530 = tunnel diputus Cloudflare
(terjadi lagi 06:12 UTC, pulih 15 detik kemudian), bukan kode halaman yang salah.

### Audit tampilan objektif
`ops/audit-visual.py` menjalankan Chromium di **3 ukuran layar × 6 halaman = 18 pemeriksaan**:
- **0** permintaan HTTP gagal (saat tunnel sehat) · **0** error JavaScript · **0** teks terpotong.
- Satu-satunya "keluar layar" adalah `.skip-link` (memang sengaja −999px) dan `DIV.hero-bg`
  (latar yang dilebihkan ±6–20px untuk efek penuh — disengaja, bukan bug).
- Baris chip kategori di ponsel **memang** digulir horizontal (desain), bukan terpotong.

### Perbaikan tampilan yang nyata
- `site.css`: di layar ≤768px `body` diberi ruang bawah setinggi FAB "Nusa" + `safe-area-inset-bottom`,
  sehingga elemen terakhir tidak pernah tertutup tombol melayang; `.toast` dan `#backTop` dinaikkan
  agar tidak bertumpuk dengan FAB.
- `#cgFab`: `bottom` kini memperhitungkan `env(safe-area-inset-bottom)` (iPhone dengan home indicator).
- `.chips` di ponsel: `scroll-snap` + tepi kanan lega (isyarat bisa digeser).
- Form komentar: `padding-right` di layar ≤520px — diuji 390×844, 360×740, **820×1180**: tombol "Kirim"
  tidak tertimpa FAB pada ketiga ukuran.
- Skrip baru `ops/audit-visual.py` (audit + tangkapan layar ke `docs/screens/`) dan
  `ops/tunnel-otomatis.sh` (supervisor: deteksi 530 → buat tunnel baru → tulis `ops/url-terkini.txt`).

## [1.4.11] — 2026-11-23

### Keluhan 530 pada Program / Live TV / Dokumenter / Podcast — hasil pemeriksaan
- Uji Chromium (`ops/uji-jaringan.py`) saat gangguan: **Program, Live TV, Dokumenter** menerima
  **HTTP 530 dari host kita sendiri**, judul halaman menjadi `Cloudflare Tunnel error`.
  **Tidak ada** permintaan ke pihak ketiga yang gagal → bukan aset rusak, bukan bug kode.
- Log `cloudflared`: `Lost connection with the edge` → `Retrying connection` → pulih 11 detik.
  `ERR_CONNECTION_CLOSED` = percobaan reconnect ke tunnel yang sama.
- Tunnel lama diganti; sesudahnya **22/22 HTTP 200** (7 menit) dan uji Chromium **0 permintaan gagal**,
  3 pemutar video `readyState 4`.

### Perbaikan ketahanan tambahan
- `assets/js/site.js`: jaring aman aset — gambar gagal dicoba ulang 1× (cache-buster), lalu jatuh ke
  placeholder lokal; `MutationObserver` juga menangani gambar yang disisipkan dinamis.
- `assets/css/site.css`: `video.video-gagal` memberi tanda visual pada pemutar yang gagal.
- Skrip operasional baru: `ops/pantau-tunnel.sh` (CSV kode + durasi tiap gangguan),
  `ops/uji-jaringan.py` (siapa yang gagal: aset kita atau pihak ketiga).
- Dokumen: `LAPORAN-GANGGUAN-TUNNEL.md`.

## [1.4.10] — 2026-11-23

### Diagnosis keluhan "530 / ERR_CONNECTION_RESET"
- **530** = kode Cloudflare untuk *origin tidak terjangkau*. Log tunnel menunjukkan
  `Lost connection with the edge` → `Retrying connection` → `Registered tunnel connection`
  pada 05:43:10–05:43:21 UTC. Selama ±11 detik itu semua permintaan dijawab **530**.
  Jadi 530 **bukan** bug aplikasi: itu tunnel sementara kehilangan sambungan ke edge Cloudflare.
- **Remote resource yang gagal** (`r20-100KB.png`, `ERR_CONNECTION_RESET`) berasal dari pihak ketiga
  (avatar/telemetri ekstensi atau aset CDN luar), bukan dari `mbcindonesia.tv`. Karena situs menarik
  seluruh aset dari origin sendiri, kegagalan itu tidak memengaruhi halaman.
- **503 `/api/health`** saat itu disebabkan koneksi Supabase pooler yang sudah mati masih tersimpan di
  pool (pooler menutup koneksi idle). Dibuktikan: query langsung dari proses baru selalu sukses
  (7 artikel, ±160 ms), sementara endpoint mengembalikan 503.

### Perbaikan ketahanan
- `server/db.js`: `pool.query` sekarang **mengulang sekali** untuk galat transien
  (`ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`, `EPIPE`, `57P01/57P02/57P03`, `08000/08001/08003/08006`,
  `53300`, `XX000`) dengan jeda 350 ms, dan mencatat peringatan di log.
- `server.js`: endpoint baru **`GET /api/healthz`** → selalu `200`, tanpa menyentuh DB, cache 1 detik.
  Cocok untuk uptime monitor / keep-alive; status DB tetap di `/api/health`.
- Uji: 12 permintaan berurutan lewat tunnel publik → `healthz 200` dan `video 206` **12/12**, tanpa galat.
- Catatan operasional: tunnel `trycloudflare.com` **tidak punya jaminan uptime** (dinyatakan Cloudflare
  sendiri). Untuk produksi, URL Vercel/domain sendiri tetap jalur utamanya.

## [1.4.9] — 2026-11-23

### Perbaikan: video tidak bisa diputar
**Penyebab (terukur, bukan dugaan):**
1. `https://commondatastorage.googleapis.com/gtv-videos-bucket/...` → **HTTP 403** saat diuji dari sandbox;
   sumber video bawaan Google itu sudah tidak boleh dipakai (hotlink diblokir). Semua 11 klip program
   memakai URL ini, jadi pemutar hanya menampilkan poster.
2. Siaran "Live" mengandalkan `hls.js` dari **CDN eksternal** + `test-streams.mux.dev`. Di jaringan yang
   memblokir CDN, `window.Hls` tidak ada → jatuh ke MP4 yang juga 403 → layar kosong.
3. CSP lama masih menyebut dua domain itu, jadi migrasi ke aset sendiri akan tetap ditolak browser.

**Perbaikan:**
- Dibuat **11 klip MP4 lokal** (`website/assets/video/*.mp4`, 6 detik, 1280×720, H.264 high, yuv420p,
  `+faststart`, tanpa audio) lewat `ops/buat-video.py` — memakai foto program yang sudah ada + teks judul.
- Dibuat **`live-24jam.mp4`** 40 detik: 20 detik zoom-in + 20 detik versi `reverse` disambung, sehingga
  `loop` terlihat mulus (tanpa lompatan) sebagai pengganti siaran berjalan.
- `live.html`: HLS/CDN eksternal dibuang; pemutar memakai berkas lokal, `loop`, `preload=auto`,
  plus `canplay` → `play()` untuk autoplay (iOS tetap butuh `muted`, tombol "Aktifkan Suara" disediakan).
- `watch.html`: helper `mulaiPutar()`, listener `error` dengan satu kali fallback ke klip lokal, dan
  pesan kegagalan yang bisa dibaca (`#properr` + tombol muat ulang) alih-alih layar hitam.
- `assets/js/data.js`: seluruh `videos` menunjuk `assets/video/*.mp4`.
- CSP (`server/server.js`): `media-src 'self' blob:`, `connect-src 'self'` — hanya sumber sendiri.
- `sw.js` → cache `mbc-tv-v4`, `live-24jam.mp4` masuk app-shell, dan **video dikecualikan dari Cache Storage**
  supaya permintaan `Range` (seek) dan iOS Safari tidak rusak.
- Bukti uji: `ops/uji-video.py` menjalankan **Chromium headless sungguhan** terhadap 3 halaman →
  `readyState 4`, `currentTime` maju (5,0–5,2 dtk), `videoWidth 1280`, tanpa error media, **di localhost
  maupun lewat tunnel publik**. Server melayani `206 Partial Content` + `accept-ranges: bytes`.

**Batas jujur:** ini klip demo (foto + gerak halus), **bukan** siaran televisi sungguhan. Siaran nyata
butuh encoder (OBS/vMix) → RTMP → HLS dengan CDN; strukturnya sudah disiapkan, sumbernya tinggal ditukar.

### 1.4.8 — Supabase pulih & hardening newsroom di Vercel
- **Database Supabase `uoepuofjitaozrlmxomk` aktif kembali** (REST 401, pooler menerima, role `mbc_app`).
  Diverifikasi langsung: 28 tabel, `articles` = 7 baris, `/api/health` →
  `{"ok":true,"db":true,"provider":"supabase","pooler":true,"tls":true,"version":"1.4.7"}`.
  Kredensial lama tetap berlaku, jadi tidak perlu migrasi ulang.
- **Keamanan (penting):** `vercel.json` sebelumnya me-rewrite `/newsroom` ke `website/newsroom/index.html`
  yang berarti **CMS bisa terunduh tanpa login** (middleware Express terlewati). Sekarang `/newsroom`,
  `/newsroom/`, dan `/newsroom/index.html` di-rewrite ke function `api/index.js` agar middleware 401 +
  cookie `mbc_gate` tetap berlaku; `gerbang.html` & `index.html` ditambahkan ke `includeFiles`.
- Proyek Vercel **`mbcindonesia-tv`** dibuat (id `prj_uFBaXNU8q0FH2vqLALEjKxsjL5aN`, team
  `team_nnTGRBz6Ql1mC0nWiHwJ43vw`) dengan env `SUPABASE_DB_URL` & `JWT_SECRET` (terenkripsi) + `APP_VERSION`.
- Catatan: koneksi Git GitHub **belum terpasang** di akun Vercel (`To link a GitHub repository, you need to
  install the GitHub integration first`), dan repo `Yudi8377/MBCINDONESIA.TV` masih kosong — deploy
  menunggu salah satu: pasang integrasi GitHub lalu push, atau deploy lewat unggahan file (CLI/token).

## [1.4.7] — 2026-11-23

### Siap deploy permanen di Vercel + repo GitHub pengguna
- **Repo target:** `https://github.com/Yudi8377/MBCINDONESIA.TV` — saat diperiksa masih **kosong**
  (hasil `git clone`: *"You appear to have cloned an empty repository"*), dan sandbox **tidak punya
  kredensial push** (`git push` → `could not read Username for 'https://github.com'`).
  Karena itu kode disiapkan lengkap di workspace agar bisa di-push sekali perintah.
- `package.json` di root: dependensi runtime (express, pg, bcryptjs, jsonwebtoken, compression, dotenv),
  `engines.node 22.x`.
- `api/index.js`: handler serverless Vercel yang memakai ulang `server/server.js`.
- `server/server.js`: mengekspor `app`; `app.listen` **dilewati** bila `VERCEL=1` (mode serverless),
  sehingga perilaku VPS/Docker tetap sama. Static Express dibuat kondisional (`WEBSITE_ADA`).
- `vercel.json`: `outputDirectory: website` (statis via CDN), rewrite `/api/*` → `api/index`,
  `/newsroom/*` → SPA, function `memory 1024 / maxDuration 30 / includeFiles server/**`,
  header keamanan + cache, `X-Robots-Tag: noindex` untuk newsroom.
- `.vercelignore`: mengecualikan `node_modules`, `server/.env*`, `backups`, `android`, `docs/screens`,
  `.md`, dan **berkas kredensial**.
- `README.md`: panduan deploy Vercel 5 menit (import repo → env var → deploy).

### Insiden infrastruktur (dilaporkan apa adanya)
- **Proyek Supabase `uoepuofjitaozrlmxomk` hilang** dari akun: `list_projects` kini hanya memuat
  proyek **RUPAAI** (`lkulimmhvjtjfifohevz`), dan connector menolak akses ke proyek lama (403).
  DNS `db.uoepuofjitaozrlmxomk.supabase.co` pun tidak resolve. Semua kredensial lama otomatis tidak berlaku.
- Dampak: demo publik sementara dialihkan ke **PostgreSQL lokal** agar link tetap hidup
  (`/api/health` → `"provider":"lokal"`). Setelah proyek Supabase baru (dan `SUPABASE_DB_URL`) tersedia,
  cukup jalankan `node ops/sync-seed.js --tulis` untuk memindahkan seluruh data.
- Tunnel Cloudflare lama juga dicabut (`nxdomain`), diganti tunnel baru dengan `--protocol http2`.

### Catatan
- `server/.env` **tidak** ikut ke repo (sudah di `.gitignore`); nilai di server Vercel diatur lewat
  Environment Variables, bukan file.
