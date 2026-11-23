# Unggah perbaikan video ke produksi — 3 jalur

Status: **perbaikan selesai & teruji lokal**, commit siap di `/tmp/pushrepo` (HEAD `191bc80`).
Produksi masih memutar klip lama sampai salah satu jalur di bawah dijalankan.

## Jalur 1 — ZIP + GitHub Desktop (paling mudah, tanpa token)

1. Unduh `mbc-siap-push/mbcindonesia-tv-video-per-episode.zip` dari viewer.
2. Ekstrak, lalu **timpa** seluruh isi folder repo lokal `MBCINDONESIA.TV`.
3. Buka GitHub Desktop → pastikan repo `Yudi8377/MBCINDONESIA.TV`, branch `main`.
4. Isi ringkasan commit, mis. `fix(video): 26 klip unik per episode`, klik **Commit to main**.
5. Klik **Push origin**. Vercel otomatis build ±1 menit.

Alternatif tanpa desktop: github.com → repo → **Add file ▸ Upload files** → seret folder `website`, `server`, `ops`, dan berkas `md` hasil ekstrak → **Commit changes**.

## Jalur 2 — OAuth Device Flow (saya yang push)

1. Minta kode ke saya (berlaku 14 menit).
2. Buka https://github.com/login/device, login sebagai **Yudi8377**.
3. Masukkan kode → Continue → Authorize.
4. Saya push, pantau build, lalu verifikasi halaman produksi.

Catatan: kode dari akun GitHub lain tidak akan berlaku untuk repo ini.

## Jalur 3 — Personal Access Token (sekali pakai)

1. GitHub → Settings ▸ Developer settings ▸ Tokens (classic) ▸ Generate new token, scope **repo**.
2. Kirim token ke saya, saya push lalu hapus token.
3. Cabut token setelah selesai.

## Setelah terunggah — verifikasi

Buka `https://mbcindonesia-tv.vercel.app/watch.html?id=ruang-bisnis`; klip pertama harus
berlabel **RUANG BISNIS · Ep 24 - UMKM Kediri Go Global**, dan label di bawah pemutar menulis
"Sedang diputar: Ruang Bisnis · Ep 24 …". Saya juga akan menguji ulang 5 episode dengan Chromium.
