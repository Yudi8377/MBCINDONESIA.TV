# 🔁 Catatan gangguan tunnel — 23 November 2026

Ditulis apa adanya: apa yang gagal, buktinya, dan apa yang sudah diperbaiki.

## 1. Gejala yang dilaporkan

Di konsol browser, pada halaman **Program**, **Live TV**, **Dokumenter**, dan **Podcast**:

```
Failed to load resource: the server responded with a status of 530 ()
...:1  Failed to load resource: net::ERR_CONNECTION_CLOSED
```

## 2. Penyebab (terukur)

**530** adalah kode Cloudflare untuk *origin tidak terjangkau*. Yang tidak terjangkau **bukan**
aplikasi di sandbox, melainkan **tunnel** yang menghubungkannya ke internet.

Bukti 1 — log `cloudflared`:

```
05:43:10  Lost connection with the edge
05:43:10  Retrying connection in up to 2s
05:43:21  Registered tunnel connection   ← pulih 11 detik kemudian
```

Bukti 2 — uji Chromium terhadap 4 halaman (skrip `ops/uji-jaringan.py`), saat tunnel sedang mati:

| Halaman | Judul yang diterima | Permintaan gagal (milik situs) | Gagal pihak ketiga |
|---|---|---|---|
| Program | `Cloudflare Tunnel error \| …` | **1 (HTTP 530)** | 0 |
| Live TV | `Cloudflare Tunnel error \| …` | **1 (HTTP 530)** | 0 |
| Dokumenter | `Cloudflare Tunnel error \| …` | **1 (HTTP 530)** | 0 |
| Podcast | `Bicara Petang — MBC INDONESIA` | 0 | 0 |

Artinya: yang gagal **dokumen HTML halaman kita sendiri**, bukan gambar/video/aset atau resource
pihak ketiga. `ERR_CONNECTION_CLOSED` adalah percobaan reconnect browser ke tunnel yang sama.

Bukti 3 — setelah tunnel dipulihkan/diganti:
- 22 permintaan berurutan selama 7 menit → **22/22 HTTP 200**.
- Uji Chromium 4 halaman → **0 permintaan gagal**; 3 pemutar video `readyState 4`, waktu berjalan.

## 3. Yang sudah diperbaiki di aplikasi (bukan sekadar menunggu tunnel)

| Perubahan | Tujuan |
|---|---|
| `server/db.js` — ulang sekali untuk galat transien (`ECONNRESET`, `57P0x`, `08xxx`, …) | Supabase pooler menutup koneksi idle; dulu satu permintaan ikut gagal (503) |
| `GET /api/healthz` — selalu 200, tanpa DB | Uptime monitor tidak ikut merah saat DB lambat |
| `assets/js/site.js` — jaring aman aset | Gambar gagal dicoba ulang 1×, lalu jatuh ke placeholder lokal (tidak ada kotak kosong) |
| `assets/css/site.css` — `video.video-gagal` | Video yang gagal diberi tanda visual, bukan layar hitam |
| `ops/pantau-tunnel.sh` | Mencatat **setiap** gangguan ke CSV (kode + durasi), jadi bisa diukur bukan dikira-kira |
| `ops/uji-jaringan.py` | Membuktikan siapa yang gagal: aset kita atau pihak ketiga |

## 4. Batasan yang harus dipahami

Tunnel `trycloudflare.com` adalah layanan **tanpa jaminan uptime** — Cloudflare sendiri menyatakannya
demikian. Tidak ada perubahan kode yang bisa mencegah Cloudflare memutus tunnel sesaat. Yang bisa
dilakukan:

1. **URL permanen** → deploy Vercel (`PANDUAN-DEPLOY-VERCEL.md`). Ini solusi sebenarnya.
2. **Selama masih memakai tunnel** → jalankan penjaga + pennantau:
   ```bash
   URL=https://<domain>.trycloudflare.com INTERVAL=45 bash ops/jaga-tunnel.sh
   URL=https://<domain>.trycloudflare.com INTERVAL=15 DURASI=1800 bash ops/pantau-tunnel.sh
   ```
   Bila 530 muncul lagi, ganti URL (tunnel baru) dan bagikan yang baru.

## 5. Status link

Link aktif dan sudah diuji: lihat baris paling atas `LINK-UJI-PUBLIK.md`.
