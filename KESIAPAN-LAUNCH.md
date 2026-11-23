# 🚦 Kesiapan Launching, Operasional & Komersial — MBCINDONESIA.TV
**Versi:** `v1.4.1` · **Tanggal:** 22 November 2026 · **Sifat dokumen:** penilaian jujur (readiness assessment)

---

## Jawaban singkat

| Sasaran | Status | Artinya |
|---|---|---|
| **Launching (demo internal / UAT)** | 🟢 **SIAP** | Bisa dipresentasikan ke Direksi hari ini: situs publik + CMS + API + database cloud jalan. |
| **Launching publik** | 🟡 **BELUM** — kurang ±1–2 jam kerja teknis | Blokir utama tinggal: **akun demo `demo123` belum diganti** + domain/TLS. RLS, backup, dan monitoring sudah selesai. |
| **Siap operasional** (dipakai redaksi tiap hari) | 🟡 **75 %** | Backup+drill restore, RLS, dan monitoring dasar **selesai**. Sisa: ganti sandi staf, rotasi log, email transaksional, SLA/runbook, UAT. |
| **Siap komersial** (menghasilkan uang) | 🔴 **BELUM** | Belum ada mesin uang: tidak ada gateway pembayaran (Midtrans/Xendit), tidak ada langganan/premium, iklan belum terhubung ad-server, belum ada faktur PPN/akuntansi, belum ada bukti UU PDP. |

> **Satu kalimat:** ini **produk yang berfungsi dan layak didemokan**, **belum** produk yang boleh dihadapkan ke publik/klien tanpa 4 langkah wajib di bawah.

---

## 1. Yang SUDAH terbukti hari ini (bukan klaim)

| Aspek | Bukti terukur |
|---|---|
| Situs publik | 7 halaman, audit HTML lolos, **audit responsif 56/56** (360–1024 px, landscape, safe-area) |
| Web app internal | 17 menu · 9+ tampilan editorial · **142 tampilan lolos uji** · RBAC 4 peran (17/12/7/6 menu) |
| API | **Smoke test 45/45 LULUS** (`node scripts/smoke.js`) |
| Database | Supabase PG 17, **28 tabel**, ±250 baris data realistis, semua service `ACTIVE_HEALTHY` |
| Integrasi | `/api/health` → `provider:"supabase"`, `tls:true`, `pooler:true`; healthcheck produksi LULUS |
| Auth | bcrypt + JWT; 4 akun peran login dari tabel Supabase; rate-limit login (10/10 menit) |
| Keamanan dasar | CSP, HSTS, `X-Frame-Options`, audit log append-only, DML-only role aplikasi |
| RLS Supabase | **28/28 tabel aktif**, policy `mbc_app_all` untuk role aplikasi (anon REST tetap 401) |
| PWA | `manifest.webmanifest` + `sw.js` + `assetlinks.json` |
| Android native | Proyek Kotlin WebView + App Links (2 file `.kt`) — **belum dibangun jadi AAB** |
| Deployment | `ops/nginx/*.conf`, `ops/systemd/*.service`, `ops/backup.sh` + `restore.sh`, Docker |

---

## 2. Empat blokir wajib sebelum menyentuh publik

### 🔴 B1 — Akun demo masih `demo123` (paling berbahaya)
Siapa pun yang membuka `/newsroom/` dan mencoba `direktur@mbcindonesia.tv` / `demo123` akan masuk sebagai Direksi.
**Biaya:** 15 menit. **Cara:** login → menu *Pengaturan → Ganti kata sandi* untuk 4 akun, atau nonaktifkan akun demo lalu buat akun staf asli.

### ✅ B2 — RLS Supabase (SELESAI 22 Nov 2026)
Sudah **28/28 tabel** ber-RLS dengan policy `mbc_app_all`; `anon` REST tetap **HTTP 401**.
Sisa pekerjaan kecil untuk produksi: **policy baca-publik** (hanya artikel `tayang`) bila nanti
data dibaca langsung dari browser memakai kunci anon — sekarang semua akses lewat API server, jadi
tidak wajib. **Biaya:** ~30 menit bila dipakai.

### 🔴 B3 — Domain, DNS, TLS
`mbcindonesia.tv` belum diarahkan; sertifikat TLS belum terbit.
**Biaya:** 45 menit + propagasi. **Cara:** `GO-LIVE.md` §3 (`certbot` + `ops/nginx/mbcindonesia.tv.conf`).

### ✅ B4 — Backup & drill restore terhadap Supabase (SELESAI 22 Nov 2026)
- `ops/backup.sh` dijalankan langsung ke Supabase: **28 tabel, 28 bagian data, 20 KB, sha256 tersimpan**.
  Diperbaiki: otomatis membatasi ke `--schema=public` untuk Supabase (schema internal `auth/storage/realtime`
  memang bukan milik kita) + `--no-security-labels` agar dump bisa dipulihkan di klaster mana pun.
- **Drill restore nyata** ke database lokal baru lewat `ops/restore.sh`:
  `tabel=28 artikel=7 programs=8 episodes=26 users=4 analitik=98` → **berhasil**.
  Diperbaiki: drop objek per-tabel (role aplikasi bukan owner schema), membuang `CREATE SCHEMA public`
  dari dump, dan `YA=1` untuk pemakaian non-interaktif.
- Jadwal siap dipasang: `ops/systemd/mbcindonesia-backup.timer` (02:15 WIB, `Persistent=true`).

**Sisa di sisi MBC:** pasang unit systemd di server produksi (`systemctl enable --now mbcindonesia-backup.timer`),
dan putuskan retensi (default 14 hari) + lokasi penyimpanan di luar server.

---

## 2b. Insiden yang terjadi hari ini (transparan)

Saat menjalankan uji, skrip `smoke.js` **memuat `server/.env` dan menulis ke database produksi**
(karena `db.js` memprioritaskan `SUPABASE_DB_URL`). Akibatnya artikel demo, analitik, approval,
dan staff terhapus, serta sandi akun demo berubah.

**Sudah dipulihkan penuh dan diverifikasi:** artikel **7** (isi 509–1.116 karakter), analitik **98**,
approval editorial **8**, staff **4**, 4 akun `demo123` valid, healthcheck **LULUS**, smoke lokal **LULUS**.

**Pencegahan permanen yang sudah dipasang:** skrip uji kini menolak host non-localhost (kecuali
`SMOKE_ALLOW_REMOTE=1` + nama DB `*ci*`/`*test*`), menghapus `SUPABASE_DB_URL` dari proses uji, dan ada
alat baru `ops/sync-seed.js` untuk sinkronisasi/pemulihan data yang menolak bila sumber = target.
Rincian: `CHANGELOG.md` §1.4.2.

> Pelajaran penting untuk gerbang go-live: **skrip destruktif wajib memeriksa HOST target**, bukan
> hanya nama variabel environment.

---

## 3. Kesenjangan operasional (setelah blokir di atas)

| # | Kesenjangan | Dampak | Prioritas |
|---|---|---|---|
| O1 | ~~Monitoring & alerting~~ → **dasar sudah ada**: `/api/status` + `ops/cek-status.sh` (alert webhook) + timer 5 menit. Belum ada APM/dashboard grafis | Gangguan cepat terdeteksi; analisis tren masih manual | Sedang |
| O2 | Log terpusat + rotasi (sekarang hanya stdout) | Investigasi insiden lambat, disk bisa penuh | Tinggi |
| O3 | Email transaksional (verifikasi, reset sandi, notifikasi redaksi) — belum ada SMTP | Reset sandi manual, newsletter hanya mengumpulkan alamat | Sedang |
| O4 | Antrean job (publish terjadwal, rekap analitik malam) — masih in-process | Job hilang saat restart | Sedang |
| O5 | UAT & sign-off Direksi (blueprint §17) belum dijalankan | Tidak ada bukti formal bahwa alur redaksi disetujui | **Tinggi (gerbang 9)** |
| O6 | SLA, runbook insiden, on-call, RTO/RPO tertulis | Tim tak punya prosedur saat 03:00 server down | Sedang |
| O7 | Uji beban (kapan "breaking news" ramai) | Kapasitas tak diketahui; pooler Supabase punya batas koneksi | Sedang |
| O8 | Aksesibilitas & SEO lanjutan: uji pembaca layar, `sitemap` sudah ada, schema.org NewsArticle belum | Jangkauan & kepatuhan | Rendah–Sedang |
| O9 | APK/AAB: belum dibangun, keystore belum ada, Play Console belum | Android belum bisa dipasang dari toko (PWA tetap bisa "Add to Home screen") | Sedang |
| O10 | Versi Node/paket: 99 paket tanpa `npm audit` berkala | Risiko CVE | Sedang |

---

## 4. Kesenjangan komersial (paling besar)

| # | Yang belum ada | Mengapa penting untuk komersial |
|---|---|---|
| K1 | **Gateway pembayaran** (Midtrans/Xendit) + halaman checkout | Tanpa ini tidak ada aliran uang masuk sama sekali |
| K2 | **Langganan/premium** (metered paywall, akun pembaca, invoice otomatis) | Model pendapatan digital media modern |
| K3 | **Ad-server / GAM / sponsored content** — `ad_slots` & `campaigns` baru tabel + laporan internal | Iklan belum tayang otomatis & belum ada bukti *impression* ke pengiklan |
| K4 | **Faktur pajak (PPN 11/12 %), e-Faktur, integrasi akuntansi** | Klien korporat menuntut dokumen pajak sah; `invoices` masih tabel demo |
| K5 | **Laporan pengiklan** (dashboard impression/klik, sertifikasi) | Ini yang dibeli pengiklan, bukan sekadar slot |
| K6 | **Kepatuhan UU PDP No.27/2022** + consent banner nyata + DPO + kebijakan retensi | Wajib hukum sebelum mengumpulkan data pembaca & menjual iklan bertarget |
| K7 | **Kontrak, rate card, media kit, terms for advertisers** | Prasyarat komersial dengan klien |
| K8 | **Data audiens terverifikasi** (Google Analytics 4 / server-side, Nielsen/Comscore bila perlu) | Angka audiens saat ini ilustratif — pengiklan akan meminta bukti pihak ketiga |
| K9 | **Konten produksi asli** (sekarang konten dummy realistis) | Kepercayaan & tanggung jawab redaksi |
| K10 | **Payroll/akuntansi penuh (Fase 4–5 blueprint)** | Belum dibangun; dinyatakan sejak awal |

---

## 5. Estimasi realistis menuju tiap status

| Dari → Ke | Pekerjaan | Estimasi |
|---|---|---|
| Sekarang → **demo internal / UAT** | tidak ada (sudah jalan) | **0** |
| Sekarang → **live publik (soft launch)** | B1 + B2 + B3 + B4 + monitoring dasar | **±1 hari kerja** |
| Sekarang → **operasional penuh** | soft launch + O1–O8 | **±1–2 minggu** |
| Sekarang → **komersial (iklan + langganan)** | operasional + K1–K9 + UAT komersial | **±4–8 minggu** bergantung kecepatan legal & mitra pembayaran |

---

## 6. Urutan yang saya sarankan (dan bisa saya kerjakan sekarang)

**Bisa saya selesaikan tanpa menunggu apa pun dari MBC:**
1. Aktifkan **RLS + policy** di Supabase (baca-publik hanya artikel `tayang`).
2. Siapkan **cron backup** + drill restore terhadap Supabase (butuh kredensial role yang punya hak dump).
3. Tambahkan **healthcheck uptime + endpoint `/api/status`** yang ramah monitoring.
4. Buat **skrip ganti sandi massal** + audit "tidak ada lagi akun `demo123`".
5. Tambahkan **schema.org NewsArticle + sitemap berita** (SEO).
6. Siapkan **runbook insiden + SLA + RTO/RPO** (dokumen).
7. Kerangka **halaman langganan + integrasi Midtrans sandbox** (kode siap, tombol hidup setelah kunci diberikan).

**Harus MBC/ pihak ketiga:**
domain & DNS · keystore rilis + Play Console · akun Midtrans/Xendit + NPWP/e-Faktur · akun analitik & alat monitoring · sign-off Direksi (UAT).

---

## 7. Pernyataan batas (agar tidak ada salah paham)

- Repo ini **prototipe produksi-siap-arsitektur**, bukan produk ber-PT lengkap: agen AI bersifat **deterministik (bukan LLM)**, angka analitik **ilustratif**, dan konten **dummy realistis**.
- APK/AAB **tidak dapat dibangun di sandbox** (tanpa Android SDK); PWA sudah bisa dipasang di Android/iOS hari ini.
- Sandi `demo123` sengaja dipertahankan agar Anda bisa mencoba; **jangan pernah** dibiarkan aktif di domain publik.
