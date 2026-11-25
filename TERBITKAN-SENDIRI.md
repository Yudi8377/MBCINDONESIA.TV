# Terbitkan 1.6.2 sendiri (3 cara, pilih satu)

Isi folder ini = 15 berkas yang harus masuk ke repo `Yudi8377/MBCINDONESIA.TV` (branch `main`).
Semua sudah lulus uji: `node ops/uji-modul-db.js` 22/22, `node ops/uji-modul-ui.js` 18/18.

## Cara A — unggah lewat GitHub web (tanpa token, ±3 menit)

1. Buka https://github.com/Yudi8377/MBCINDONESIA.TV
2. Untuk setiap berkas di bawah: buka jalur yang sama di GitHub → tombol pensil (Edit)
   → hapus semua isinya → tempel isi berkas dari paket ini → **Commit changes** ke `main`.
   (Untuk berkas baru: **Add file → Upload files**, seret berkasnya.)
3. Vercel otomatis membangun produksi setiap commit ke `main`.

| # | Berkas | Baru? |
|---|---|---|
| 1 | `server/skema-modul.js` | **baru** |
| 2 | `server/newsroom-modul.js` | **baru** |
| 3 | `server/newsroom/cms-modul.js` | **baru** |
| 4 | `docs/MIGRASI-1.6.2.sql` | **baru** |
| 5 | `docs/LAPORAN-RILIS-1.6.2.md` | **baru** |
| 6 | `server/newsroom/index.html` | diubah (tambah 1 baris script + 9 pemanggilan) |
| 7 | `server/newsroom/cms.js` | diubah (10 pemanggilan `modulTanam`) |
| 8 | `server/server.js` | diubah (daftar rute + sajikan `cms-modul.js`) |
| 9 | `server/newsroom-api.js` | diubah (gerbang `/modul` per-modul) |
| 10 | `api/index.js` | diubah (inline dua berkas JS) |
| 11 | `CHANGELOG.md`, `package.json` | diubah (entri + versi 1.6.2) |
| 12 | `ops/push-isi.py`, `ops/uji-modul-*.js` | opsional (alat bantu) |

## Cara B — git di komputer Anda

```bash
git clone https://github.com/Yudi8377/MBCINDONESIA.TV.git
cd MBCINDONESIA.TV
# timpa dengan isi folder ini (pertahankan struktur jalurnya)
cp -r <folder-paket>/* .
git add -A && git commit -m "feat(1.6.2): kerangka modul seragam 19 menu" && git push origin main
```

## Cara C — PAT + skrip yang sudah ada

```bash
export GH_TOKEN=<PAT baru, scope Contents: Read+Write>
python3 ops/push-isi.py          # dry-run
python3 ops/push-isi.py --kirim  # commit otomatis 10 berkas penting
```

## Setelah terbit (wajib, sekali)

1. **Migrasi database** — Supabase → SQL Editor → tempel `docs/MIGRASI-1.6.2.sql` → Run.
   Tanpa ini panel modul menampilkan petunjuk migrasi (HTTP 501), karena peran `mbc_app`
   memang tidak berhak membuat tabel.
2. **Label versi** — Vercel → Project `mbcindonesia-tv` → Settings → Environment Variables →
   `APP_VERSION` = `1.6.2` → Redeploy. (Hanya label; fitur tidak bergantung pada ini.)
3. **Uji terlihat** — buka `/newsroom?t=<token>` → menu **Keuangan & Pajak** → panel
   "🗂 Modul keuangan" muncul paling atas dengan tombol ＋ Baru / Cetak daftar / Ekspor CSV.

## Cara memastikan versi mana yang sedang tampil

- `/api/health` → `"version"` masih `1.6.1` berarti deploy baru belum ada.
- Halaman `/newsroom` diblokir untuk anonim (401) — hanya bisa dilihat dengan token.
- URL `mbcindonesia-i6poqw2e9-hobby-ed84.vercel.app` adalah **deployment tetap** untuk
  commit `2f9496c`; alamat produksi yang ikut berubah adalah `mbcindonesia-tv.vercel.app`.
