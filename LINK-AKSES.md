# 🔗 Link Akses — MBCINDONESIA.TV (v1.4.2)

**Cara paling cepat melihat hasil kerja:** panel **LIVE PREVIEW** di percakapan ini
(proses berlabel *"Website & API MBC (Supabase)"*, port **8080**). Itu adalah situs yang
sama persis, dijalankan langsung dari workspace ini.

> Catatan penting: sandbox Arena dilindungi *traffic access token*, jadi URL preview
> (`https://8080-<sandbox-id>.e2b.app/`) hanya bisa dibuka dari browser yang sudah
> login ke Arena — bukan link publik yang bisa dibagikan ke orang lain. Untuk link
> publik sungguhan, perlu **domain + server produksi** (lihat `GO-LIVE.md` §3).

## Peta halaman (semua sudah aktif, HTTP 200)

### Situs publik — untuk pengunjung
| Halaman | Path lokal |
|---|---|
| Beranda | `/` |
| Berita (daftar + pencarian) | `/berita.html` |
| Tonton (program & episode) | `/watch.html` |
| Live TV | `/live.html` |
| Kebijakan Privasi | `/privasi.html` |
| Syarat & Ketentuan | `/syarat.html` |
| PWA (bisa "Add to Home screen" di Android/iOS) | `/manifest.webmanifest` |

### Web App internal (CMS) — staf MBC
| Halaman | Path lokal | Akses |
|---|---|---|
| Gerbang masuk (pilih peran) | `/newsroom/gerbang.html` | publik |
| Workspace / CMS lengkap | `/newsroom/` | **login wajib** |

**Akun demo (sandi `demo123`)** — wajib diganti sebelum publik:

| Email | Peran | Menu yang terbuka |
|---|---|---|
| `direktur@mbcindonesia.tv` | Direksi | 17 menu |
| `redaksi@mbcindonesia.tv` | Editorial | 12 menu |
| `finance@mbcindonesia.tv` | Finance | 7 menu |
| `sales@mbcindonesia.tv` | Sales | 6 menu |

### API (untuk integrasi / Android)
| Endpoint | Fungsi |
|---|---|
| `GET /api/health` | status + provider database (`supabase`, `tls`, `pooler`) |
| `POST /api/auth/login` | masuk, mengembalikan token JWT |
| `GET /api/newsroom/articles` | daftar artikel (butuh token) |
| `GET /api/newsroom/public-list` | artikel tayang untuk situs publik |
| `GET /sitemap.xml`, `/robots.txt` | SEO |

## Menjalankan di mesin/HP sendiri (LAN)

```bash
cd mbcindonesia/server
npm install          # sekali saja
node server.js       # → http://localhost:8080/
```

Lalu buka dari HP yang berada di Wi-Fi yang sama:
`http://<IP-komputer-Anda>:8080/` (mis. `http://192.168.1.10:8080/`).
Server sudah di-bind ke `0.0.0.0`, jadi bisa diakses dari perangkat lain di jaringan lokal.

## Kalau ingin link publik sungguhan

Tiga langkah (detail di `GO-LIVE.md`):
1. Arahkan `mbcindonesia.tv` ke server (A record) — `ops/nginx/mbcindonesia.tv.conf`.
2. Pasang TLS: `certbot --nginx -d mbcindonesia.tv -d www.mbcindonesia.tv`.
3. Jalankan aplikasi: `systemctl enable --now mbcindonesia-tv` (`ops/systemd/`).

Hasil: `https://mbcindonesia.tv/` (publik) dan `https://mbcindonesia.tv/newsroom/` (internal).
