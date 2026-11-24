# LAPORAN RILIS 1.5.0 — MBC SINGLE ACCOUNT

**Tanggal:** 24 November 2026 · **Versi:** 1.5.0 · **Tahap:** II dari roadmap audit
**Status uji:** API **54/54** · UI **29/29** (lokal, DB salinan produksi) · UI produksi **15/15**
**LIVE:** https://mbcindonesia-tv.vercel.app — deploy `dpl_4hRb8uXtkED5zZouFmkP2Uzq9Ti4` (commit `6929d95`)
diperbarui `dpl_7c1HL3cEW1kfbPuM3McpwGe1kppu` (commit `9ac9188`)

---

## 1. Yang dibangun

Satu akun untuk seluruh layanan MBC Indonesia (prasyarat 7 menu anggota pada roadmap):

| Kemampuan | Endpoint | Status |
|---|---|---|
| Pendaftaran anggota | `POST /api/akun/daftar` | ✅ |
| Masuk / keluar | `POST /api/akun/masuk`, `/keluar` | ✅ |
| Profil (baca/ubah) | `GET`/`PATCH /api/akun/saya` | ✅ |
| Ganti kata sandi | `POST /api/akun/sandi` | ✅ |
| Verifikasi email (OTP) | `POST /api/akun/otp/kirim`, `/otp/verifikasi` | ✅ |
| Lupa & pulihkan akun | `POST /api/akun/lupa`, `/pulihkan` | ✅ |
| 2FA TOTP + kode cadangan | `POST /api/akun/2fa/aktifkan`, `/2fa/konfirmasi`, `/2fa/matikan` | ✅ |
| Aktivitas masuk (perangkat) | `GET /api/akun/aktivitas` | ✅ |
| Daftar layanan anggota | `GET /api/akun/layanan` | ✅ |

Halaman baru: `masuk.html`, `daftar.html`, `lupa.html`, `akun/index.html`; menu **Masuk** di seluruh
halaman publik dan pintasan Masuk/Daftar di footer beranda.

---

## 2. Keputusan teknis yang perlu diketahui manajemen & tim IT

1. **Tanpa migrasi wajib — rilis bisa jalan hari ini.**
   Akun aplikasi `mbc_app` di Supabase **tidak berhak DDL** (uji langsung: `create table` →
   *permission denied for schema public*, `alter table users` → *must be owner of table*).
   Karena itu data akun memakai tabel yang sudah ada:
   - `users` → identitas + `pass_hash` (bcrypt cost 12)
   - `ai_findings` → catatan JSON bertanda (`profil`, `sesi`, `otp`, `2fa`)
   - `audit_log` → jejak aktivitas manusia (login, ganti sandi, verifikasi, 2FA)

   `docs/MIGRASI-1.5.0.sql` disediakan **opsional** bila tim IT ingin struktur relasional
   (`members`, `member_sessions`, `member_codes`, `member_2fa`, `member_events`). Modul mendeteksi
   tabel `members` otomatis.

2. **Anggota publik tidak pernah menyentuh CMS.** Constraint `users_role_check` hanya mengizinkan
   `direksi|finance|sales|editorial`; anggota publik disimpan sebagai `editorial` + label
   "Anggota Publik · …" dan CMS tetap memakai daftar staf tertutup. `/newsroom` tetap **401** tanpa token.

3. **Email OTP: tiga kanal siap, tinggal satu kredensial.** Modul otomatis memilih kanal dari env:
   - `RESEND_API_KEY` (+ `AKUN_EMAIL_DARI`) — paling mudah untuk Vercel, tanpa paket tambahan
   - `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS` — bila organisasi memakai SMTP sendiri
   - `AKUN_EMAIL_WEBHOOK` — webhook generik (Zapier/Make/worker internal)

   Bila belum ada kredensial: pendaftaran & masuk tetap penuh berfungsi; anggota diminta menekan
   **"Kirim kode verifikasi"** di dasbor dan menghubungi `halo@mbcindonesia.tv`. Kode **tidak pernah**
   ditampilkan ke publik. `AKUN_EMAIL_TERUSAN` (mis. `halo@mbcindonesia.tv`) menerima salinan kode
   khusus untuk membantu anggota secara manual — ini satu-satunya jalur dukungan dan tidak
   membocorkan apa pun ke pengguna lain.

4. **Kode di repositori bukanlah kunci.** Seluruh kredensial ada di Environment Variables Vercel.

---

## 3. Perbaikan yang ditemukan saat pengujian (dan sudah ditutup)

| Temuan | Dampak | Perbaikan |
|---|---|---|
| `/api/akun/lupa` mengembalikan kode reset di mode pratayang | **Kritis** — siapa pun yang tahu email staf bisa mengambil alih akun | Kode dipulihkan lewat email saja; respons tidak pernah memuat kode |
| Modal "Laporkan konten" menutupi formulir akun | Formulir tidak bisa diklik (transparan menutupi) | Gaya kritis `#laporModal[hidden]` dipasang lebih dulu + inline di `<head>` |
| Luapan horizontal `daftar.html` 486 px pada layar 360 px | Halaman bergeser di ponsel | `.form-akun` `max-width:min(460px,100%)`, label menumpuk < 540 px |
| Tautan S&K mengarah ke `../syarat.html` (404) | Pendaftar tidak bisa membaca syarat | Diperbaiki menjadi `syarat.html` |
| Kode OTP disimpan sebagai jenis `daftar`, verifikasi mencari `verifikasi` | Verifikasi email selalu gagal | Jenis diseragamkan + verifikasi mengenali email dari sesi |
| Aset dasbor `assets/…` relatif ke `/akun/` | CSS/JS 404 di dasbor | Diubah menjadi `../assets/…` |
| Versi aplikasi tersebar di beberapa tempat | `/api/health` bisa beda dari CHANGELOG | Satu sumber: `package.json`; env Vercel `APP_VERSION` → 1.5.0 |
| Formulir profil mengirim nama kosong saat hanya bio diubah | Simpan gagal "Nama minimal 2 karakter" (ditemukan di uji produksi) | Formulir diisi otomatis dari data akun; nama hanya dikirim bila ≥ 2 karakter |
| Gangguan DB sesaat dijawab 500 "Pendaftaran gagal diproses" | Pengguna mengira salah mengisi | Klasifikasi galat koneksi/pool → **503** "Layanan sedang sibuk", penanda `sementara: true` (teruji 5/5; **menunggu push berikutnya**) |

---

## 4. Cara menguji ulang (untuk tim IT)

```bash
# 1. Salinan produksi ke DB uji lokal (jangan uji di produksi)
createdb -h /tmp -p 5433 mbcuji
pg_restore -h /tmp -p 5433 -d mbcuji --no-owner backups/mbc-*.dump

# 2. Jalankan server uji
cd server && SUPABASE_DB_URL='postgresql://uji@localhost:5433/mbcuji?host=/tmp' \
  JWT_SECRET=uji AKUN_PRATAYANG_KODE=1 BATAS_KIRIM_JAM=50 node server.js

# 3. Uji API (54 kasus) & UI (29 kasus)
JWT_SECRET=uji python3 ops/uji-akun-1.5.0.py
JWT_SECRET=uji python3 ops/uji-ui-akun-1.5.0.py
```

Catatan: skrip uji **membersihkan akun/data uji** di akhir; `audit_log` produksi tidak disentuh
karena uji dijalankan di DB salinan.

---

## 5. Variabel lingkungan 1.5.0

| Variabel | Wajib | Keterangan |
|---|---|---|
| `JWT_SECRET` | ✅ | sudah ada; dipakai juga untuk token sesi anggota |
| `SUPABASE_DB_URL` | ✅ | sudah ada |
| `APP_VERSION` | — | sebaiknya `1.5.0` |
| `AKUN_MODE` | — | `pratayang` (bawaan) / `email` |
| `RESEND_API_KEY` + `AKUN_EMAIL_DARI` | — | kanal email utama (disarankan) |
| `SMTP_HOST` … `SMTP_PASS` | — | alternatif SMTP |
| `AKUN_EMAIL_WEBHOOK` | — | alternatif webhook |
| `AKUN_EMAIL_TERUSAN` | — | salinan kode untuk dukungan internal |
| `AKUN_PRATAYANG_KODE` | — | **hanya untuk uji lokal**; jangan di produksi |
| `AKUN_BATAS_DAFTAR`, `_MASUK`, `_LUPA`, `_PULIH`, `_OTPVERIF`, `_OTPKIRIM`, `_SANDI` | — | menyesuaikan batas laju |
| `AKUN_NONAKTIF=1` | — | mematikan seluruh modul akun |

---

## 6. Hasil uji produksi (setelah live)

| Yang diuji di https://mbcindonesia-tv.vercel.app | Hasil |
|---|---|
| Halaman publik lama (beranda, berita, live, rubrik, kontributor) | ✅ 200 |
| Halaman akun (`masuk`, `daftar`, `lupa`, `/akun`) | ✅ 200 ( `/akun/` → 308 → `/akun` 200 ) |
| `/newsroom` tanpa token | ✅ **401**, 7.173 B (gerbang) |
| `POST /api/akun/daftar` | ✅ 201, kode verifikasi **tidak** muncul di respons |
| `GET /api/akun/{saya,layanan,aktivitas}` | ✅ 200 dengan token, **401** tanpa token |
| Masuk salah/benar | ✅ 401 / 200 |
| 2FA produksi: aktifkan → konfirmasi TOTP → masuk tanpa kode (428) → masuk dengan kode (200) → matikan (200) | ✅ seluruh siklus |
| `POST /api/akun/lupa` | ✅ 200 tanpa membocorkan kode |
| UI produksi (daftar → dasbor → ubah bio → keluar → masuk ulang) | ✅ 15/15, tanpa galat JS |
| Responsif 360 px & 390 px (halaman daftar & dasbor) | ✅ tanpa geser horizontal |
| `/api/health` | ✅ 200, db true, versi **1.5.0** |

Catatan jujur: saat uji, Supabase sempat tidak terhubung beberapa detik (`db:false`) sehingga satu
pendaftaran dijawab 500; setelah koneksi pulih semuanya 201. Perbaikan pesan (503) sudah dikerjakan
dan teruji klasifikasinya, tetapi **belum terkirim** karena kode perangkat GitHub kedaluwarsa.

## 7. Sisa pekerjaan (rekomendasi rilis berikutnya)

1. Aktifkan kanal email: buat kunci Resend (gratis 100 email/hari) atau SMTP, lalu uji kirim
   sungguhan ke satu alamat internal sebelum diumumkan.
2. Jalankan `docs/MIGRASI-1.5.0.sql` (opsional) agar data akun punya tabel sendiri.
3. Menu anggota lanjutan (1.6.0): berita tersimpan, kiriman saya, notifikasi, langganan.
4. Ganti kata sandi `demo123` pada 4 akun staf (masih terbuka dari Tahap I).
