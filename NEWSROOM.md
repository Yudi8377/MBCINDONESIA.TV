# 🗞️ MBC INDONESIA NEWSROOM — CMS Editorial, Multi-Agent AI & Pemandu Pengunjung

Dokumen ini menjelaskan **dapur produksi** MBCINDONESIA.TV: ke mana area internal pindah, apa saja
kemampuannya, bagaimana AI dipakai secara bertanggung jawab, dan **rekomendasi arsitektur** apakah
newsroom sebaiknya dipisah menjadi aplikasi tersendiri.

---

## 1. Perubahan penting: area internal tidak lagi di situs publik

| Sebelum | Sekarang |
|---|---|
| Menu **“Workspace”** tampil di navigasi, footer, manifest PWA, dan strip atas beranda | **Semua tautan publik dihapus** |
| `/workspace/` bisa dibuka siapa saja (hanya form login) | `/newsroom/` **menolak akses anonim di level server (HTTP 401)** |
| Tidak ada larangan perayap | `robots.txt` → `Disallow: /newsroom` + header `X-Robots-Tag: noindex` |
| Login langsung ke aplikasi | **Halaman gerbang** khusus redaksi + `POST /api/newsroom/gate` (cookie `HttpOnly`, hanya peran `editorial`/`direksi`) |

Uji cepat:
```bash
curl -o /dev/null -w '%{http_code}\n' https://mbcindonesia.tv/newsroom/   # → 401 (anonim)
curl -s https://mbcindonesia.tv/robots.txt                                # → Disallow: /newsroom
grep -rn 'newsroom' website/*.html                                        # → tidak ada tautan publik
```

Akses: `https://mbcindonesia.tv/newsroom/` → masukkan email redaksi → aplikasi terbuka.
Bila peran pengguna `sales`/`finance`, gerbang menolak (**403**) dan seluruh `/api/newsroom/*`
menjawab **403** — bukan sekadar menyembunyikan menu.

---

## 2. Isi Newsroom (12 modul)

| # | Modul | Kemampuan |
|---|---|---|
| 1 | **Meja Redaksi** | Ringkasan status, tugas hari ini, approval menunggu, catatan terbuka, temuan AI terbaru |
| 2 | **Artikel (CMS)** | Daftar + filter status/kanal, pencarian, buat/ubah, duplikat, hapus-terkendali, indikator kata & waktu baca |
| 3 | **Editor 7 tab** | Isi naskah · SEO & pratinjau hasil Google · Verifikasi fakta & sumber · **Multi-Agent AI** · Catatan & Approval · Riwayat revisi · Performa artikel |
| 4 | **Kalender Editorial** | Tujuh hari, empat slot (pagi/siang/sore/malam), tugas per kanal, artikel terjadwal |
| 5 | **Temuan AI** | Kotak masuk temuan dengan severity (kritis/peringatan/saran/info), tindak lanjut (baca/terapkan/abaikan) |
| 6 | **Studio AI** | Registry 9 agen, jumlah run, temuan terbuka, *sweep* seluruh newsroom, antrean tugas agen |
| 7 | **Moderasi Komentar** | Tayangkan / sembunyikan / tandai spam, dengan alasan & jejak audit |
| 8 | **Media Library** | Aset gambar + tag + kredit, salin path untuk dipakai di artikel |
| 9 | **Analitik Konten** | Tren 14 hari, tayangan per kanal, artikel teratas, tingkat selesai baca, scroll |
| 10 | **CRM & Pipeline** | (sudah ada) pipeline penjualan |
| 11 | **Iklan & Sponsorship**, **Produksi & Studio**, **Keuangan & Pajak**, **Master Data**, **Laporan & BI**, **Audit Trail**, **Pengaturan** | (sudah ada, kini satu atap dengan editorial) |
| 12 | **Keamanan Akun** | Ganti kata sandi & profil mandiri (gerbang go-live #10) |

### Alur kerja editorial (ditegakkan server, bukan sekadar tampilan)

```
Ide → Draf → Review Redaktur → Verifikasi Fakta → Tinjauan Hukum → Siap Terbit → (Terjadwal) → Tayang → Arsip
                                    ↑__________________ revisi __________________|
```

* Transisi **tidak sah ditolak** (`draft → tayang` = HTTP 409).
* **Syarat tayang diperiksa server**: minimal 1 sumber tercatat, tidak ada klaim berstatus “menunggu”,
  naskah ≥ 120 kata. Bila gagal, server mengembalikan daftar penghalang — bukan pesan samar.
* Artikel **tayang tidak bisa dihapus** (409) — harus *ditarik* atau *arsip* agar jejak editorial terjaga.
* Setiap perubahan menyimpan **revisi bernomor** (siapa, kapan, catatan perubahan).
* Setiap keputusan & mutasi masuk **audit_log append-only**.

---

## 3. Multi-Agent AI (9 agen, berjalan di server MBC sendiri)

| Agen | Tugas | Contoh keluaran |
|---|---|---|
| ✳ **Ringkas** | Ringkasan ekstraktif, judul SEO, meta deskripsi, estimasi baca | “Judul 78 karakter — Google memotong ±60. Usulan: …” |
| ◐ **Nada & Sentimen** | Nada pemberitaan, kata bermuatan, keseimbangan narasumber | `NEGATIF −67` · “tidak ada kalimat penyeimbang” |
| ✓ **Verifikator Fakta** | Klaim berangka & atributif, kelengkapan sumber | “3 klaim perlu sumber tertulis · belum ada sumber tercatat” |
| 📚 **Pustakawan Literasi** | Mencocokkan berita dengan pustaka rujukan kurasi | “Kemnaker — Pedoman Upah Minimum (96%)” |
| ⚖ **Editor Etika** | Clickbait, atribusi kabur, data sensitif, superlatif tanpa dasar | “Frasa clickbait: heboh, viral” |
| § **Peninjau Hukum** | Praduga tak bersalah, UU PDP 27/2022, hak jawab | “Praduga tak bersalah belum disebut” |
| ↗ **Social & Distribusi** | Takarir IG, utas X, judul push, saran thumbnail | teks siap tempel |
| ⌕ **SEO & Keterbacaan** | Kepadatan kata kunci, panjang paragraf, internal link | “Kata kunci 5,2% (ideal < 3%)” |
| ◈ **Rencana Peliputan** | Sudut lanjutan, narasumber, pertanyaan wawancara | 4 pertanyaan + 3 pakar |

**Prinsip yang dipakai:**
1. **Lokal & deterministik** — tidak ada naskah yang dikirim ke layanan AI pihak ketiga (aman untuk embargo & narasumber sensitif); hasil bisa diulang dan diaudit.
2. **Agen tidak menerbitkan** — keputusan tetap manusia; status artikel hanya berubah lewat aksi redaksi.
3. **Setiap temuan punya tingkat** dan bisa ditindaklanjuti (baca → terapkan → abaikan), tercatat siapa dan kapan.
4. **Hasil disimpan** di `ai_runs` + `ai_findings`, jadi bisa dipakai saat audit internal.

Jalankan: `POST /api/newsroom/ai/run` (satu agen) · `POST /api/newsroom/ai/pipeline` (9 agen pada satu artikel)
· `POST /api/newsroom/ai/sweep` (semua artikel belum tayang) · antrean: `POST /api/newsroom/ai/jobs` → `/jobs/process`.

> Catatan jujur: agen ini **berbasis aturan + statistik teks**, bukan model bahasa besar. Itu pilihan
> sadar untuk kepatuhan dan biaya. Bila nanti ingin LLM (mis. untuk penulisan ulang), lapisan integrasi
> tinggal ditambahkan di `server/agents.js` tanpa mengubah API atau UI — dengan catatan kebijakan:
> jangan kirim data narasumber sensitif, dan selalu tandai keluaran sebagai usulan.

---

## 4. AI Companion untuk pengunjung — “Nusa”

Muncul sebagai tombol mengambang di semua halaman publik.

| Kemampuan | Contoh pertanyaan |
|---|---|
| **Panduan situs** | “jadwal live”, “cara menonton”, “kontak redaksi” |
| **Analisis berita yang sedang dibuka** | “ringkas berita ini”, “apa dampaknya?”, “siapa pihak terkait?” |
| **Pencarian literasi** | “carikan referensi soal AI”, “aturan upah minimum” |
| **Penjelasan istilah** | “apa itu UMK?”, “apa itu praduga tak bersalah?” |

Ia membaca **konteks halaman** (berita yang sedang dibuka), lalu menjawab dengan ringkasan, nada
pemberitaan, entitas, angka penting, dan **daftar rujukan** (regulasi, data statistik, akademik, episode MBC).
Semua berjalan di perangkat pengunjung — **tidak ada data pribadi yang dikirim**, sejalan dengan UU PDP.

Halaman publik baru: **`/berita.html`** — katalog berita + panel analisis + rujukan literasi + berita terkait,
dan kartu “Berita & Analisis Terbaru” di beranda. Artikel yang **tayang di newsroom otomatis muncul**
di situs publik (lewat `/api/newsroom/public-list`).

---

## 5. Rekomendasi arsitektur: pisah aplikasi atau satu aplikasi?

**Rekomendasi saya: tetap satu basis kode, tetapi pisahkan secara operasional saat tim membesar.**

| Aspek | Satu aplikasi + route `/newsroom` (sekarang) | Aplikasi terpisah (`newsroom.mbcindonesia.tv`) |
|---|---|---|
| Keamanan | Sudah 401 di level server, noindex, cookie HttpOnly | Bisa ditambah SSO, IP allowlist, VPN, WAF khusus |
| Biaya | 1 server, 1 database, 1 pipeline deploy | 2 deployment, 2 konfigurasi, biaya ±2× |
| Kecepatan rilis | Satu deploy untuk semua | Editorial bisa rilis tanpa menyentuh situs publik |
| Risiko | Beban editorial bisa memengaruhi situs publik | Situs publik tetap ringan saat deadline redaksi |
| Kebutuhan tim | Cukup untuk ≤10 pengguna internal | Layak saat ≥15 pengguna, 24/7, dan ada tim IT sendiri |

**Kapan sebaiknya dipisah?** Bila salah satu terpenuhi:
1. Pengguna internal > 15 orang atau akses lintas kantor/cabang;
2. Redaksi butuh uptime 24/7 sementara situs publik punya jadwal rilis sendiri;
3. Muncul kebutuhan SSO korporat (Azure AD/Google Workspace), IP allowlist, atau audit pihak ketiga;
4. Trafik publik sudah besar sehingga proses editorial mengganggu performa.

**Yang sudah disiapkan agar pindah murah:** seluruh API sudah berprefix `/api/newsroom/*` dan dipisah di
`server/newsroom-api.js` (modul mandiri), UI newsroom sudah satu halaman mandiri (`website/newsroom/`),
dan skema DB terpisah (`cms-schema.sql`). Memisahkan = menyalin dua berkas itu ke layanan baru + arahkan
`/newsroom` lama ke redirect — **tanpa menulis ulang fitur.**

---

## 6. Skema database tambahan (`server/cms-schema.sql`)

`channels` · `tags` · `staff` · `articles` · `article_revisions` · `editorial_notes` ·
`editorial_approvals` · `editorial_tasks` · `media_assets` · `content_analytics` ·
`ai_agents` · `ai_runs` · `ai_findings` · `agent_jobs` · `comment_moderation`

Data contoh: `node cms-seed.js` (7 artikel lintas status, 6 tugas, 9 aset, 9 agen, 14 hari analitik).
Semua idempotent — aman dijalankan berulang untuk mengembalikan kondisi demo.

## 7. Pengujian yang menjaga fitur ini

| Uji | Cakupan |
|---|---|
| `npm run smoke` (**45 pemeriksaan**) | RBAC newsroom (401/403), alur status, penolakan tayang tanpa sumber, AI pipeline & sweep, moderasi, metrik |
| `node ops/test-news-engine.js` (**35 pemeriksaan**) | Analisis berita, sentimen, entitas, pencarian literasi, router niat pengunjung |
| `node ops/check-html.js` | 7 halaman publik + tautan mati + sintaks skrip inline |
| `ops/healthcheck.sh` | 22 pemeriksaan pasca-deploy (termasuk `/newsroom` wajib 401) |
