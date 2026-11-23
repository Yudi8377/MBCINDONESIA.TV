# 📱 Website MBCINDONESIA.TV di Android, Tablet & iOS — Perbaikan & Cara Uji

Dokumen ini menjelaskan **apa yang membuat tampilan "buyar/ambyar" di Android**, apa yang sudah
diperbaiki, dan cara memverifikasi sendiri dalam 1 menit — di Android asli, tablet, maupun iPhone.

Bukti visual: folder [`docs/screens/`](screens) berisi tangkapan layar hasil uji otomatis
(Android 360 & 390 px, tablet 768 px, halaman berita, newsroom, dan editor artikel di ponsel).

---

## 1. Akar masalahnya (bukan satu bug, tapi beberapa)

| # | Penyebab | Akibat di layar Android | Perbaikan |
|---|---|---|---|
| 1 | **Tidak ada jaring aman lebar** — isi header bisa melebihi lebar layar | seluruh halaman bisa digeser ke samping, teks terpotong, "ambyar" | `body{overflow-x:hidden}` + `min-width:0` pada header/logo + `flex-wrap` terkendali |
| 2 | **Titik patah (breakpoint) kurang** — hanya 1024 px & 640 px | di 360–430 px elemen masih berukuran desktop | breakpoint baru: 1024 · 860 · 820 · 640 · 400 px + `clamp()` untuk tipografi |
| 3 | **Tabel kebijakan privasi 4 kolom** selebar 496 px | halaman melebar sampai 516 px → semua ikut bergeser | tabel dibungkus `.table-wrap` → **menggeser di dalam kotaknya sendiri**, halaman tetap rapi |
| 4 | **Navigasi tablet hilang** (menu disembunyikan ≤1024 px) | di tablet hanya ada tombol ☰, terasa "kosong" | nav tetap tampil mulai 861 px, ukurannya dirapatkan |
| 5 | **iOS: input <16 px** | iPhone otomatis zoom saat mengetik, tampilan melompat | semua `input/select/textarea` minimal 16 px |
| 6 | **Tombol melayang bertumpuk** (companion, kembali ke atas) | menutupi tombol penting di layar kecil | posisi dihitung ulang + `env(safe-area-inset-*)` untuk notch iPhone |
| 7 | **Target sentuh 13–18 px** (tautan, chip, footer) | salah tekan | minimum 32–44 px untuk semua kontrol utama (WCAG 2.5.8) |
| 8 | **Newsroom**: sidebar 248 px memakan layar ponsel, pill status panjang memaksa halaman melebar | panel terpotong, harus digeser | laci (drawer) + backdrop, tutup otomatis setelah memilih menu, pill ringkas `● ONLINE` |
| 9 | **`boot()` berjalan sebelum `cms.js` selesai dimuat** | di perangkat lambat muncul "viewDesk is not defined" | boot ditunda ke `window.load`, `navTo()` tahan gagal & menampilkan pesan jelas |

---

## 2. Yang sudah diubah (ringkas teknis)

**Situs publik** (`assets/css/site.css`, semua 7 halaman):
- `viewport-fit=cover`, `apple-mobile-web-app-capable`, `format-detection=telephone=no`
- `-webkit-text-size-adjust:100%`, `overflow-x:hidden`, `min-width:0` pada elemen flex
- tipografi `clamp()` untuk hero & judul; grid katalog 3 → 2 → 1 kolom (tablet → ponsel → 400 px)
- chip kategori bisa digeser horizontal (bukan memaksa baris baru), newsletter full-width
- semua input ≥16 px; target sentuh ≥40 px; tautan inline di paragraf dikecualikan (sesuai WCAG)
- `env(safe-area-inset-bottom)` untuk iPhone berlubang (notch) & home indicator

**Newsroom** (`newsroom/index.html`, `gerbang.html`):
- breakpoint 1024/900/640/400 px; sidebar jadi **laci** dengan backdrop & tombol Esc
- tabel dalam panel punya wadah geser sendiri; modal jadi *bottom sheet* di ponsel
- tinggi memakai `dvh` (tahan address-bar Android/Chrome & Safari iOS)
- gerbang login: kartu responsif, daftar peran bisa dibuka, tautan ≥40 px

---

## 3. Cara memverifikasi sendiri

### 3.1 Uji otomatis (paling cepat, 1 perintah)
```bash
cd mbcindonesia
npm i -D playwright-core@1.49.0
npx playwright@1.49.0 install chromium
BASE_URL=http://127.0.0.1:8080 node ops/responsive-audit.js
```
Keluaran yang diharapkan:
```
✅ 56 kombinasi halaman × perangkat lolos
   (tanpa geser horizontal, tanpa elemen keluar layar, tanpa error JS)
```
Skrip menguji 7 halaman pada 7 ukuran layar: Android 360/390, iPhone SE & 14 Pro, tablet potret &
lanskap, laptop.

### 3.2 Uji manual di HP Android
1. Buka `https://mbcindonesia.tv` di Chrome.
2. **Cubit-zoom keluar** — halaman tidak boleh mengecil sendiri (artinya viewport benar).
3. Geser ke samping sekuat mungkin — **tidak boleh ada ruang kosong di kanan**.
4. Ketuk kolom cari/catatan → **layar tidak boleh zoom** saat mengetik.
5. Putar HP (lanskap) → hero & katalog menyesuaikan tanpa terpotong.
6. Menu ☰ → semua tautan muncul, tap target nyaman.

### 3.3 Uji manual di iPhone
1. Safari → buka situs → **tidak ada zoom otomatis** saat mengetik di kolom cari.
2. Bagian bawah (footer) tidak tertutup *home indicator*.
3. Mode gelap/terang: teks tetap terbaca (situs memakai tema gelap tetap).
4. Tambahkan ke Home Screen → ikon & nama aplikasi benar (PWA).

### 3.4 Uji manual di tablet
- Potret 768 px: navigasi utama **tetap tampil** (bukan hanya ☰).
- Lanskap 1024 px: katalog 3 kolom, panel samping tidak menutupi konten.

### 3.5 Uji newsroom di ponsel
```
https://mbcindonesia.tv/newsroom/  →  halaman gerbang
redaksi@mbcindonesia.tv / demo123  →  Meja Redaksi
```
- ☰ membuka laci menu; pilih modul → laci menutup sendiri.
- Panel tabel bisa digeser di dalam kotaknya; halaman tidak ikut bergeser.
- Buka satu artikel → editor 7 tab tetap bisa dipakai satu tangan.

---

## 4. Kalau masih ada yang aneh di HP Anda

Kirimkan 3 hal ini supaya bisa saya perbaiki tepat sasaran:
1. Merek/tipe HP + versi Android/iOS + peramban (Chrome/Safari/in-app Instagram, dsb.).
2. Nama halaman (mis. "beranda", "berita", "newsroom").
3. Tangkapan layar — terutama bagian yang terlihat "buyar".

Catatan penting: bila Anda membuka file `index.html` **langsung dari penyimpanan** (bukan lewat
domain/server), beberapa hal memang berbeda (font, API, service worker). Untuk hasil sebenarnya,
buka lewat alamat server — di workspace ini gunakan panel **preview** yang disediakan.
