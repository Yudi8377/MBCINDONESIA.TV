# 📊 Status Menuju Go-Live — MBCINDONESIA.TV

**Versi:** `v1.4.0` · **Tanggal:** 22 November 2026 · **Sifat:** ringkasan satu halaman
(detail teknis: `GO-LIVE.md` · lembar uji: `UAT-CHECKLIST.md` · riwayat: `CHANGELOG.md`)

---

## Kalimat kunci

**Semua yang bisa dikerjakan tanpa kredensial & keputusan manusia sudah selesai dan teruji.**
Sistem berjalan penuh di lingkungan ini (website + API + database PostgreSQL nyata), lulus
45 uji API otomatis, 35 uji mesin berita, 22 pemeriksaan pasca-deploy, 7 halaman lolos audit HTML,
dan backup→restore sudah dibuktikan.
Sisa langkah go-live sepenuhnya bergantung pada **aset milik MBC**: akun hosting/database,
domain, keystore Android, akun Play Store, dan **tanda tangan Direksi**.

---

## Yang SUDAH selesai & terverifikasi hari ini

| Area | Bukti |
|---|---|
| **Supabase SUDAH terisi** | Proyek `uoepuofjitaozrlmxomk` (ap-southeast-1, PG 17, sehat): **28 tabel**, 7 artikel, 8 program + 25 episode, 9 agen AI, 96 baris analitik. Sisa 1 langkah: tempel `SUPABASE_DB_URL` (pooler `aws-1-…`) → `/api/health` jadi `provider:"supabase"` — lihat `DATABASE-SUPABASE.md` §0 |
| **Responsif Android/tablet/iOS** | `ops/responsive-audit.js`: **56 kombinasi halaman × perangkat lolos** (0 geser horizontal, 0 elemen keluar layar, 0 error JS); newsroom **142 tampilan** lolos; tangkapan layar di `docs/screens/` |
| **Masuk per peran (RBAC)** | 4 akun → menu berbeda (17/12/7/6 modul), redaksi mendarat di Meja Redaksi, API menolak 403 untuk modul di luar peran |
| **Newsroom (dapur produksi) terpisah dari situs publik** | `/newsroom/` → **401 untuk anonim** (gerbang khusus redaksi), `robots.txt` `Disallow: /newsroom`, **nol tautan** ke area internal di situs publik/manifest |
| **CMS editorial kelas newsroom** | artikel 7 status + revisi bernomor, alur persetujuan 4 tahap (redaktur→fakta→hukum→pemimpin), kalender + tugas, media library, moderasi komentar, analitik konten 14 hari |
| **Aturan editorial ditegakkan server** | transisi tidak sah → 409; tayang wajib punya sumber + klaim terverifikasi + ≥120 kata; artikel tayang tak bisa dihapus |
| **Multi-Agent AI (9 agen)** | pipeline 9 agen pada 1 artikel, *sweep* seluruh newsroom, kotak temuan ber-severity, riwayat run & antrean job — semua lokal, bisa diaudit |
| **Pemandu pengunjung "Nusa" + `/berita.html`** | analisis berita (ringkasan, nada, entitas, angka, kata kunci) + **rujukan literasi**; artikel tayang di newsroom otomatis tampil di situs publik |
| **Arsitektur: pisah aplikasi editorial?** | rekomendasi beralasan + ambang kapan harus dipisah ada di `NEWSROOM.md` §5 — sekarang cukup satu basis kode, sudah siap dipisah tanpa tulis ulang |
| Website publik (beranda, tonton, live, 404) | healthcheck 200 semua, Lighthouse-ready (meta/OG/JSON-LD) |
| Halaman legal Privasi & Syarat | baru dibuat, tertaut dari semua footer, masuk sitemap & precache PWA |
| Web app 9 modul + RBAC | smoke: sales → CSV keuangan **403**, direksi → **200** |
| Backend hardened | CSP/HSTS/nosniff, gzip (11,8 KB → 4,3 KB), `trust proxy`, 0 kerentanan npm |
| Observabilitas | `/api/metrics` (401 tanpa token, 200 untuk direksi), access log |
| Ganti sandi & profil mandiri | 8 uji baru: sandi `<10` → 400, `demo123` → 400, sandi lama salah → 401, email duplikat → 409 |
| PWA | manifest + sw `mbc-tv-v2` + halaman offline + ikon |
| Android | proyek Kotlin `tv.mbcindonesia.app` + `assetlinks.json` (fingerprint masih placeholder) |
| Backup/restore | drill: dump 13 tabel → restore → `programs=8 episodes=26 users=4 audit=5` identik |
| Docker | multi-stage, non-root, tini, healthcheck, `COPY website/ → /website` (layout sudah disimulasikan & lulus 18/18) |
| CI GitHub Actions | backend (Postgres 17 + 45 uji), frontend (audit HTML/a11y/PWA/aset), Android build, Docker build |
| Ops | systemd hardened, nginx + certbot, `healthcheck.sh` 22 pemeriksaan, `backup.sh`/`restore.sh` |
| Rilis | repo git lokal + tag `v1.2.0` (sebelumnya `v1.0.0-rc1`), `.gitignore` memblokir `.env`/keystore/backup |

## Yang MENUNGGU MBC (tidak bisa dikerjakan dari sandbox)

| # | Kebutuhan | Perkiraan waktu | Rujukan |
|---|---|---|---|
| 1 | Akun Neon PostgreSQL + `DATABASE_URL` (sslmode=require) | 20 menit | GO-LIVE §1 |
| 2 | Server/VPS + `JWT_SECRET` baru (`openssl rand -hex 48`) | 30 menit | GO-LIVE §2 |
| 3 | Domain `mbcindonesia.tv` + DNS + TLS (certbot) | 45 menit + propagasi | GO-LIVE §3 |
| 4 | Ganti 4 akun demo (password ≥10 char + email staf asli) | 15 menit | GO-LIVE §5 |
| 5 | **UAT & sign-off Direksi (blueprint §17)** | 1–2 hari kerja | UAT-CHECKLIST.md |
| 6 | Keystore rilis → SHA-256 → `assetlinks.json` | 30 menit | GO-LIVE §7 |
| 7 | Akun Play Console + unggah AAB + review Google | 3–7 hari | GO-LIVE §7 |

**Estimasi realistis sampai live publik: 1 hari kerja teknis + waktu review/sign-off.**
Tanpa menunggu Play Store, **website + web app bisa live dalam ±2 jam** setelah kredensial tersedia.

## Cara MBC memverifikasi sendiri dalam 5 menit

```bash
# di server produksi setelah deploy
BASE_URL=https://mbcindonesia.tv ./ops/healthcheck.sh     # harus: ✅ SEMUA PEMERIKSAAN LULUS
DATABASE_URL="postgres://…neon…?sslmode=require" ./ops/backup.sh   # harus: ✅ backup OK
```
Lalu buka di browser: beranda → tonton (kirim komentar) → live → workspace (login direktur) →
Pengaturan → Keamanan Akun (ganti sandi) → Audit Trail (aksi tadi tercatat).

## Risiko yang masih terbuka (jujur)

1. **Akun demo masih aktif di lingkungan demo** — wajib diganti sebelum domain publik (GO-LIVE §5).
2. **`assetlinks.json` masih placeholder** — App Links Android belum aktif sampai fingerprint diisi.
3. **APK/AAB belum pernah dikompilasi** di lingkungan ini (tidak ada Android SDK) — job CI menyiapkannya.
4. **Angka pada data contoh ilustratif**, bukan data keuangan MBC sebenarnya.
5. **Rate limit & sesi masih in-memory/JWT localStorage** — cukup untuk fase awal; untuk skala
   multi-server perlu Redis + cookie `HttpOnly`.
6. **Belum ada sertifikasi keamanan/pentest pihak ketiga** — disarankan sebelum menangani data
   keuangan produksi penuh.
7. **Akuntansi/payroll penuh (blueprint Fase 4–5) di luar lingkup rilis ini.**

_Kesimpulan: sistem siap di-UAT oleh Direksi hari ini. Go-live publik menunggu 7 butir di atas,
dan tidak ada satu pun yang perlu ditunda karena pekerjaan teknis di sisi kami._
