# LAPORAN AUDIT & RENCANA PENGEMBANGAN
## MBC INDONESIA GLOBAL DIGITAL PLATFORM

**Kepada:** Direksi PT. MBC Bojonegoro Info Cybermedia
**Dari:** Operator Sistem IT
**Tanggal:** 24 November 2026
**Acuan:** Dokumen *Arahan Pengembangan dan Penyempurnaan Website MBC Indonesia*
**Situs yang diaudit:** https://mbcindonesia-tv.vercel.app (produksi, live)
**Metode:** pemeriksaan kode, uji HTTP dari luar, uji fungsional Chromium (desktop/Android/iOS/tablet), uji database produksi, uji pemutaran video

---

## RINGKASAN EKSEKUTIF

Platform saat ini berada pada **Tahap I (Evaluasi & Penyempurnaan)** — selesai untuk inti siaran dan berita, dengan **7 dari 10 menu** yang diminta belum dibangun. Tidak ada temuan kritis pada layanan yang sudah live.

| Kategori | Jumlah butir | Keterangan |
|---|---|---|
| **A. Sudah tersedia & berfungsi** | 34 butir | terverifikasi di produksi |
| **B. Sudah ada, perlu diperbaiki/disempurnakan** | 21 butir | berfungsi sebagian atau masih data ilustratif |
| **C. Belum tersedia, harus dibangun** | 46 butir | termasuk 7 menu baru dan Single Account |

**Angka kunci:** 8 program · 26 episode (semua memutar video yang benar, terverifikasi 26/26) · 7 artikel · 28 tabel database · 25 endpoint API · 16 modul CMS internal · CMS terlindungi (401 tanpa token).

**Rekomendasi prioritas:** Single Account (C-1) adalah **prasyarat** bagi Creator, Community, Business, Academy, dan Marketplace. Tanpa itu, tujuh menu baru hanya akan menjadi halaman statis.

---

## A. FITUR YANG SUDAH TERSEDIA DAN BERFUNGSI

### A.1 Siaran & Video (butir B.1 dokumen)
| # | Fitur | Bukti verifikasi |
|---|---|---|
| A-01 | Situs publik live dengan TLS valid, domain Vercel | HTTP 200 dari luar |
| A-02 | MBC Live TV — pemutaran 24 jam | Chromium: `live-24jam.mp4` readyState 4 |
| A-03 | Jadwal program siaran otomatis (13 baris, status selesai/sekarang/berikutnya) | `live.html` #fullRundown 13 baris |
| A-04 | Jadwal tersimpan per program di database | tabel `channels` (6), `programs` (8) |
| A-05 | Katalog VOD 8 program | beranda #katalog 8 kartu |
| A-06 | Halaman tonton per program + daftar episode | `watch.html?id=…` 200 |
| A-07 | **Katalog video per episode (26 episode, klip unik)** | uji 26/26 lulus, `currentSrc` = klip episode |
| A-08 | Layar penuh + kontrol pemutar + poster | live.html #fullscreenBtn, #unmuteBtn |
| A-09 | Replay/tayangan ulang per episode | episode list watch.html |
| A-10 | Label "Sedang diputar" mencegah salah klip | diverifikasi visual |

### A.2 Berita & Informasi (butir B.2)
| # | Fitur | Bukti |
|---|---|---|
| A-11 | Halaman berita dengan 6 kategori (Kebencanaan, Ekonomi, Produksi, Teknologi, Ekonomi Kreatif, Pendidikan) | 6 chip kategori |
| A-12 | Pembaca artikel dalam halaman (reader) | 2.215 karakter terbaca |
| A-13 | Pencarian artikel berfungsi | cari "ekonomi" → 2 hasil dari 6 |
| A-14 | Artikel tersimpan di database (7 artikel + 4 revisi) | tabel `articles`, `article_revisions` |
| A-15 | Artikel terkait & pustaka samping | #sideRel, #sideLib |
| A-16 | Komentar pembaca (API + moderasi) | `/api/comments`, tabel `comments` 4 |
| A-17 | AI companion "Nusa" untuk pembaca | #askNusa, `companion.js` |
| A-18 | Newsletter (pendaftaran email) | `/api/newsletter`, tabel `newsletter_subscribers` |

### A.3 Dashboard Internal / CMS (butir F)
| # | Fitur | Bukti |
|---|---|---|
| A-19 | CMS internal 16 modul: Meja Redaksi, Artikel, Kalender Editorial, Temuan AI, Moderasi Komentar, Media Library, Analitik Konten, Studio AI, Dasbor Direksi, CRM & Pipeline, Iklan & Sponsorship, Produksi & Studio, Keuangan & Pajak, Master Data, Laporan & BI, Audit Trail, Pengaturan | `server/newsroom/index.html` |
| A-20 | **CMS terlindungi**: tanpa token 401 (gerbang 7 KB) | uji `/newsroom` → 401 |
| A-21 | Login per peran (direksi/redaksi/finance/sales) + JWT | `/api/auth/login`, tabel `users` 4, `staff` 4 |
| A-22 | Manajemen artikel: draf → review → terbit, revisi | `editorial_approvals` 8, `article_revisions` 4 |
| A-23 | Moderasi komentar | `comment_moderation` 4 |
| A-24 | CRM pipeline & prospek | `crm_deals` 9, endpoint POST/DELETE |
| A-25 | Iklan & sponsorship: inventaris slot, kampanye, bukti tayang | `ad_slots` 5, `campaigns` 3 |
| A-26 | Keuangan: piutang, umur piutang, persetujuan pembayaran, jurnal | `invoices` 4, `approvals` 3 |
| A-27 | Produksi & studio: board proyek | `production_projects` 6 |
| A-28 | Master data terpusat | `master_items` 17 |
| A-29 | Audit trail aktivitas administrator | `audit_log` 44 |
| A-30 | Laporan & BI: KPI direksi, ekspor CSV | `/api/laporan/kpi.csv` |
| A-31 | Media library | `media_assets` 9 |
| A-32 | 9 agen AI internal | `ai_agents` 9 |
| A-33 | Keamanan akun: ganti kata sandi | `/api/auth/password` |
| A-34 | Workspace tidak ditautkan dari situs publik (sesuai arahan) | audit navigasi publik |

### A.4 Teknologi & Infrastruktur (butir E) — yang sudah
| # | Fitur | Bukti |
|---|---|---|
| A-35 | Tampilan responsif HP/tablet/desktop | tanpa overflow horizontal di 360px, 390px, 768px |
| A-36 | PWA installable (manifest + service worker + 2 ikon) | manifest valid, 1 SW aktif |
| A-37 | Aplikasi Android native (proyek Kotlin, Gradle) | folder `android/`, MainActivity.kt |
| A-38 | Digital Asset Links untuk Android | `/.well-known/assetlinks.json` 200 |
| A-39 | Database terpusat terkelola (Supabase PostgreSQL, 28 tabel) | uji query |
| A-40 | API terpusat (25 endpoint) | `/api/healthz` 200 |
| A-41 | Header keamanan: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | uji header produksi |
| A-42 | Kebijakan Privasi & Syarat Ketentuan | `/privasi.html`, `/syarat.html` 200 |
| A-43 | SEO dasar: sitemap (13 URL), robots.txt, meta description | uji berkas |
| A-44 | Indeksasi & proteksi CMS dari mesin pencari (`noindex`) | meta robots CMS |

---

## B. FITUR YANG SUDAH ADA, PERLU DIPERBAIKI / DISEMPURNAKAN

| # | Butir dokumen | Kondisi sekarang | Kekurangan | Usulan perbaikan | Prioritas |
|---|---|---|---|---|---|
| B-01 | B.1 kualitas HD/FHD/4K | klip 1280×720 (HD) | belum ada FHD/4K, belum ada pemilih kualitas adaptif | transcode HLS multi-bitrate (360p/720p/1080p) + pemilih kualitas | Tinggi |
| B-02 | B.1 jumlah penonton real-time | angka ilustratif (2.418) | bukan data nyata | hitung dari sesi aktif (server-sent events) atau analitik | Sedang |
| B-03 | B.1 sistem pengelolaan saluran | tabel `channels` ada | belum ada UI kelola saluran di CMS | tambah modul "Saluran" di CMS | Sedang |
| B-04 | B.2 berita internasional | 7 artikel domestik | kanal internasional kosong | tambah kategori + sumber wire | Sedang |
| B-05 | B.2 berita daerah/kabupaten | 6 kategori umum | belum ada taksonomi daerah | tambah tag wilayah (Jatim, Kediri, Bojonegoro, …) | Sedang |
| B-06 | B.2 opini & laporan khusus | ada kategori, bukan rubrik khusus | belum dipisah sebagai rubrik | rubrik Opini & Laporan Khusus | Rendah |
| B-07 | B.2 pengiriman berita oleh kontributor | belum ada | perlu alur submit + moderasi | form kirim berita + antrean review di CMS | Tinggi |
| B-08 | B.4 Kamera Komunitas | hanya program TV "Kamera Komunitas" | belum ada pendaftaran kamera, peta, status online/offline | dibangun terpisah (lihat C-4) | Tinggi |
| B-09 | B.8 Podcast | program podcast + halaman tonton | belum ada katalog episode audio, belum bisa upload | katalog podcast + pemutar audio + upload | Sedang |
| B-10 | C. Single Account — fondasi | tabel `users` 4 akun staf | belum ada pendaftaran publik, OTP, pemulihan, 2FA | lihat C-1 | Kritis |
| B-11 | D. Monetisasi — fondasi | CRM, invoice, slot iklan di CMS | belum ada pembayaran online, belum ada laporan otomatis ke mitra | integrasi payment gateway + laporan | Tinggi |
| B-12 | D. pembagian hasil kreator | belum ada | perlu skema & ledger | lihat C-3 | Tinggi |
| B-13 | E.12 analitik pengunjung | **tidak ada** alat analitik terpasang | tidak ada data trafik nyata | pasang Vercel Analytics/Plausible (privasi-friendly) | Tinggi |
| B-14 | E.11 multibahasa | hanya bahasa Indonesia | belum ada versi Inggris | i18n pada halaman publik (ID/EN) | Sedang |
| B-15 | E.10 aplikasi iOS | belum ada | folder `ios/` tidak ada; butuh akun Apple Developer | siapkan proyek SwiftUI/PWA-wrapped | Sedang |
| B-16 | F. manajemen pengguna & anggota | hanya 4 akun staf | belum ada kelola anggota publik | modul Manajemen Anggota | Tinggi |
| B-17 | F. pengelolaan video & siaran | data program/episode di DB | belum ada UI unggah video di CMS | modul unggah + antrean transcode | Tinggi |
| B-18 | F. statistik pengunjung & penonton | tabel `content_analytics` 98 baris | belum ada dasbor trafik nyata | sambungkan B-13 ke dasbor | Sedang |
| B-19 | F. pengaturan backup | skrip `ops/backup.sh` ada | belum terjadwal otomatis | cron harian + uji restore | Tinggi |
| B-20 | G. moderasi & pelaporan penyalahgunaan | moderasi komentar ada | belum ada tombol "laporkan konten" publik | tombol lapor + antrean | Sedang |
| B-21 | A/B. navigasi publik | 5 menu (Beranda, Program, Live TV, Dokumenter, Podcast, Berita) | belum mencerminkan 10 menu baru | restrukturisasi navigasi setelah C selesai | Sedang |

**Catatan uji:** tidak ditemukan galat konsol, tidak ada overflow horizontal pada Android/iPhone/tablet, dan tidak ada tautan yang mengarah ke workspace internal dari halaman publik.

---

## C. FITUR BARU YANG HARUS DIBANGUN

### C.1 MBC SINGLE ACCOUNT (fondasi seluruh ekosistem) — **prioritas #1**
| # | Fitur | Keterangan |
|---|---|---|
| C-01 | Pendaftaran akun publik (email) | tabel baru `members` |
| C-02 | Verifikasi email via OTP | butuh penyedia email (Resend/SendGrid) |
| C-03 | Login sosial (Google) | opsional tahap 2 |
| C-04 | Pemulihan akun (lupa sandi) | token sekali pakai |
| C-05 | Autentikasi dua faktor (TOTP) | untuk staf & kreator |
| C-06 | Profil pengguna + foto | halaman `/akun` |
| C-07 | Dashboard anggota | ringkasan aktivitas |
| C-08 | Pengaturan keamanan & sesi | daftar perangkat aktif |
| C-09 | Hak akses berbasis peran (member/kreator/kontributor/komunitas/operator) | RBAC |
| C-10 | Persetujuan syarat & privasi (consent) | log persetujuan |

### C.2 MBC CREATOR (butir B.3)
| # | Fitur |
|---|---|
| C-11 | Pendaftaran akun kreator + verifikasi |
| C-12 | Profil kreator publik (identitas, portofolio) |
| C-13 | Unggah video/foto/artikel |
| C-14 | Live streaming anggota (butuh RTMP/HLS penyedia) |
| C-15 | Dasbor penonton & pengikut |
| C-16 | Sistem verifikasi kreator (badge) |
| C-17 | Peluang kerja sama & pembagian pendapatan |

### C.3 MBC KAMERA KOMUNITAS (butir B.4)
| # | Fitur |
|---|---|
| C-18 | Pendaftaran kamera komunitas (desa/kecamatan/kabupaten) |
| C-19 | Siaran langsung dari masyarakat (kirim RTMP/unggah) |
| C-20 | Peta lokasi kamera komunitas |
| C-21 | Status kamera online/offline real-time |
| C-22 | Moderasi & persetujuan siaran sebelum tayang |
| C-23 | Pengiriman video liputan oleh anggota |

### C.4 MBC BUSINESS (butir B.5)
| # | Fitur |
|---|---|
| C-24 | Halaman promosi UMKM & perusahaan |
| C-25 | Direktori perusahaan/pelaku usaha |
| C-26 | Formulir pemesanan iklan online |
| C-27 | Paket sponsorship (halaman + checkout) |
| C-28 | Advertorial & kerja sama publikasi |
| C-29 | Dashboard pelanggan iklan + laporan transaksi |

### C.5 MBC TOURISM & DESA BUDAYA (butir B.6)
| # | Fitur |
|---|---|
| C-30 | Profil desa wisata (halaman per desa) |
| C-31 | Informasi destinasi wisata + peta |
| C-32 | Video promosi daerah |
| C-33 | Profil produk unggulan desa |
| C-34 | Dokumentasi budaya & tradisi |
| C-35 | Halaman kerja sama pemda/pelaku pariwisata |

### C.6 MBC PODCAST (butir B.7) — perluasan
| # | Fitur |
|---|---|
| C-36 | Katalog episode podcast (audio) + pemutar |
| C-37 | Unggah audio/video podcast |
| C-38 | Kategori podcast (politik, ekonomi, budaya, pendidikan, hiburan) |
| C-39 | Berbagi tayangan + tautan Spotify/YouTube |

### C.7 MBC COMMUNITY (butir B.8)
| # | Fitur |
|---|---|
| C-40 | Pendaftaran anggota komunitas/organisasi |
| C-41 | Profil komunitas & verifikasi organisasi |
| C-42 | Forum diskusi |
| C-43 | Grup per daerah & bidang |
| C-44 | Kalender kegiatan komunitas |
| C-45 | Pengumuman anggota |

### C.8 MBC ACADEMY (butir B.9)
| # | Fitur |
|---|---|
| C-46 | Katalog kelas (jurnalistik, kreator, bisnis) |
| C-47 | Webinar & seminar online (pendaftaran + tautan rapat) |
| C-48 | Materi pembelajaran digital & unduhan |
| C-49 | Sertifikat & progres peserta |

### C.9 MBC MARKETPLACE (butir B.10)
| # | Fitur |
|---|---|
| C-50 | Etalase UMKM + katalog barang/jasa |
| C-51 | Keranjang & pemesanan |
| C-52 | Integrasi pembayaran resmi (Midtrans/Xendit) |
| C-53 | Manajemen penjual (toko) |
| C-54 | Pesanan, pengiriman, dan penyelesaian |

### C.10 Monetisasi & administrasi (butir D)
| # | Fitur |
|---|---|
| C-55 | Langganan premium (berlangganan berulang) |
| C-56 | Donasi/dukungan komunitas |
| C-57 | Ledger pembagian hasil kreator (transparan) |
| C-58 | Bukti pembayaran & kuitansi otomatis |
| C-59 | Laporan keuangan yang dapat diperiksa pengelola (audit-ready) |

### C.11 Teknologi (butir E) — yang belum
| # | Fitur |
|---|---|
| C-60 | CDN video global (HLS multi-region) |
| C-61 | Backup otomatis terjadwal + uji restore |
| C-62 | Antispam & anti-serangan (rate limit, WAF, CAPTCHA) |
| C-63 | Versi bahasa Inggris (routing `/en/`) |
| C-64 | Aplikasi iOS (App Store) |
| C-65 | Smart TV (versi TV layout / aplikasi) |

**Total: 46 butir C + 21 butir B = 67 butir pekerjaan pengembangan.**

---

## D. PRIORITAS BERDASARKAN KEMAMPUAN ANGGARAN

| Tahap | Isi | Butir | Perkiraan usaha | Prasyarat |
|---|---|---|---|---|
| **Tahap I (selesai)** | Live TV, berita, katalog 26 episode, CMS 16 modul, PWA, Android | A-01…A-44 | — | — |
| **Tahap I-b (2–3 minggu)** | analitik nyata, backup otomatis, penguatan keamanan, rubrik daerah & internasional, tombol lapor | B-03, B-04, B-05, B-13, B-17, B-19, B-20 | rendah–sedang | — |
| **Tahap II (6–8 minggu)** | **Single Account** + dashboard anggota + kontributor + Kamera Komunitas | C-01…C-10, C-18…C-23, B-07, B-16 | besar | penyedia email/OTP |
| **Tahap III (8–12 minggu)** | Creator, Business, Podcast, Community, Academy | C-11…C-17, C-24…C-29, C-36…C-49 | besar | Single Account |
| **Tahap III-b** | Marketplace + pembayaran + ledger kreator | C-50…C-59 | besar | badan usaha & KYC penyedia pembayaran |
| **Tahap IV (4–6 minggu)** | multibahasa, iOS, Smart TV, CDN video, HLS multi-kualitas | C-60…C-65, B-01, B-14, B-15 | sedang–besar | akun Apple Developer |

---

## E. RANCANGAN TEKNIS SEBELUM PERUBAHAN BESAR

### E.1 Single Account (C-01…C-10)
- **Tabel baru:** `members`, `member_sessions`, `otp_codes`, `consent_log`, `member_roles`.
- **Alur:** daftar → kirim OTP (6 digit, berlaku 10 menit, maks 3 percobaan) → verifikasi → sesi JWT (cookie HttpOnly) → dashboard.
- **Keamanan:** argon2id untuk sandi, rate limit 5 percobaan/menit per IP, log perangkat & IP, 2FA TOTP untuk staf.
- **Integrasi:** satu `AuthService` dipakai situs publik, CMS, dan Android (endpoint sama).
- **Migrasi:** akun staf yang ada (`users`, 4 akun) dipetakan ke `members` dengan peran `operator` — tanpa mengganggu CMS yang sudah berjalan.

### E.2 Kamera Komunitas (C-18…C-23)
- Model: `community_cameras` (id, nama, wilayah, lat, lng, status, stream_key, disetujui_oleh).
- Siaran: penerimaan RTMP → konversi HLS oleh penyedia (Mux/Cloudflare Stream), aplikasi hanya mengelola status & moderasi.
- Peta: Leaflet + OpenStreetMap (tanpa biaya lisensi).
- Moderasi: setiap siaran baru berstatus `menunggu` sampai disetujui operator.

### E.3 Marketplace & pembayaran (C-50…C-54)
- **Jangan** menyimpan data kartu. Gunakan halaman pembayaran penyedia (Midtrans Snap / Xendit Checkout).
- Tabel: `shops`, `products`, `orders`, `order_items`, `payments`, `payouts`.
- Status pesanan mengikuti webhook penyedia pembayaran (idempoten, ditandatangani).

### E.4 Multibahasa (C-63)
- Berkas `id.json`/`en.json` + atribut `data-i18n`; rute `/en/…` memakai kerangka sama agar SEO terpisah (`hreflang`).

### E.5 Analitik & penonton nyata (B-02, B-13, B-18)
- Vercel Web Analytics untuk trafik halaman (tanpa cookie pihak ketiga).
- Hitungan penonton: tabel `live_sessions` (heartbeat 30 detik) → agregat di endpoint `/api/live/viewers`; UI berhenti menampilkan angka ilustratif.

### E.6 Prinsip pelaksanaan
1. Setiap fitur baru diuji di lingkungan pratinjau sebelum produksi (sesuai instruksi I.9).
2. Fitur lama tidak dimatikan sebelum pengganti terverifikasi.
3. Semua perubahan skema database memakai migrasi berversi (bukan ubah langsung di produksi).
4. Setiap rilis dicatat di `CHANGELOG.md` dan diuji ulang otomatis.

---

## F. LAMPIRAN — HASIL PENGUJIAN

| Uji | Metode | Hasil |
|---|---|---|
| Pemutaran 26 episode | Chromium, satu per satu, `currentSrc` + `readyState` | 26/26 lulus |
| Pemutaran Live TV | Chromium | `live-24jam.mp4` readyState 4 |
| Pencarian berita | isi kata kunci "ekonomi" | 2 dari 6 artikel tampil |
| Pembaca artikel | klik kartu artikel | 2.215 karakter terbaca |
| Chat live | kirim pesan | pesan tampil |
| Jadwal siaran | hitung baris | 13 baris dengan status |
| Responsif | viewport 360×800, 390×844, 768×1024 | tanpa overflow horizontal |
| PWA | manifest + service worker | valid, 1 SW aktif |
| CMS tanpa token | GET `/newsroom` | 401 (terlindungi) |
| Halaman publik | 9 halaman | semua 200 |
| API publik | `/api/healthz`, `/api/programs` | 200 |
| Header keamanan | HEAD `/` | HSTS, XFO, XCTO, RP terpasang |
| Database | hitung 28 tabel | 28 tabel aktif |
| Galat konsol beranda | Chromium | 0 |

**Kesimpulan:** pekerjaan yang sudah berjalan **sesuai** dengan bagian A–F dokumen untuk lingkup siaran, berita, dashboard internal, dan infrastruktur dasar. Kesenjangan utama ada pada **Single Account** dan **tujuh menu ekonomi/komunitas**, yang memerlukan keputusan anggaran dan penyedia layanan pihak ketiga (email OTP, pembayaran, streaming).
