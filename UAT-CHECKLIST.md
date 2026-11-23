# ✅ UAT — User Acceptance Test MBCINDONESIA.TV

**Versi:** `v1.0.0-rc1`  **Tanggal uji:** ____________
**Penguji:** ______________________  **Peran:** ______________________
**Lingkungan:** ☐ Staging (`https://staging...`)  ☐ Produksi  ☐ Lokal (`http://localhost:8080`)

Cara pakai: jalankan tiap butir, isi **Hasil** (`L`=Lulus / `G`=Gagal / `T`=Tidak berlaku),
catat temuan di kolom Catatan. Rilis dinyatakan diterima bila **tidak ada `G`** pada blok A–D
dan seluruh butir **wajib** lulus. Tanda tangan ada di bagian akhir (§17 blueprint).

---

## A. Website publik (pengunjung)

| # | Skenario | Langkah | Harapan | Hasil | Catatan |
|---|---|---|---|---|---|
| A1 | Beranda tampil | Buka `/` | Hero, program unggulan, jadwal, berita termuat < 3 dtk | | |
| A2 | Navigasi | Klik menu Beranda/Tonton/Live/Acara | Semua tujuan terbuka, tidak ada tautan mati | | |
| A3 | Halaman tonton | Buka `/watch.html?program=jejak-nusantara` | Detail program + daftar episode + pemutar | | |
| A4 | Pencarian/filter program | Ketik di kolom cari | Daftar menyaring sesuai kata kunci | | |
| A5 | Komentar | Isi nama + komentar → Kirim | Komentar muncul & tersimpan (muat ulang tetap ada) | | |
| A6 | Komentar kosong | Kirim form kosong | Ditolak dengan pesan jelas | | |
| A7 | Live | Buka `/live.html` | Jadwal live + pemutar/placeholder tampil | | |
| A8 | Newsletter | Isi email valid → Daftar | Pesan sukses; email ganda ditolak sopan | | |
| A9 | 404 | Buka `/halaman-tidak-ada` | Halaman 404 ramah + tombol kembali beranda | | |
| A10 | Responsif ponsel | Buka di lebar 375 px | Tidak ada scroll horizontal, menu jadi drawer | | |
| A11 | PWA bisa dipasang | Chrome Android → "Instal aplikasi" | Ikon, nama, splash benar; terbuka standalone | | |
| A12 | Mode offline | Nyalakan mode pesawat, buka ulang | Halaman offline/404 tampil, bukan layar putih | | |

## B. Web App internal — akses & peran

| # | Skenario | Langkah | Harapan | Hasil | Catatan |
|---|---|---|---|---|---|
| B1 | Login Direktur | `direktur@mbcindonesia.tv` / `demo123` | Masuk, nama & peran tampil di header | | |
| B2 | Password salah | Coba password keliru | Ditolak, pesan tidak membocorkan detail | | |
| B3 | Sesi bertahan | Muat ulang halaman | Tetap login (token 12 jam) | | |
| B4 | Logout | Klik Keluar | Kembali ke form login, data terlindungi | | |
| B5 | RBAC Sales | Login `sales@` → buka menu Keuangan | Menu/aksi keuangan tidak tersedia atau 403 | | |
| B6 | RBAC Finance | Login `finance@` → buka Audit | Sesuai matriks peran (read-only / ditolak) | | |
| B7 | Akses tanpa token | `curl /api/metrics` | 401 JSON | | |

## C. Modul operasional (fungsi inti)

| # | Modul | Skenario | Harapan | Hasil | Catatan |
|---|---|---|---|---|---|
| C1 | Dashboard | Buka Dashboard | Angka dari server (program, episode, deal, approval) konsisten dengan data | | |
| C2 | Program | Tambah program baru → simpan → muat ulang | Muncul di daftar & di website publik | | |
| C3 | Episode | Tambah episode pada program | Terhubung ke program yang benar | | |
| C4 | CRM | Buat deal → geser tahap → hapus | Tahap berubah, terhapus, audit tercatat | | |
| C5 | Ads | Tambah kampanye + unggah bukti | Kampanye tersimpan, bukti terhubung | | |
| C6 | Produksi | Majukan tahap proyek | Progres berpindah tahap sesuai alur | | |
| C7 | Keuangan | Setujui/tolak pengajuan | Status berubah; tidak bisa menyetujui dua kali | | |
| C8 | Keuangan | Kirim pengingat piutang | Tercatat, muncul pesan konfirmasi | | |
| C9 | Master Data | Tambah & hapus entri | Perubahan tersimpan, hapus minta konfirmasi | | |
| C10 | Audit | Buka log audit | Menampilkan semua aksi di atas, terbaru di atas, tidak bisa dihapus | | |
| C11 | Laporan | Unduh CSV KPI | File terunduh, isi sesuai periode | | |
| C12 | Pengaturan | Ubah profil / preferensi | Tersimpan & tetap setelah muat ulang | | |
| C13 | Keamanan Akun | Ganti kata sandi (salah lama → ditolak; baru <10 char → ditolak; valid → berhasil) | Login lama gagal, login sandi baru berhasil, tercatat di Audit | | |
| C14 | Keamanan Akun | Coba ganti sandi baru ke `demo123` | Ditolak server dengan pesan jelas | | |

## D. Non-fungsional (wajib sebelum publik)

| # | Aspek | Cara uji | Target | Hasil | Catatan |
|---|---|---|---|---|---|
| D1 | Performa beranda | Lighthouse (Chrome) | Performance ≥ 80, Accessibility ≥ 90 | | |
| D2 | Waktu muat | DevTools jaringan (4G lambat) | LCP < 3 dtk | | |
| D3 | Header keamanan | `./ops/healthcheck.sh` | 4 header + HSTS lulus | | |
| D4 | HTTPS | Buka `https://` | Gembok valid, `http://` dialihkan | | |
| D5 | Backup | Jalankan `ops/backup.sh` | File .sql.gz + .sha256 terbentuk | | |
| D6 | Restore | `ops/restore.sh` ke DB uji | Jumlah baris identik dengan sumber | | |
| D7 | Kata sandi demo | Cek semua akun (`SELECT email FROM users`) | Tidak ada lagi `demo123` di produksi (login demo → 401) | | |
| D9 | Privasi & Syarat | Buka `/privasi.html` & `/syarat.html` | Tampil, tertaut dari footer, tanpa tautan mati | | |
| D8 | Data contoh | Periksa isi | Data contoh diganti data asli / label "contoh" | | |

---

## E. Catatan temuan

| # | Modul | Tingkat (Kritis/Sedang/Ringan) | Deskripsi | PIC | Status |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

Kriteria rilis: **0 temuan Kritis**, ≤3 Sedang dengan rencana perbaikan tertulis.

---

## F. Sign-off (blueprint §17)

Dengan ini menyatakan hasil UAT di atas telah diperiksa dan sistem **layak dilanjutkan** ke
produksi sesuai cakupan yang disepakati (website publik, web app internal, PWA, dasar Android).

| Peran | Nama | Keputusan | Tanda tangan | Tanggal |
|---|---|---|---|---|
| Direktur Utama | | ☐ Setuju ☐ Setuju dengan syarat ☐ Tolak | | |
| Kepala Teknologi / IT | | ☐ Setuju ☐ Setuju dengan syarat ☐ Tolak | | |
| Kepala Keuangan | | ☐ Setuju ☐ Setuju dengan syarat ☐ Tolak | | |
| Pemilik Proses Redaksi | | ☐ Setuju ☐ Setuju dengan syarat ☐ Tolak | | |

**Cakupan yang secara eksplisit BELUM termasuk** (agar tidak menimbulkan ekspektasi keliru):
akuntansi/payroll penuh (Fase 4–5 blueprint), integrasi payment gateway, iklan programmatic,
analytics lanjutan, dan sertifikasi keamanan pihak ketiga. Angka pada data contoh bersifat ilustratif.
