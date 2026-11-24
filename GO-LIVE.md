# 🟢 GO LIVE — MBCINDONESIA.TV di Vercel

**URL produksi permanen:** https://mbcindonesia-tv.vercel.app
**Repo:** https://github.com/Yudi8377/MBCINDONESIA.TV (branch `main`)
**Proyek Vercel:** `mbcindonesia-tv` (`prj_uFBaXNU8q0FH2vqLALEjKxsjL5aN`, team `hobby-ed84`)

Status per 23 November 2026 08:25 UTC — semua di bawah ini hasil perintah yang benar-benar dijalankan.

## Hasil verifikasi

| Uji | Perintah | Hasil |
|---|---|---|
| DNS | `getent hosts mbcindonesia-tv.vercel.app` | `64.29.17.3`, `216.198.79.3` |
| TLS | `curl` | `ssl_verify=0`, HTTP 200 |
| Halaman publik | `curl` | `/`, `/live.html`, `/watch.html?id=…`, `/berita.html`, `/privasi.html`, `/syarat.html` → **200** |
| Aset | `curl` | `site.css`, `data.js`, `hero.jpg`, `live-24jam.mp4`, `manifest.webmanifest`, `sw.js`, `sitemap.xml` → **200** |
| API | `curl` | `/api/healthz` 200, `/api/health` 200 (`provider: supabase`), `/api/status` 200, `/api/programs` 200 |
| CMS tertutup | `curl /newsroom` | **401** (halaman gerbang 7 KB, bukan CMS 81 KB) |
| CMS terbuka dgn token | `curl -H "Authorization: Bearer …"` | **200**, 139 KB, `cms.js` inline |
| Login 4 peran | `POST /api/newsroom/gate` | `direktur→direksi`, `redaksi→editorial`, `finance→finance`, `sales→sales` |
| Judul dari luar | `r.jina.ai` | *MBC INDONESIA — Televisi Digital Indonesia* |
| Latensi edge | `curl -w %{time_total}` | `/api/healthz` ±0,13 s |

## Perubahan penting saat go-live (v1.4.14)

1. **Celah keamanan ditutup.** Sebelumnya `website/newsroom/index.html` dilayani CDN Vercel → **CMS 81 KB
   bisa diunduh tanpa login**. Sekarang `index.html` + `cms.js` dipindah ke `server/newsroom/`
   (hanya ada di bundel function) dan disajikan **setelah** token sah diverifikasi.
2. **`vercel.json`:** `framework: null`, tanpa `buildCommand`, `installCommand` eksplisit,
   rewrite `/newsroom*` + `/api/*` → `api/index.js`, header keamanan & cache.
3. **`api/index.js`:** gerbang newsroom sendiri (verifikasi JWT + peran) dan **inline `cms.js`** ke HTML.
4. **`package.json`:** `version 1.4.13`, `engines.node 22.x`, devDependency `vercel` dibuang.
5. CMS kini juga diuji di server lokal: dengan token 200, tanpa token 401 (paritas Vercel).

## Yang WAJIB dilakukan sebelum dibagikan luas

1. **Ganti sandi demo `demo123`** — jalankan dari mesin yang punya `SUPABASE_DB_URL`:
   `node ops/audit-akun.js --ganti` lalu bagikan sandi baru ke staf.
2. **Pasang uptime monitor** ke `https://mbcindonesia-tv.vercel.app/api/healthz` (selalu 200, tanpa DB).
3. **Domain sendiri (opsional):** Vercel → Settings → Domains → tambah `mbcindonesia.tv`.

## Alur kerja setelah ini

```bash
git clone https://github.com/Yudi8377/MBCINDONESIA.TV.git
cd MBCINDONESIA.TV
# ubah sesuatu
git commit -am "perubahan"
git push            # Vercel otomatis build & deploy ke produksi (±1 menit)
```

Rollback: Vercel → Deployments → pilih deployment lama → **Promote to Production**.

## Batasan yang tetap jujur

- Video masih **klip demo** (foto + gerak halus), bukan siaran TV sungguhan.
- Agen AI masih **deterministik** (tanpa LLM ber-API).
- Angka analitik & penonton bersifat ilustratif.
- APK/AAB Android tidak bisa dibangun di lingkungan ini; proyek Kotlin + PWA tetap disertakan.
