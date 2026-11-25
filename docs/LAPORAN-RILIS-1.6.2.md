# MBCINDONESIA.TV — Rilis 1.6.2: Kerangka Modul Seragam (19 Menu)

Tanggal: 21 November 2026 · Versi aplikasi: **1.6.2** · Proyek Vercel: `mbcindonesia-tv`
Commit acuan 1.6.1: `2f9496c` (laporan rilis sebelumnya)

---

## 1. Ringkasan satu paragraf

Setiap menu di sidebar `/newsroom` sekarang punya modul dokumen yang sama lengkapnya: daftar
tersimpan di PostgreSQL, tombol **Baru / Ubah / ubah status / Riwayat / Arsipkan**, pencarian,
filter status berangka, paging, **cetak dokumen resmi** (kop, nomor, tanggal, tanda tangan,
dasar hukum), **cetak daftar berbentuk tabel**, dan **ekspor CSV**. Form-nya bukan tampilan
statis: 19 modul, 197 field, tiap field menyebut dasar hukumnya (UU Penyiaran, P3SPS, UU Pers,
UU PDP, UU KUP, UU PPN/PPh, PMK, PER-04/PJ/2020, SAK, UU K3, NIB/OSS).

---

## 2. Apa yang berubah

| Bagian | Berkas | Isi |
|---|---|---|
| Skema form | `server/skema-modul.js` | 19 modul, 197 field, `acuan` hukum per field, prefiks nomor |
| API dokumen | `server/newsroom-modul.js` | 9 rute generik (CRUD + status + riwayat + cetak) |
| Komponen UI | `server/newsroom/cms-modul.js` | panel modul, modal form, cetak, CSV |
| Pemasangan di menu | `server/newsroom/index.html`, `server/newsroom/cms.js` | `modulTanam(root, id)` di 19 view |
| Migrasi | `docs/MIGRASI-1.6.2.sql` | 4 tabel + fungsi penomoran + GRANT + RLS |
| Penyajian | `server/server.js`, `api/index.js` | `cms-modul.js` di balik gerbang & di-inline |
| Uji | `ops/uji-modul-db.js`, `ops/uji-modul-ui.js` | 22/22 dan 18/18 |

### Daftar 19 modul dan prefiks nomornya

| Kunci | Menu | Prefiks | Field |
|---|---|---|---|
| `keuangan` | Keuangan & Pajak | KEU | 20 |
| `crm` | CRM & Pipeline | CRM | 18 |
| `ads` | Ads & Kampanye | IKL | 19 |
| `produksi` | Produksi | PRD | 15 |
| `articles` | Artikel / CMS | ART | 10 |
| `antrean` | Kiriman & Laporan | KRJ | 10 |
| `calendar` | Kalender Editorial | KAL | 9 |
| `desk` | Meja Redaksi | DSK | 9 |
| `media` | Media Library | MDA | 11 |
| `moderation` | Moderasi Komentar | MOD | 9 |
| `content-analytics` | Analitik Konten | ANL | 8 |
| `findings` | Temuan AI | TMA | 6 |
| `dashboard` | Dasbor Direksi | DSB | 7 |
| `laporan` | Laporan & BI | LAP | 8 |
| `audit` | Audit Trail | AUD | 8 |
| `master` | Master Data | MST | 10 |
| `ai-studio` | Studio AI | AIS | 5 |
| `pengguna` | Pengguna & Peran | PGR | 7 |
| `pengaturan` | Pengaturan | PGS | 8 |

---

## 3. Yang harus dijalankan sekali (tidak bisa dilakukan agen)

Peran aplikasi di Supabase bernama **`mbc_app`** dan **tidak punya hak `CREATE`** di schema
`public` (sudah diperiksa ulang: `current_user=mbc_app`, `boleh_create=false`). Karena itu
pembuatan tabel harus dari pemilik project:

1. Buka **Supabase → SQL Editor**.
2. Tempel seluruh isi `docs/MIGRASI-1.6.2.sql`.
3. **Run**. Skrip idempoten (aman dijalankan ulang) dan sudah menyertakan `GRANT` + RLS
   `mbc_app_all` seperti tabel `invoices`/`master_items`.
4. Balik ke `/newsroom` → modul apa pun → tombol **↻ Muat ulang**. Panel langsung aktif.

Selama migrasi belum jalan, API menjawab **501** dengan petunjuk tersebut dan panel
menampilkannya; tidak ada penyimpanan diam-diam ke `localStorage`.

---

## 4. Bukti uji (dijalankan di workspace ini)

Keduanya memakai **PostgreSQL asli** (PGlite/WASM) dengan migrasi apa adanya — termasuk fungsi
`plpgsql modul_nomor_berikut()` — bukan tiruan.

```
node ops/uji-modul-db.js   →  ═══ HASIL: 22/22 lulus ═══
node ops/uji-modul-ui.js   →  ═══ HASIL UI: 18/18 lulus ═══
```

Yang dibuktikan uji API/DB:

- `KEU/0001/2026` lalu `KEU/0002/2026` (penomoran atomik berurut per modul per tahun)
- field wajib kosong ditolak; NPWP `12345` ditolak; PPN dihitung ulang saat DPP diubah
- lompatan status `draf → final` ditolak; `finance` tidak boleh menyetujui; `pemred` boleh
- dokumen `final` terkunci; riwayat `buat, ubah, status, status, status` tercatat
- data cetak memuat nomor, 20 baris field, dan **9 acuan hukum**
- filter status, pencarian teks, "hapus" = arsip (baris tetap ada di tabel)
- RBAC: `finance` ditolak di modul `crm`, `sales` ditolak di `keuangan`
- **19/19 modul berhasil menyimpan dokumen** memakai field wajibnya masing-masing
- `audit_log` bertambah setiap aksi

Yang dibuktikan uji UI (jsdom, DOM sungguhan):

- panel ditanam di atas konten lama; toolbar & catatan prefiks muncul
- form dirender dari skema: 20 input, 9 baris "⚖ dasar hukum"
- simpan dari modal → `KEU/0001/2026` muncul di tabel, modal tertutup, toast tampil
- detail dokumen, ubah status, riwayat, cetak dokumen (print dipanggil), cetak daftar, ekspor CSV
- form ubah terisi nilai lama dan perubahan benar-benar tersimpan
- arsipkan berfungsi; **19/19 menu termuat penuh sebagai admin**
- sebagai `finance`: 5 modul terbuka, 14 ditolak dengan pesan jelas (bukan diam-diam kosong)

---

## 5. Cara menerbitkan ke produksi

Token GitHub tidak tersedia di sesi ini (agen tidak menyimpan/menulis token; sesuai aturan
token pernah dikirim di percakapan dan **harus di-rotate**). Langkah dari sisi pemilik repo:

```bash
export GH_TOKEN=<PAT baru, scope Contents: Read+Write>
python3 ops/push-isi.py          # dry-run: lihat 9 berkas yang akan berubah
python3 ops/push-isi.py --kirim  # commit ke main → Vercel membangun produksi
```

Berkas yang diterbitkan: `api/index.js`, `server/server.js`, `server/newsroom-api.js`,
`server/skema-modul.js`, `server/newsroom-modul.js`, `server/newsroom/cms-modul.js`,
`server/newsroom/cms.js`, `server/newsroom/index.html`, `docs/MIGRASI-1.6.2.sql`,
`server/peran.js`.

Setelah itu:

1. Tunggu deploy produksi **READY** (± 60–100 detik).
2. Jalankan migrasi (bagian 3).
3. Periksa `/api/health` → `"version":"1.6.2"`.
4. Buka `/newsroom?t=<token>` → tiap menu menampilkan panel modul.

Bila belum sempat naikkan `APP_VERSION` di Vercel, lakukan: **Vercel → Project →
Settings → Environment Variables → `APP_VERSION` = `1.6.2`** lalu redeploy. Dampaknya hanya
label versi; fitur tidak bergantung pada nilai itu.

---

## 6. Catatan keamanan

- `mbc_app` tetap **tanpa** hak `CREATE`/`ALTER`; migrasi sengaja dipisah dari jalur aplikasi.
- Semua dokumen modul memakai `Cache-Control: no-store`.
- Izin diperiksa di server per modul; UI hanya menyembunyikan, bukan menggantikan penegakan.
- "Hapus" adalah **arsip**; tidak ada endpoint yang menghapus permanen. Masa simpan pajak
  10 tahun (UU KUP Pasal 28 ayat (11)), dokumen penyiaran/iklan ≥ 5 tahun (UU Penyiaran Pasal 24).
- Riwayat perubahan disimpan dua lapis: `modul_riwayat` (per dokumen) dan `audit_log` (global).

---

## 7. Yang belum dikerjakan (jujur)

- **Lampiran berkas** (`modul_lampiran`) sudah ada tabelnya, tetapi UI unggah/baca lampiran
  belum dibuat. Rencana: unggah data-URI maks 2 MB per lampiran di iterasi berikutnya.
- **Cetak PDF server-side** belum ada; cetak memakai `window.print()` peramban dengan
  stylesheet `@page A4` sehingga sudah rapi, tetapi bukan PDF tersimpan.
- **Verifikasi di produksi** menunggu terbit + migrasi dijalankan (keduanya butuh token/akses
  pemilik). Semua klaim di atas dibuktikan di PostgreSQL lokal, bukan di produksi.

---

## 8. Verifikasi produksi (25 Nov 2026, setelah terbit)

Dijalankan langsung terhadap https://mbcindonesia-tv.vercel.app

| Pemeriksaan | Hasil |
|---|---|
| `/api/health` | `db=true`, **`version=1.6.2`**, latensi 224 ms |
| `GET /api/newsroom/modul` (token admin) | **200**, 19 modul, `tabel_siap=true` |
| Modul keuangan/crm/ads/produksi/master/laporan/audit/pengaturan/desk/articles | **200 semua** |
| `GET /api/newsroom/modul` tanpa token | **401** (gerbang tetap) |
| Tabel Supabase | `modul_rekam`, `modul_nomor`, `modul_riwayat`, `modul_lampiran` |
| Hak `mbc_app` | INSERT/UPDATE = true (GRANT + RLS berhasil) |
| HTML `/newsroom` (200 KB) | komponen `modulTanam`, badge `verPill`, CSS `.md-panel`, `@page A4` — semua ada |
| `ops/uji-produksi-modul.js` | **14/14 lulus** |
| Uji UI → API produksi (jsdom) | 10/12; 2 kegagalan artefak harness, dibuktikan manual: arsip `{"status":"arsip"}` dan baris DB `arsip` |

Rantai penuh terbukti di produksi: buat `KEU/0001/2026` → PPN dihitung → cari → baca →
ubah (PPN 1,1 jt → 2,2 jt) → lompat status ditolak 409 → diperiksa → disetujui →
riwayat `buat,ubah,status,status` → data cetak 20 field + 9 acuan hukum → arsip.

Catatan data: seluruh dokumen uji sudah dihapus dari `modul_rekam`/`modul_riwayat` dan
penomoran direset, sehingga dokumen asli pertama pemilik akan mulai dari `KEU/0001/2026`.

Catatan konfigurasi: `APP_VERSION` di Vercel dinaikkan ke `1.6.2` lalu dideploy ulang
(deploy `dpl_6DpiGEcWkQQKC1uBFTaskDqxofKV`), karena `/api/health` membaca env itu —
bukan `package.json`.
