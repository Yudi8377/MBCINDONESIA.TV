# 🚀 GO-LIVE MBCINDONESIA.TV — Panduan Eksekusi

> **Database:** panduan lengkap Supabase (buat proyek → connection string → `node setup-supabase.js` →
> verifikasi `/api/health`) ada di **[DATABASE-SUPABASE.md](DATABASE-SUPABASE.md)**.
> **Tampilan ponsel/tablet:** lihat **[RESPONSIVE.md](RESPONSIVE.md)** (penyebab, perbaikan, dan cara uji).

Dokumen ini adalah **daftar periksa operasional** untuk membawa hasil build (tag `v1.0.0-rc1`)
dari workspace ini menuju **produksi nyata**. Semua langkah teknis sudah disiapkan sebagai
artefak di repo; yang tersisa adalah tindakan yang **wajib dilakukan pemilik bisnis/IT MBC**
karena memerlukan kredensial, domain, dan persetujuan resmi.

Ringkasan status: **Kode & infrastruktur = siap. Kredensial & sign-off = menunggu MBC.**

---

## 0. Ringkasan 10 gerbang go-live

| # | Gerbang | Status | Pemilik |
|---|---------|--------|---------|
| 1 | Build & uji otomatis lulus (CI) | ✅ siap — 19 uji API + cek PWA/aset | Tim Dev |
| 2 | Database produksi (**Supabase** disarankan; Neon tetap didukung) | ✅ **selesai** — proyek `uoepuofjitaozrlmxomk` (ap-southeast-1, PG 17, semua service `ACTIVE_HEALTHY`), 28 tabel, ±250 baris, aplikasi tersambung via role `mbc_app` + pooler | IT MBC |
| 3 | `JWT_SECRET` produksi (acak, 48 byte) | ✅ **selesai** — 96 hex di `server/.env` (mode 600, di-`.gitignore`) | IT MBC |
| 4 | Domain + DNS + TLS | ⏳ **menunggu MBC** — perlu registrar/DNS `mbcindonesia.tv` + TLS; konfigurasi nginx systemd sudah disiapkan di `ops/` | IT MBC |
| 5 | Deploy aplikasi (Docker/systemd) | ✅ artefak siap | IT MBC |
| 6 | Backup otomatis + uji restore | ✅ skrip + drill sudah diuji | IT MBC (jadwalkan) |
| 7 | `assetlinks.json` (App Links) | ⏳ **menunggu MBC** — perlu generate keystore rilis + SHA-256 (tidak bisa dari sandbox) | Tim Android |
| 8 | Play Store: pendaftaran + unggah AAB | ⏳ **menunggu MBC** — akun Play Console (biaya satu kali) + keystore; AAB belum bisa dibangun di sandbox (tanpa Android SDK) | Tim Android |
| 9 | **UAT & sign-off Direksi (blueprint §17)** | ⏳ wajib, lihat `UAT-CHECKLIST.md` | Direksi |
| 10 | Ganti seluruh akun demo + password default | ⏳ wajib sebelum publik | IT MBC |

> ⚠️ **Jangan arahkan domain publik sebelum gerbang 9 & 10 selesai.** Aplikasi masih memakai
> akun demo (`demo123`) dan angka contoh; membukanya ke publik tanpa dua langkah itu = risiko nyata.

---

## 1. Siapkan database produksi (Neon)

1. Daftar di [neon.tech](https://neon.tech) → buat project **region Singapura** (latensi terendah untuk Indonesia).
2. Salin connection string; **wajib** berakhiran `?sslmode=require`.
3. Muat skema + data awal dari mesin lokal:
   ```bash
   psql "postgres://USER:PASS@ep-xxxx.ap-southeast-1.aws.neon.tech/mbctv?sslmode=require" \
        -v ON_ERROR_STOP=1 -f server/schema.sql
   ```
   (Opsional, hanya untuk demo/UAT) isi data contoh: `DATABASE_URL='...' node server/seed.js`
4. Untuk data **nyata**, jangan seed demo — kosongkan lewat panel Master Data di web app.
5. Aktifkan **PITR/backup** bawaan Neon + jalankan `ops/backup.sh` harian (cron, lihat §6).

## 2. Siapkan server aplikasi

Pilih salah satu; keduanya menghasilkan endpoint `http://IP:8080`.

**A. Docker (paling cepat)**
```bash
git clone <repo> && cd mbcindonesia/server
cp .env.production.example .env
openssl rand -hex 48                     # → tempel ke JWT_SECRET
nano .env                                # isi DATABASE_URL (+ POSTGRES_PASSWORD bila pakai db lokal compose)
docker compose up -d --build
docker compose ps                        # app harus "healthy"
```

**B. VPS + systemd (tanpa Docker)**
```bash
sudo apt update && sudo apt install -y nodejs npm nginx postgresql-client
sudo mkdir -p /srv && sudo cp -r mbcindonesia /srv/ && cd /srv/mbcindonesia/server
npm ci --omit=dev
cp .env.production.example .env && nano .env      # JWT_SECRET + DATABASE_URL
sudo cp ../ops/systemd/mbcindonesia-tv.service /etc/systemd/system/
sudo useradd -r -s /usr/sbin/nologin mbc && sudo chown -R mbc:mbc /srv/mbcindonesia
sudo systemctl daemon-reload && sudo systemctl enable --now mbcindonesia-tv
journalctl -u mbcindonesia-tv -f                 # pantau log
```

## 3. Domain, DNS, dan TLS

1. Arahkan `A` record `mbcindonesia.tv` **dan** `www` ke IP server.
2. Pasang sertifikat:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   sudo cp ops/nginx/mbcindonesia.tv.conf /etc/nginx/sites-available/
   sudo ln -s /etc/nginx/sites-available/mbcindonesia.tv.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d mbcindonesia.tv -d www.mbcindonesia.tv --redirect
   ```
3. Setelah HTTPS aktif, verifikasi: `BASE_URL=https://mbcindonesia.tv ./ops/healthcheck.sh`
   → HSTS otomatis wajib lulus di skema `https`.

## 4. Verifikasi pasca-deploy (wajib, ±5 menit)

```bash
BASE_URL=https://mbcindonesia.tv ./ops/healthcheck.sh
```
Harus keluar **`✅ SEMUA PEMERIKSAAN LULUS`** (16 pemeriksaan: halaman, API, 404, header keamanan, gzip).

Uji manual tambahan:
- Login Direktur → Dashboard menampilkan angka dari database produksi.
- Unggah komentar di halaman tonton → muncul di daftar.
- Buka di ponsel → banner "Instal aplikasi" (PWA) muncul.
- Nyalakan mode pesawat → halaman offline tetap tampil.
- Cek `/api/metrics` dengan akun direksi (uptime, memori, jumlah baris).

## 5. Ganti kredensial demo (gerbang 10, WAJIB)

**Jalur UI (disarankan):** login → menu **Pengaturan → Keamanan Akun**. Isi kata sandi saat ini
(`demo123`) dan kata sandi baru (≥10 karakter). Server menolak kata sandi baru yang masih `demo123`,
menolak bila sama dengan yang lama, dan mencatat tindakan ke audit log.

Untuk **setiap** akun (`direktur@`, `finance@`, `sales@`, `redaksi@`): ganti kata sandi ke kata sandi
kuat unik, lalu ganti email demo ke email staf asli (menu Pengaturan / ubah profil). Bisa juga lewat API:

```bash
# 1) dapatkan token
TOKEN=$(curl -s -X POST https://mbcindonesia.tv/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"direktur@mbcindonesia.tv","password":"demo123"}' | jq -r .token)
# 2) ganti kata sandi
curl -s -X POST https://mbcindonesia.tv/api/auth/password -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"current":"demo123","next":"KataSandiKuatAnda2026!"}'
# 3) ubah nama/email profil
curl -s -X PATCH https://mbcindonesia.tv/api/auth/profile -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Nama Asli","email":"nama@mbcindonesia.tv"}'
```

Verifikasi tidak ada akun demo tersisa:
```sql
SELECT email, name, role FROM users ORDER BY role;
```
Semua akun harus sudah memakai email asli; uji login dengan `demo123` harus **401**.

### Opsional: matikan akun demo sekaligus
```sql
UPDATE users SET pass_hash = crypt(gen_random_uuid()::text, gen_salt('bf')) WHERE email LIKE '%@mbcindonesia.tv';
-- lalu buat akun staf baru lewat panel Master Data / seed khusus produksi
```

## 6. Backup otomatis harian (cron)

```bash
sudo crontab -e -u mbc
# 02:15 WIB setiap hari, retensi 14 hari:
15 2 * * * DATABASE_URL="postgres://...neon.tech/mbctv?sslmode=require" /srv/mbcindonesia/ops/backup.sh >> /var/log/mbctv-backup.log 2>&1
```
Uji restore tiap kuartal ke database sementara:
```bash
TARGET_DATABASE_URL="postgres://.../mbctv_restore_test" ./ops/restore.sh backups/mbctv-XXXX.sql.gz
```
✅ Drill sudah dieksekusi di workspace: dump 13 tabel → restore → `programs=8 episodes=26 users=4 audit=5` identik.

## 7. Android / App Links (setelah keystore rilis ada)

1. Rilis AAB dengan keystore produksi (simpan **di luar repo**, cadangkan 2 tempat):
   ```bash
   cd android && ./gradlew bundleRelease
   keytool -list -v -keystore rilis.jks -alias mbc | grep SHA256   # salin fingerprint
   ```
2. Tempel fingerprint ke `website/.well-known/assetlinks.json` (menggantikan `GANTI_DENGAN_...`).
3. Deploy ulang, verifikasi: `curl https://mbcindonesia.tv/.well-known/assetlinks.json`.
4. Play Console: buat app `tv.mbcindonesia.app` → unggah AAB → isi Data safety, Privacy Policy,
   screenshot, ikon 512×512 → review internal dulu → produksi.
5. Pastikan `BASE_URL` di aplikasi Kotlin menunjuk domain https produksi.

## 8. Rollback (bila deploy bermasalah)

```bash
# Docker
docker compose down && git checkout v1.0.0-rc1 && docker compose up -d --build
# systemd
cd /srv/mbcindonesia && git fetch --tags && git checkout <tag-sebelumnya> && cd server && npm ci --omit=dev
sudo systemctl restart mbcindonesia-tv
```
Database: restore dari `backups/mbctv-*.sql.gz` terbaru dengan `ops/restore.sh`.
RTO realistis: **< 15 menit** (aplikasi) + waktu restore database.

## 9. Pemantauan setelah live

- Uptime: daftarkan `https://mbcindonesia.tv/api/health` di UptimeRobot/BetterStack (gratis, 5 menit sekali).
- Log: `journalctl -u mbcindonesia-tv -f` atau `docker compose logs -f app`.
- Metrik harian: `/api/metrics` (akun direksi) — uptime, memori, jumlah baris.
- Rotasi `JWT_SECRET` tiap 6 bulan (mengakhiri semua sesi, user login ulang).
- `npm audit` tiap bulan; target **0 high/critical** (saat ini 0).

---

## Yang TIDAK bisa saya lakukan dari sandbox (dan alasannya)

| Kebutuhan | Alasan | Yang sudah disiapkan |
|---|---|---|
| Deploy ke hosting nyata | Tidak ada kredensial & akses jaringan keluar server | Dockerfile, compose, systemd, nginx, healthcheck |
| Buat database Neon | Perlu pendaftaran akun + pembayaran | Skrip migrasi schema + `DATABASE_URL` di `.env` |
| APK/AAB Android | Sandbox tanpa Android SDK (unduhan ~1 GB) | Proyek Kotlin lengkap + job CI `assembleDebug` |
| Sign-off Direksi (§17) | Keputusan manusia | `UAT-CHECKLIST.md` siap ditandatangani |
| Pembelian domain | Perlu pembayaran | Konfigurasi nginx/certbot siap pakai |

_Semua langkah di atas memperkirakan total waktu eksekusi ±**4–6 jam kerja IT** (tanpa menunggu review Play Store)._ 
