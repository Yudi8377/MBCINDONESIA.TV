# ✅ Jalur A — Push ke GitHub lalu auto-deploy Vercel

Waktu: ±10 menit. Anda hanya perlu menekan beberapa tombol; sisanya sudah disiapkan dan **sudah saya uji**.

Kode siap pakai ada di salah satu dari dua bentuk ini (pilih yang nyaman):

| Bentuk | Lokasi | Cara pakai |
|---|---|---|
| ZIP folder | `mbc-siap-push/mbcindonesia-tv-siap-push.zip` (7,1 MB) | unduh → ekstrak (cara 1) |
| Git bundle | `mbcindonesia-tv.bundle` (19 MB, riwayat lengkap) | `git clone` (cara 2, lebih rapi) |

Keduanya **tidak memuat** `server/.env` (sandi) maupun `node_modules` — sudah diperiksa.

---

## Langkah 1 — Pasang integrasi GitHub di Vercel (sekali saja)

1. Buka **https://vercel.com/account/login-connections**
2. Klik **Connect GitHub** → **Install** / **Configure**
3. Pilih akun **`Yudi8377`**
4. Repository access → pilih **Only select repositories** → centang **`MBCINDONESIA.TV`**
   (atau *All repositories* bila lebih mudah)
5. **Save** / **Install**

> Ini yang tadi menolak kita: `To link a GitHub repository, you need to install the GitHub integration first`.

---

## Langkah 2 — Masukkan kode ke repo (pilih cara 1 atau 2)

### Cara 1 — lewat browser GitHub (tanpa terminal)

1. Buka `https://github.com/Yudi8377/MBCINDONESIA.TV`
2. Klik tautan **“uploading an existing file”**
3. Ekstrak ZIP tadi di komputer Anda, lalu **seret seluruh isi folder `mbcindonesia/`**
   (yang terlihat: `website`, `server`, `api`, `ops`, `android`, `package.json`, `vercel.json`, …)
   ke area unggah. **Jangan** seret folder pembungkusnya dan **jangan** sertakan `node_modules`.
4. Commit message: `feat: MBCINDONESIA.TV — situs + newsroom + API (siap deploy)`
5. **Commit changes** → tunggu hingga semua file selesai terunggah.

### Cara 2 — lewat terminal (disarankan: riwayat git ikut terbawa)

Di folder tempat Anda menyimpan `mbcindonesia-tv.bundle`:

```bash
git clone mbcindonesia-tv.bundle mbcindonesia
cd mbcindonesia
git branch -M main
git remote add origin https://github.com/Yudi8377/MBCINDONESIA.TV.git
git push -u origin main
```

Saat diminta sandi, **jangan** pakai kata sandi akun. Buat **Personal Access Token**:
GitHub → *Settings* → *Developer settings* → *Personal access tokens* → **Fine-grained tokens** →
*Generate new token* → Repository access: **Only select repositories** → `MBCINDONESIA.TV` →
Permissions → **Contents: Read and write** → *Generate*. Tempel token itu sebagai sandi.

> Sudah saya uji: `git clone` dari bundle → `npm ci` → handler serverless menyala
> (`/api/health` → `{"ok":true,"db":true,"provider":"supabase"}`). Jadi isi repo ini benar-benar bisa dibangun.

---

## Langkah 3 — Sambungkan repo ke proyek Vercel yang sudah ada

Proyek **`mbcindonesia-tv`** sudah dibuat dan **env var-nya sudah terpasang**
(`SUPABASE_DB_URL`, `JWT_SECRET`, `APP_VERSION`). Tinggal disambungkan:

1. Buka **https://vercel.com/dashboard** → pilih proyek **`mbcindonesia-tv`**
2. Tab **Settings** → **Git**
3. **Connect Git Repository** → GitHub → pilih **`MBCINDONESIA.TV`**
4. Production branch: **`main`** → **Save**
5. Kembali ke tab **Deployments** → **Deploy** (atau tunggu push berikutnya; setiap `git push` = deploy otomatis)

**Jangan ubah** pengaturan berikut (sudah benar, kalau diubah deploy bisa gagal):

| Setting | Nilai |
|---|---|
| Framework Preset | *kosong / Other* |
| Root Directory | `.` (root repo) |
| Build Command | dari `vercel.json` (`echo ...`, tanpa build) |
| Output Directory | `website` |
| Install Command | `npm install --omit=dev --no-audit --no-fund` |

---

## Langkah 4 — Verifikasi (kirim hasil ini ke saya)

Ganti `<domain>` dengan URL yang diberikan Vercel (`https://mbcindonesia-tv.vercel.app` atau domain preview):

```bash
D=https://<domain>
curl -s $D/api/healthz                                    # {"status":"ok",...}
curl -s $D/api/health                                     # {"ok":true,"db":true,"provider":"supabase"}
curl -o /dev/null -w '%{http_code}\n' $D/                 # 200
curl -o /dev/null -w '%{http_code}\n' $D/live.html        # 200
curl -o /dev/null -w '%{http_code}\n' $D/newsroom/        # 401  ← CMS tetap tertutup
curl -s -X POST $D/api/newsroom/gate -H 'Content-Type: application/json' \
  -d '{"email":"direktur@mbcindonesia.tv","password":"demo123"}'   # {"ok":true,...}
```

Kalau ada yang tidak 200/401 sesuai catatan, kirim:
1. tulisan error di **Deployments → Build Logs**,
2. hasil `curl -s $D/api/health`,
3. nama domain yang dipakai.

Saya lanjut memperbaiki dari situ — tanpa perlu Anda mengulang langkah yang sudah beres.

---

## Yang sudah saya pastikan sebelum Anda mulai

- `npm ci` dari repo bersih: **103 paket, 0 error**
- `api/index.js` dimuat dalam **164 ms**, tipe `function` (tidak memanggil `listen`)
- Uji handler langsung (meniru Vercel): `/api/healthz` 200 · `/api/health` 200 (`provider: supabase`) ·
  `/api/status` 200 · `/api/programs` 200 · `/newsroom/` **401**
- `/newsroom/` di Vercel di-rewrite ke function, jadi CMS **tidak** bisa diunduh tanpa login
- `.env` tidak pernah masuk riwayat git; hanya `*.example` yang ikut

## Setelah live — dua hal kecil untuk produksi

1. **Ganti sandi demo** (`demo123`): jalankan `node ops/audit-akun.js --ganti` dari mesin yang punya
   `SUPABASE_DB_URL`, lalu bagikan sandi baru ke staf.
2. **Uptime monitor**: pantau `https://<domain>/api/healthz` tiap 5 menit (selalu 200, tanpa DB).
