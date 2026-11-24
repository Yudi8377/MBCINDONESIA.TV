# Perbaikan Video per Episode — MBCINDONESIA.TV

Dibuat: 21 November 2026 · Versi: 1.4.15

## Masalah

`Ruang Bisnis — Ep 24 — UMKM Kediri Go Global` memutar video berjudul **Jelajah Nusantara**.

## Akar masalah

Kolom `episodes.video_key` berisi kunci klip **generik** yang dibuat dari satu bundel footage
("Jelajah Nusantara" dan lainnya). Hanya ada **11 klip generik** untuk **26 episode**, jadi
pemetaannya saling menumpuk: `ruang-bisnis` ep 0 → `subaru`, `jejak-nusantara` memakai
`sintel/bunny/elephants/tos`, dst. Akibatnya satu klip diputar oleh beberapa program sekaligus
dan label di dalam video tidak cocok dengan judul episode.

## Perbaikan

1. **26 klip unik** dibuat ulang (`ops/buat-video-episode.py`): latar foto program + label
   program + judul episode, durasi 6 detik, H.264 CRF 31, tanpa audio (hemat kuota, 8,3 MB total).
2. Nama berkas = **slug judul episode**, sehingga tautan video bisa diaudit secara visual.
3. `episodes.video_key` di Supabase diperbarui untuk **26/26 baris** (UPDATE, tanpa DDL).
4. `website/assets/js/data.js`, `server/seed.js`, dan API `/api/programs` kini menunjuk klip
   per episode — bukan klip generik.
5. `website/watch.html`: cadangan darurat tidak lagi memakai klip program lain; bila kunci tak
   dikenal, dipakai klip **episode pertama dari program yang sama**.
6. Ditambahkan label "**Sedang diputar: <Program> · <Judul Episode>**" di bawah pemutar agar
   ketidakcocokan langsung terlihat.
7. 11 klip generik lama (`bunny`, `subaru`, `sintel`, …) dihapus dari repo.

## Verifikasi

| Uji | Hasil |
|---|---|
| 26 klip ada di disk & HTTP 200 | ✅ 26/26 |
| `episodes.video_key` unik per episode | ✅ 26 baris diperbarui |
| Chromium memutar klip yang benar (5 sampel, `readyState=4`, waktu berjalan) | ✅ 5/5 |
| Ruang Bisnis Ep 24 menampilkan label "RUANG BISNIS / Ep 24 - UMKM Kediri Go Global" | ✅ (tangkapan layar) |
| Kunci video generik tersisa di kode | ✅ 0 |

## Tabel pemetaan (26 episode)

| Program | Episode | Video |
|---|---|---|
| Bicara Petang | Ep 101 — Pelajaran dari Pemilik Kedai Kopi Viral | `ep-101-pelajaran-dari-pemilik-kedai-kopi-viral.mp4` |
| Bicara Petang | Ep 100 — 100 Episode: Refleksi Bersama | `ep-100-100-episode-refleksi-bersama.mp4` |
| Bicara Petang | Ep 99 — Atlet Panjat Tebing & Mental Juara | `ep-99-atlet-panjat-tebing-mental-juara.mp4` |
| Dapur Rempah | Ep 9 — Rawon Kediri: Kuah Hitam yang Juara | `ep-9-rawon-kediri-kuah-hitam-yang-juara.mp4` |
| Dapur Rempah | Ep 8 — Rendang: 12 Jam Kesabaran | `ep-8-rendang-12-jam-kesabaran.mp4` |
| Dapur Rempah | Ep 7 — Soto Lamongan & Koya Legendaris | `ep-7-soto-lamongan-koya-legendaris.mp4` |
| Jejak Nusantara | Ep 8 — Bromo: Negeri di Atas Awan | `ep-8-bromo-negeri-di-atas-awan.mp4` |
| Jejak Nusantara | Ep 7 — Borobudur: Candi Terbesar di Dunia | `ep-7-borobudur-candi-terbesar-di-dunia.mp4` |
| Jejak Nusantara | Ep 6 — Raja Ampat dari Ketinggian | `ep-6-raja-ampat-dari-ketinggian.mp4` |
| Jejak Nusantara | Spesial — Warisan Maritim Nusantara | `spesial-warisan-maritim-nusantara.mp4` |
| Kabar Nusantara | Kabar Nusantara Pagi — Edisi 21 Nov 2026 | `kabar-nusantara-pagi-edisi-21-nov-2026.mp4` |
| Kabar Nusantara | Kabar Nusantara Petang — Edisi 20 Nov 2026 | `kabar-nusantara-petang-edisi-20-nov-2026.mp4` |
| Kabar Nusantara | Sorotan Minggu Ini: Ekonomi Daerah | `sorotan-minggu-ini-ekonomi-daerah.mp4` |
| Kabar Nusantara | Laporan Khusus: Infrastruktur Jawa Timur | `laporan-khusus-infrastruktur-jawa-timur.mp4` |
| Kamera Komunitas | Ep 15 — Pasar Pahing: Jantung Kota Kediri | `ep-15-pasar-pahing-jantung-kota-kediri.mp4` |
| Kamera Komunitas | Ep 14 — Nelayan Muara Angke Bertahan | `ep-14-nelayan-muara-angke-bertahan.mp4` |
| Kamera Komunitas | Ep 13 — Komunitas Sepeda Tua Bandung | `ep-13-komunitas-sepeda-tua-bandung.mp4` |
| Panggung Musik | Ep 18 — Panggung Akustik: Lintang & Samudra | `ep-18-panggung-akustik-lintang-samudra.mp4` |
| Panggung Musik | Ep 17 — Indie Kediri Night | `ep-17-indie-kediri-night.mp4` |
| Panggung Musik | Ep 16 — Kolaborasi: Gamelan x Elektronik | `ep-16-kolaborasi-gamelan-x-elektronik.mp4` |
| Ruang Bisnis | Ep 24 — UMKM Kediri Go Global | `ep-24-umkm-kediri-go-global.mp4` |
| Ruang Bisnis | Ep 23 — Arah Suku Bunga & Investasi 2027 | `ep-23-arah-suku-bunga-investasi-2027.mp4` |
| Ruang Bisnis | Ep 22 — Rantai Pasok Ekspor Jawa Timur | `ep-22-rantai-pasok-ekspor-jawa-timur.mp4` |
| Selasar Budaya | Ep 12 — Gamelan & Gerak: Yogyakarta | `ep-12-gamelan-gerak-yogyakarta.mp4` |
| Selasar Budaya | Ep 11 — Wayang Kulit: Dalang Muda Surakarta | `ep-11-wayang-kulit-dalang-muda-surakarta.mp4` |
| Selasar Budaya | Ep 10 — Tari Saman di Tanah Gayo | `ep-10-tari-saman-di-tanah-gayo.mp4` |


## Verifikasi di PRODUKSI (24 Nov 2026)

Deploy `dpl_6BG6LanwMnP6SW3RuKcNnM18ngF8` (commit `ab89551`) — status **READY**, alias `mbcindonesia-tv.vercel.app`.

| Uji produksi | Hasil |
|---|---|
| 26 klip episode dapat diakses (HTTP 200) | ✅ 26/26 |
| 11 klip generik lama (`subaru`, `bunny`, …) | ✅ 404 — benar-benar hilang dari CDN |
| Chromium: **seluruh 26 episode** diputar satu per satu, `currentSrc` = klip episode itu | ✅ **26/26 lulus, 0 gagal** |
| Ruang Bisnis Ep 24 | ✅ klip berlabel "RUANG BISNIS · Ep 24 - UMKM Kediri Go Global" |
| Halaman publik (`/`, `/live.html`, `/berita.html`, `/watch.html`, `/privasi.html`, `/syarat.html`, `/sitemap.xml`, `/sw.js`, `/manifest.webmanifest`) | ✅ semua 200 |
| API (`/api/healthz`, `/api/programs`) | ✅ 200 |
| Gerbang CMS `/newsroom` tanpa token | ✅ 401 (tetap terlindungi) |

Bukti tangkapan layar produksi: `docs/bukti/ruang-bisnis-ep24-produksi.png`.

## Catatan

Klip ini adalah **kartu siaran** (bumper 6 detik) per episode, bukan potongan acara penuh.
Untuk tayangan penuh, unggah berkas ke `website/assets/video/<slug>.mp4` dan perbarui
`video_key` episode tersebut — UI otomatis memutar berkas baru.
