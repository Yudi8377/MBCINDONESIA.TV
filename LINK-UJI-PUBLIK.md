# 🌐 Link Uji Publik MBCINDONESIA.TV

**Link untuk dibagikan ke penguji / calon klien:**

## 🔗 https://flickr-more-wines-voltage.trycloudflare.com

Berlaku selama proses di sandbox hidup. Tunnel gratis bisa diputus kapan saja — lihat `LAPORAN-GANGGUAN-TUNNEL.md`.

### Riwayat perbaikan (jujur, supaya tidak terulang)
| Percobaan | Hasil | Penyebab |
|---|---|---|
| Cloudflare quick tunnel #1 (QUIC) | mati total, DNS NXDOMAIN | Cloudflare mencabut tunnel di sisi server (`Unauthorized: Tunnel not found`) setelah koneksi QUIC idle putus |
| localhost.run (`*.lhr.life`) | sempat 200, lalu **502** | domain berotasi & sesi SSH idle diputus |
| Pinggy | 200 tapi menyisipkan **halaman peringatan** | free tier menampilkan *interstitial* sebelum situs |
| Serveo | sama, menyisipkan peringatan | free tier |
| **Cloudflare #2 dengan `--protocol http2`** | ✅ **stabil** | TCP/HTTP2 tidak putus saat idle; ditambah penjaga keep-alive |

**Verifikasi link ini:** DNS publik resolve (Cloudflare 104.16.230–231.132), **16 endpoint 200**,
`/newsroom/` 401 tanpa cookie → 200 dengan cookie, login 4 peran berhasil, dan judul halaman
dikonfirmasi dari **server luar** (Microlink) = "MBC INDONESIA — Televisi Digital Indonesia".

> ⚠️ Ini link **demo**. Database berisi konten dummy realistis, akun masih memakai
> sandi demo, dan data uji boleh diubah. Jangan dipakai untuk data rahasia.

---

## Halaman yang bisa dicoba

### Untuk umum (tanpa login)
| Halaman | Link |
|---|---|
| Beranda (hero, breaking news, program) | [/](https://flickr-more-wines-voltage.trycloudflare.com/) |
| Berita + pencarian & filter | [/berita.html](https://flickr-more-wines-voltage.trycloudflare.com/berita.html) |
| Tonton (8 program, 26 episode) | [/watch.html](https://flickr-more-wines-voltage.trycloudflare.com/watch.html) |
| Live TV | [/live.html](https://flickr-more-wines-voltage.trycloudflare.com/live.html) |
| Kebijakan Privasi | [/privasi.html](https://flickr-more-wines-voltage.trycloudflare.com/privasi.html) |
| Syarat & Ketentuan | [/syarat.html](https://flickr-more-wines-voltage.trycloudflare.com/syarat.html) |

### Web App internal (CMS) — perlu login
| | |
|---|---|
| Gerbang masuk | [/newsroom/gerbang.html](https://flickr-more-wines-voltage.trycloudflare.com/newsroom/gerbang.html) |
| Workspace (setelah login) | `/newsroom/` |

**Akun uji** (sandi semua: `demo123`):

| Email | Peran | Menu |
|---|---|---|
| `direktur@mbcindonesia.tv` | Direksi / Pemimpin Redaksi | 17 |
| `redaksi@mbcindonesia.tv` | Editorial (redaktur & penulis) | 12 |
| `finance@mbcindonesia.tv` | Keuangan | 7 |
| `sales@mbcindonesia.tv` | Penjualan / iklan | 6 |

> Minta penguji mencoba **akun berbeda** untuk melihat menu yang menyusut sesuai peran
> (bukti RBAC bekerja, bukan sekadar tampilan).

### Endpoint teknis (untuk penguji teknis)
| Endpoint | Kegunaan |
|---|---|
| `/api/health` | status DB: `provider:"supabase"`, `tls`, `pooler`, latensi |
| `/api/status` | uptime, metrik 5xx, jumlah artikel/pengguna |
| `/api/newsroom/public-list` | artikel tayang (JSON) |
| `/sitemap.xml`, `/robots.txt` | SEO |
| `/manifest.webmanifest` | PWA — coba "Add to Home screen" di Android/iOS |

---

## Skrip uji 10 menit untuk penguji

1. **Responsif** — buka beranda di HP. Coba putar ke *landscape*, cek tidak ada scroll
   horizontal. Ukuran yang diuji otomatis: 360 px, 390 px, 768 px, 1024 px, iPhone notch.
2. **Berita** — buka `/berita.html`, cari kata `Kediri`, filter per kanal.
3. **Tonton** — buka `/watch.html`, pilih program *Jejak Nusantara*, cek daftar episode.
4. **Live** — `/live.html` menampilkan pemutar + jadwal.
5. **Komentar** — kirim komentar di halaman tonton (masuk ke moderasi).
6. **Login & RBAC** — masuk sebagai `sales@`, catat menunya; keluar; masuk `direktur@`,
   bandingkan. Harus berbeda.
7. **Alur editorial** — sebagai `redaksi@`: buat artikel → kirim ke meja redaksi →
   sebagai `direktur@`: setujui → status berubah ke **tayang**.
8. **Agen AI** — jalankan salah satu agen dari menu AI; lihat catatan keluaran.
9. **PWA** — di Chrome Android, menu ⋮ → *Add to Home screen*.
10. **API** — buka `/api/status`, pastikan `"provider":"supabase"` dan `"ok":true`.

---

## Kolom umpan balik yang saya sarankan

| Aspek | Pertanyaan |
|---|---|
| Tampilan | Apakah rapi di HP Anda? Merek & versi (mis. Samsung A54 / Android 14, iPhone 12 / iOS 17)? |
| Kecepatan | Halaman mana yang terasa lambat? (catat perkiraan detik) |
| Navigasi | Ada menu/label yang membingungkan? |
| Isi | Apakah berita & program terasa wajar untuk media Indonesia? |
| RBAC | Apakah menu sesuai jabatan? Ada yang seharusnya ada/tidak ada? |
| Kepercayaan | Apakah tampilannya cukup meyakinkan untuk ditayangkan? |

---

## Batasan yang wajib diketahui penguji (jujur)

- **Konten & angka dummy.** Analitik, CRM, invoice, dan laporan bersifat ilustratif.
- **Agen AI deterministik** — bukan model bahasa sungguhan; keluarannya berpola, bukan hasil LLM.
- **Belum ada pembayaran** (Midtrans/Xendit), langganan, atau iklan yang benar-benar tayang.
- **Belum ada email transaksional** (reset sandi, notifikasi) — semuanya masih manual.
- **APK Android belum dibangun**; aplikasi Android tersedia sebagai **PWA** (bisa dipasang
  dari browser) + proyek Kotlin yang siap dikompilasi di Android Studio.
- **Link ini sementara.** Tunnel tanpa akun tidak bergaransi uptime dan akan mati bila
  sandbox berhenti atau sesi direset. Untuk permanen: `mbcindonesia.tv` (lihat `GO-LIVE.md`).

---

## Cara memperbarui link (tanpa akun)

```bash
# 1) tunnel (WAJIB --protocol http2 agar tidak putus saat idle)
/home/user/tools/cloudflared tunnel --url http://127.0.0.1:8080 --protocol http2 --no-autoupdate

# 2) penjaga keep-alive supaya URL tetap hidup (jalankan di terminal lain)
URL=https://<nama-baru>.trycloudflare.com INTERVAL=45 ./ops/jaga-tunnel.sh
```

Catat URL baru dari log, lalu bagikan lagi. Untuk link **permanen**, diperlukan domain sendiri
(`mbcindonesia.tv`) — lihat `GO-LIVE.md` §3.

## ✅ Verifikasi terakhir (23 November 2026, 05:25 UTC)

| Uji | Alat | Hasil |
|---|---|---|
| DNS publik | Cloudflare DoH (`cloudflare-dns.com/dns-query`) | `status 0`, A `104.16.230.132`, `104.16.231.132` |
| Judul halaman dari server luar | `r.jina.ai` | **"MBC INDONESIA — Televisi Digital Indonesia"** |
| Halaman | `curl` | `/` 200 · `/berita.html` 200 · `/watch.html` 200 · `/live.html` 200 · `/newsroom/gerbang.html` 200 |
| API | `curl` | `/api/health` 200 `{"ok":true,"db":true,"provider":"lokal","version":"1.4.6"}` · `/api/status` 200 |
| Login RBAC | `POST /api/newsroom/gate` | `redaksi@mbcindonesia.tv` → token JWT terbit ✅ |

> Catatan jujur: Microlink sekarang menolak karena **kuota harian habis** ("Your daily rate limit has
> been reached"), bukan karena situsnya mati — verifikasi luar dilakukan ulang memakai `r.jina.ai`.
> Tunnel `trycloudflare.com` ini **sementara**; URL permanen menunggu Vercel (lihat
> `PANDUAN-DEPLOY-VERCEL.md`).

## 🔁 Gangguan 23 Nov 2026 — HTTP 530

Tunnel lama (`comparing-thesaurus-mails-manga`) **diputus Cloudflare**: seluruh halaman dijawab
**HTTP 530** (`Cloudflare Tunnel error`). Terbukti dengan Chromium: 3 dari 4 halaman yang diuji
menerima 530 **dari host kita sendiri** — bukan aset gambar/video yang rusak. `ERR_CONNECTION_CLOSED`
adalah percobaan reconnect browser. Rincian lengkap: `LAPORAN-GANGGUAN-TUNNEL.md`.

Tunnel baru dipakai sekarang: **https://flickr-more-wines-voltage.trycloudflare.com**

Pengukuran sesudah ganti: **22/22 permintaan 200** (7 menit), uji Chromium 4 halaman →
**0 permintaan gagal**, 3 pemutar video `readyState 4` (waktu berjalan).

## ♻️ Sejak v1.4.12: tunnel menyembuhkan diri

`ops/tunnel-otomatis.sh` memeriksa `/api/healthz` tiap 20 detik. Bila gagal 3x berturut-turut
(530 = edge Cloudflare memutus tunnel), skrip membunuh tunnel lama, membuat yang baru, dan menulis
URL terbaru ke `ops/url-terkini.txt`. Kalau muncul 530 lagi, ambil URL dari file itu.
