# Laporan Rilis 1.4.16 — Tahap I-b

**Tanggal:** 24 November 2026
**Situs produksi:** https://mbcindonesia-tv.vercel.app
**Commit:** `6920a62` · **Deploy:** `dpl_Fcj1k1q9hGQUnTfwbcdM48DCwyXW` (READY, alias terpasang)

## 1. Yang dirilis

| Butir audit | Fitur | Endpoint / berkas |
|---|---|---|
| B-13 | Analitik pengunjung nyata (tayangan, durasi baca, putar video, perangkat, halaman teratas, 7 hari) | `analitik.js`, `POST /api/analytics/collect`, `GET /api/analytics/summary` |
| B-02 | Jumlah penonton Live TV nyata (heartbeat 30 detik) | `POST /api/live/heartbeat` |
| B-07 | Pengiriman berita oleh kontributor | `kontributor.html`, `POST /api/kontributor/kirim` |
| B-20 | Pelaporan konten publik (6 jenis laporan) | tombol ⚑ + `POST /api/lapor` |
| B-04, B-05 | Rubrik daerah & internasional, filter wilayah | `rubrik.html`, `berita.html?rubrik=…`, `?wilayah=…` |
| F | Modul CMS "Kiriman & Laporan" | `GET/POST /api/newsroom/antrean` |
| B-19 | Backup database terverifikasi | `ops/backup-db.sh` |
| — | Angka statistik nyata di beranda | `data-statistik="pengunjung|tayangan|video"` |

## 2. Hasil uji produksi (11/11 lulus)

1. Analitik terkirim dari halaman produksi (HTTP 204).
2. Kartu statistik beranda terisi angka nyata.
3. Penonton Live TV menampilkan "penonton aktif (data nyata)".
4. Filter rubrik `internasional` → 1 artikel + penanda filter.
5. Filter wilayah `kediri` → 5 artikel.
6. Halaman rubrik memuat 14 tautan rubrik & wilayah.
7. Formulir kontributor tersedia.
8. Tombol lapor otomatis terpasang di semua halaman.
9. Validasi server menolak kiriman kosong.
10. Responsif Android 360 px tanpa overflow.
11. Responsif iPhone 390 px tanpa overflow.
12. CMS `/newsroom` tetap **401** tanpa token (keamanan tidak berubah).

## 3. Catatan teknis

- Akun aplikasi `mbc_app` **tidak berhak DDL**, sehingga:
  - analitik disimpan di `audit_log` dengan format `jenis:halaman:perangkat`;
  - antrean kiriman & laporan disimpan di `ai_findings` (`evidence->>'jenis'`).
- Rancangan tabel permanen + view + grant tersedia di `docs/MIGRASI-1.4.16.sql`. Jalankan di SQL Editor Supabase kapan pun; aplikasi tetap kompatibel (lihat langkah 7 di berkas itu untuk menukar sumber data).
- Batas kiriman: `BATAS_KIRIM_JAM` (default 3/jam); laporan 8/jam. Keduanya rate limit per IP.
- Retensi: baris analitik di `audit_log` sebaiknya dibersihkan berkala (contoh perintah ada di berkas migrasi).

## 4. Data uji

Seluruh data uji dihapus setelah pengujian. Kondisi DB setelah rilis:
`ai_findings` = 0 baris · `audit_log` = 44 baris (sama seperti sebelum sesi) · `articles` = 7 · `episodes` = 26 · `programs` = 8.

## 5. Pekerjaan berikutnya (Tahap II)

1. **MBC Single Account** — pendaftaran, OTP email, pemulihan akun, 2FA, dashboard anggota (prasyarat 7 menu baru).
2. Kamera Komunitas (peta, status online/offline, moderasi siaran).
3. Penjadwalan cron backup + uji restore berkala.
