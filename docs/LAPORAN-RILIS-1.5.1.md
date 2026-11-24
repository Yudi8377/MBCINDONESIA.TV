# Laporan Rilis 1.5.1 — Filter Rubrik, Wilayah, dan Topik

Tanggal: 21 November 2026
Tujuan: menuntaskan laporan "chip rubrik tidak sesuai konteks" pada
`berita.html?artikel=n-bmkg-kediri-banjir&rubrik=daerah`, **dan semua masalah sejenis**
di seluruh situs (daftar berita, halaman rubrik, pencarian, kiriman warga, service worker).

## 1. Akar masalah yang ditemukan

| # | Gejala yang dilihat pengguna | Akar masalah |
|---|---|---|
| 1 | Chip berisi `Semua; Lingkungan; Ekonomi; Budaya; Teknologi; Pendidikan` — tidak ada "Daerah" walau URL menyebut `?rubrik=daerah` | Blok `syncFromCMS()` **menimpa** `#topicChips` dengan chip berbasis *topik* setiap kali `/api/newsroom/public-list` mengembalikan artikel. Semua perbaikan chip sebelumnya terhapus di produksi (di uji lokal API mati, jadi tidak terlihat) |
| 2 | "Semua" menyala padahal filter rubrik aktif | Render chip tidak melihat `rubrik`/`wilayah` dari URL |
| 3 | Artikel yang dibaca selalu artikel #1 (BMKG) walau filter berganti | Tidak ada penyelarasan `activeId` dengan hasil filter |
| 4 | URL menulis sendiri `?artikel=…` dan membuang `rubrik`/`wilayah`/`utm_*` | `sinkronUrl()` menulis ulang URL tanpa mempertahankan parameter lain |
| 5 | `?rubrik=daerah` menampilkan artikel ekonomi/lingkungan/budaya/pendidikan | Rubrik dipetakan ke topik, bukan aturan rubrik |
| 6 | Halaman `rubrik.html` angka jumlah berita tidak ada; Bojonegoro/Surabaya/Malang tidak pernah cocok | Daftar statis + artikel tidak punya field `wilayah` |
| 7 | Daftar berita CMS bisa basi berhari-hari | Service worker men-cache `/api/newsroom/public-list` dengan strategi **cache-first** |
| 8 | Slug rubrik asing (mis. `?rubrik=olahraga`) diam-diam menampilkan semua berita | `articlesByRubrik()` mengembalikan semua artikel saat rubrik tak dikenal |
| 9 | Artikel CMS tidak pernah masuk filter wilayah | API tidak mengirim `wilayah`, tabel `articles` juga belum punya kolomnya |
| 10 | `?topik=` (tautan lama) dan `utm_*` hilang saat URL disinkronkan | Parameter tidak dipetakan/dipertahankan |

## 2. Perubahan

- `website/assets/js/ai-news.js`
  - `RUBRIK` (8 rubrik) dengan predikat `cocok` yang tahan data CMS tanpa `wilayah`/`topic`.
  - `WILAYAH` + `daftarWilayah()`, `normalisasiWilayah()`, `tebakWilayah()`.
  - `ALIAS_RUBRIK` (politik/hukum/sosial/opini → nasional), `ALIAS_WILAYAH` (jawa-timur → jatim).
  - `articlesByRubrik()` untuk slug tak dikenal mengembalikan **kosong**, bukan semua.
- `website/berita.html`
  - Satu set chip = rubrik + jumlah berita; chip aktif mengikuti URL; "Semua" hanya aktif bila tak ada filter.
  - Pil "Rubrik: … ✕" / "Wilayah: … ✕" untuk menghapus filter.
  - `sinkronUrl()` mempertahankan `utm_*` dan memetakan `?topik=` → `?rubrik=`.
  - Artikel yang dibaca diselaraskan dengan hasil filter.
  - Pesan kosong yang jujur: rubrik belum dikenal / rubrik belum ada liputan / wilayah belum ada liputan / kata kunci tidak cocok.
  - `syncFromCMS()` **tidak lagi menimpa chip**; ia menambahkan `topic`, `wilayah`, lalu memanggil `renderChips()`.
- `website/rubrik.html`: daftar rubrik & wilayah dirender dari definisi yang sama + jumlah nyata + sorot filter aktif + ikut menyegarkan diri saat CMS masuk.
- `website/sw.js`: `/api/*` selalu ke jaringan (tidak di-cache), cache dinaikkan ke `mbc-tv-v5`.
- `website/assets/js/aksi-publik.js`: konfirmasi kiriman menyebut rubrik/wilayah tujuan.
- `server/newsroom-api.js`: `/api/newsroom/public-list` mengirim `wilayah` bila kolomnya tersedia (`to_jsonb(a)->>'wilayah'`, aman walau kolom belum ada).
- `ops/uji-filter-berita.py`: uji otomatis 16 skenario + 8 interaksi.

## 3. Hasil uji lokal (21/11/2026, `http://127.0.0.1:8101`, CMS tiruan 4 artikel + SW aktif)

- 16 skenario URL: **lulus**, tanpa galat JS. Chip aktif selalu cocok dengan isi daftar.
- Interaksi: klik chip (aktif/toggle), klik kartu, tombol ✕, pencarian (`kopi` 1 hasil, `zzzz` 0 hasil), klik berita terkait — **lulus**.
- Halaman: `berita.html`, `rubrik.html`, `index.html`, `kontributor.html`, `live.html`, `watch.html` — **tanpa galat JS**.
- Konfirmasi kiriman warga: "✅ … Berita Anda akan tampil di rubrik BUDAYA / wilayah KEDIRI setelah disetujui."

## 4. Catatan untuk tim IT

1. Kalau ingin wilayah CMS benar-benar tersimpan (bukan ditebak), jalankan migrasi kolom:
   `ALTER TABLE articles ADD COLUMN IF NOT EXISTS wilayah TEXT;`
   API sudah siap mengirim kolom itu tanpa perubahan kode.
2. Service worker versi baru (`mbc-tv-v5`) menghapus cache lama saat aktif; tidak perlu tindakan manual di perangkat pengguna.
3. `ops/uji-filter-berita.py` bisa diarahkan ke produksi: `python3 ops/uji-filter-berita.py https://mbcindonesia-tv.vercel.app`
   (sebaiknya tanpa CMS tiruan; artikel CMS asli yang akan dipakai).
