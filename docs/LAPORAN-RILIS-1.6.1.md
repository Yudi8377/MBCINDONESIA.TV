# Laporan Rilis 1.6.1 — Peran Lengkap (RBAC) + Panel Administrator

Tanggal: 21 November 2026 · Status: **LIVE di produksi**
Commit produksi: `b021a95` · Deploy: `dpl_2poWitz7QToCBjJ4YKMh6MLhxqVx`
Domain: `https://mbcindonesia-tv.vercel.app`

---

## 1. Yang berubah untuk pengguna

### Panel administrator di Newsroom
Menu baru **TATA KELOLA → Pengguna & Peran** (hanya tampil untuk administrator):

- daftar staf + pencarian nama/email/jabatan
- ubah **peran** lewat pilihan (8 opsi, tanpa mengetik kode)
- ubah **label jabatan** bebas (“Redaktur Pelaksana”, “Wakil Pemred”, …)
- **setel ulang sandi** (≥8 karakter, huruf + angka, bcrypt cost 12)
- **aktif / nonaktifkan** akun — akun nonaktif langsung ditolak walau token masih sah
- **+ Akun staf baru** — sandi sementara acak ditampilkan **sekali**
- tabel **matriks izin** per peran, dibaca dari sumber yang sama dengan gerbang server

Pengaman: administrator tidak bisa menurunkan/menonaktifkan dirinya sendiri; administrator
terakhir tidak bisa dicabut; semua perubahan masuk `audit_log`.

### Delapan peran
`admin` · `direksi` · `pemred` · `redaktur` · `reporter` · `editorial` · `finance` · `sales`

### Halaman masuk publik
`/masuk.html` kini menjelaskan **dua pintu**: publik (anggota/kreator/kontributor/mitra) dan
internal (Newsroom, akun dibuat administrator), lengkap dengan tautan ke pintu internal.
Tautan `Rubrik.html` yang salah huruf diperbaiki menjadi `rubrik.html` (sebelumnya 404 di
server Linux/Vercel).

---

## 2. Keputusan teknis penting

**Peran baru tanpa DDL.** Constraint `users_role_check` di database hanya menerima
`direksi/finance/sales/editorial`, dan peran aplikasi `mbc_app` tidak berhak mengubahnya.
Peran baru disimpan sebagai penanda pada label jabatan:

```
staff.title = "Pemimpin Redaksi · mbc:role=pemred"
users.role  = "editorial"          ← nilai aman constraint
```

`server/peran.js` membaca penanda itu (`peranEfektif()` / `dariBaris()`), dan **semua** jalur
memakai peran efektif: login, token JWT, `/api/state`, gerbang peran tiap endpoint, dan panel
admin. Bila constraint kelak dilonggarkan, aplikasi otomatis memakai `users.role` apa adanya.

**Perbaikan pooler Supabase (ditemukan saat rilis).** `/api/health` sempat menjawab `db:false`
setelah deploy. Penyebabnya bukan kode rilis: session pooler Supabase hanya memberi **15 klien
untuk seluruh proyek**, sedangkan setiap instans serverless memegang satu selama koneksi
terbuka. `server/db.js` kini menyesuaikan diri saat serverless: **1 klien per instans**
(`PG_POOL_MAX=1` di produksi), koneksi menganggur ditutup setelah 3 detik, `allowExitOnIdle`,
dan `EMAXCONNSESSION` diperlakukan sebagai galat transien (dicoba ulang) alih-alih 503.

---

## 3. Hasil uji

| Lingkup | Hasil |
|---|---|
| API RBAC + panel admin (`ops/uji-rbac.py`) | **60/60** |
| UI panel admin, Chromium (`ops/uji-ui-pengguna.py`) | **50/50** |
| Regresi multi-agen (`ops/uji-agen-ai.py`) | 30/30 |
| Regresi jalur LLM (`ops/uji-agen-llm.py`) | 13/13 |
| Regresi UI Studio AI (`ops/uji-ui-agen.py`) | 33/33 |
| Verifikasi database Supabase sungguhan (lokal) | 21/21 |
| **Produksi live** setelah deploy | **19/19** |

Verifikasi produksi mencakup: halaman publik 200, `/newsroom` dan seluruh endpoint panel
tertutup untuk anonim (401, isi CMS tidak bocor), login staf → peran efektif terbaca,
`/api/state` mengembalikan izin sesuai peran, staf non-admin ditolak 403 dari panel,
studio agen terbuka untuk editorial, serta `sales` ditolak dari modul editorial.

`/api/health` → `db:true`, `version:1.6.1`, stabil pada 5 percobaan berturut-turut.
`/api/healthz` → `version:1.6.1`.

---

## 4. Langkah setelah rilis (perlu tindakan manusia)

1. **Angkat administrator pertama** — sekali, di SQL Editor Supabase:

   ```sql
   UPDATE staff SET title = 'Administrator · mbc:role=admin'
   WHERE lower(user_email) = 'pimpinan@mbcindonesia.tv';
   ```

   Sesuaikan email dengan akun pimpinan yang dipakai. Setelah itu semua penugasan peran
   dilakukan dari UI.

2. **(Opsional) jalankan `docs/MIGRASI-1.6.1.sql`** sebagai pemilik tabel (`postgres`,
   bukan `mbc_app`) untuk mengaktifkan kolom `status`, `updated_at`, `last_login`.
   Tanpa migrasi aplikasi tetap jalan; tombol Aktif/Nonaktif menjawab 501 + petunjuk.

3. **Ganti sandi demo** `demo123` pada semua akun staf lewat panel **Setel sandi**
   (atau biarkan administrator membuat ulang akunnya).

---

## 5. Catatan operasional

- Deploy produksi memakai `git_source {ref: main, repoId: 1467462147}`. Push ke `main`
  pada repo ini ternyata **memicu build Git otomatis** meski auto-deploy pernah nonaktif —
  tetap verifikasi `version` di `/api/health` setiap rilis.
- `APP_VERSION` di environment Vercel kini `1.6.1`; `PG_POOL_MAX=1` (production).
- Bila pooler kembali melaporkan `max clients reached in session mode`, tunggu ±3 menit —
  jangan menaikkan `PG_POOL_MAX` untuk serverless.
