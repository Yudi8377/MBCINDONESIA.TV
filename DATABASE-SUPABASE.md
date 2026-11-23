# 🗄️ Database Produksi MBCINDONESIA.TV — Supabase (dan cara verifikasi 3 menit)

**Status sekarang: aplikasi berjalan di PostgreSQL lokal di dalam lingkungan sandbox ini.**
Belum tersambung ke Supabase/Neon karena saya **tidak punya (dan tidak boleh meminta) kredensial
database Anda** — sandbox ini juga tidak menyimpan sesi login ke akun Supabase/Neon Anda.

Yang sudah saya kerjakan: **kode, skrip, dan konfigurasi agar berpindah ke Supabase hanya perlu
satu perintah** (tanpa mengubah satu baris pun di aplikasi). Di bawah ini langkah persisnya.

---

## 1. Kenapa Supabase, bukan Neon

| | Supabase | Neon |
|---|---|---|
| Mesin | PostgreSQL 17 (sama dengan yang dipakai sekarang) | PostgreSQL |
| Koneksi dari Node | Session pooler :5432 (IPv4) — cocok untuk server Node biasa | Pooled endpoint, IPv4 butuh konfigurasi tambahan |
| Yang didapat | Postgres + Auth + Storage + REST/Realtime + dashboard SQL | Postgres serverless |
| Kecocokan dengan proyek ini | Skema `schema.sql` + `cms-schema.sql` (28 tabel) langsung jalan | Juga jalan, tetapi tanpa Storage/Auth bawaan |

Kode di repo ini **mendukung keduanya**: `SUPABASE_DB_URL` diprioritaskan, `DATABASE_URL` (Neon)
tetap bisa dipakai. Tidak ada vendor lock-in.

---

## 0. Status terbaru (22 Nov 2026) — apa yang sudah terjadi

Akses Supabase **sudah aktif** di percakapan ini (connector resmi) dan proyek
**`MBCINDONESIA.TV`** (`ref: uoepuofjitaozrlmxomk`, region `ap-southeast-1`, PostgreSQL 17,
status `ACTIVE_HEALTHY`) **sudah terisi**:

| Item | Hasil |
|---|---|
| Tabel | **28 tabel** (`schema.sql` + `cms-schema.sql`) — dibuat lewat migration Supabase |
| Artikel CMS | **7** (2 tayang, 1 review, 1 fakta, 1 siap, 1 draft, 1 ide) |
| Katalog | **8 program + 25 episode** |
| Agen AI | **9** terdaftar |
| Analitik konten | **96 baris** (14 hari × 7 artikel) |
| Total baris di `public` | ± **250 baris** data realistis |
| Akun peran | **4 akun**: `direktur@` (direksi), `redaksi@` (editorial), `finance@` (finance), `sales@` (sales) — sandi `demo123`, hash bcrypt sudah diuji cocok |
| Media & editorial | 8 aset media, 6 approval, 3 komentar + moderasi, catatan & tugas redaksi, 3 jejak audit |
| CRM/Keuangan/Produksi/Master | 8 deal · 3 invoice · 6 proyek · 16 item master |

> **SELESAI 22 Nov 2026:** aplikasi sudah tersambung. Dipakai role aplikasi **`mbc_app`** melalui
> shared pooler (bukan sandi `postgres` Anda), jadi **tidak ada langkah manual yang tersisa**.
> `/api/health` melaporkan `provider:"supabase"`, `tls:true`, `pooler:true`.
> Bagian §2 dan §6 di bawah tetap berguna bila Anda ingin mengganti ke role/connection string lain.
>
> **Yang masih perlu Anda lakukan: satu baris.** Saya sengaja **tidak** mengubah/menebak sandi
> database Anda. Ambil connection string dari dashboard (Settings → Database → **Session pooler**),
> lalu jalankan seperti di §2.4. Setelah itu `/api/health` akan berbunyi `provider: "supabase"`.

Catatan teknis yang sudah saya verifikasi dari sandbox:
- Pooler region ini aktif di host **`aws-1-ap-southeast-1.pooler.supabase.com`** (bukan `aws-0`).
  Host `aws-0-ap-southeast-1` menjawab *“tenant/user … not found”*. Skrip & contoh di repo sudah dikoreksi.
- Koneksi **Direct** (`db.<ref>.supabase.co`) hanya punya alamat IPv6 dan tidak terjangkau dari
  jaringan IPv4 — karena itu **pakai pooler**.

---

## 2. Langkah persis (≈10 menit, sekali saja)

### 2.1 Buat proyek
1. Buka <https://supabase.com/dashboard> → **New project**
2. Region: **Southeast Asia (Singapore)** — terdekat ke Kediri/Jakarta.
3. Simpan **Database Password** yang Anda buat (ini bukan kata sandi akun Supabase).

### 2.2 Ambil connection string
**Project Settings → Database → Connection string → Session pooler** (bukan "Direct connection",
karena direct memakai IPv6 yang sering tidak tersedia di hosting/VPS).

```
postgresql://postgres.abcdefghijklmno:SANDI-ANDA@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

Catatan: `postgres.abcdefghijklmno` = `postgres.<project-ref>`, dan **sandi** harus di-URL-encode
bila mengandung karakter `@ : / ? # %` (mis. `@` → `%40`).

### 2.3 Isi tabel & data (satu perintah)
```bash
cd /path/ke/mbcindonesia/server
export SUPABASE_DB_URL="postgresql://postgres.<ref>:<sandi>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
node setup-supabase.js
```
Skrip ini menjalankan `schema.sql` → `cms-schema.sql` → `seed.js` → `cms-seed.js`, lalu mencetak:
```
✅ Selesai. 28 tabel publik · 7 artikel CMS · akun: direksi=1, editorial=1, finance=1, sales=1
```
Aman diulang (idempotent). Tidak menulis kredensial ke disk.

### 2.4 Pasang di server produksi
```bash
# di server/VPS/hosting
cd /srv/mbcindonesia/server
printf 'NODE_ENV=production\nPORT=8080\nSUPABASE_DB_URL=%s\nJWT_SECRET=%s\nPG_POOL_MAX=5\n' \
  "$SUPABASE_DB_URL" "$(openssl rand -hex 48)" > .env
chmod 600 .env
node server.js            # atau: systemctl restart mbcindonesia
```
(Pakai `ops/systemd/*.service` yang sudah disediakan bila memakai systemd.)

### 2.5 Verifikasi
```bash
curl -s https://mbcindonesia.tv/api/health | python3 -m json.tool
```
Yang harus terlihat:
```json
{ "ok": true, "db": true, "provider": "supabase",
  "db_host": "aws-1-ap-southeast-1.pooler.supabase.com", "tls": true, "pooler": true }
```
`"provider": "supabase"` dan `"tls": true` = aplikasi benar-benar memakai database Supabase.
Bila `"ok": false` → lihat bagian 4.

### 2.6 Amankan (penting, 2 menit)
- Supabase → **Authentication → Providers → Email**: matikan bila tidak memakai Supabase Auth
  (proyek ini memakai JWT sendiri).
- **Database → Network Restrictions**: batasi ke IP server produksi.
- Ganti akun demo `demo123` (lihat `GO-LIVE.md` §5) — **wajib** sebelum publik.
- Backup harian: `ops/backup.sh` sudah menerima `DATABASE_URL`/`SUPABASE_DB_URL`.

---

## 3. Sebaran tabel yang dibuat

| Kelompok | Tabel |
|---|---|
| Inti bisnis (`schema.sql`) | `users`, `programs`, `episodes`, `deals`, `campaigns`, `productions`, `invoices`, `approvals`, `master_*`, `newsletter`, `comments`, `audit_log`, … |
| Newsroom (`cms-schema.sql`) | `channels`, `tags`, `staff`, `articles`, `article_revisions`, `editorial_notes`, `editorial_approvals`, `editorial_tasks`, `media_assets`, `content_analytics`, `ai_agents`, `ai_runs`, `ai_findings`, `agent_jobs`, `comment_moderation` |

Total **28 tabel**. Akun awal (wajib diganti): `direktur@`, `redaksi@`, `finance@`, `sales@mbcindonesia.tv` — sandi `demo123`.

---

## 4. Bila gagal (gejala → penyebab → solusi)

| Gejala dari `setup-supabase.js` / `/api/health` | Penyebab | Solusi |
|---|---|---|
| `getaddrinfo ENOTFOUND` / `timeout` | Memakai **Direct connection** (IPv6) | Pakai **Session pooler** (`...pooler.supabase.com:5432`) |
| `password authentication failed for user "postgres"` | Format user salah | Harus `postgres.<project-ref>`, bukan `postgres` |
| `Invalid URL` | Sandi mengandung `@`/`#`/`?` tanpa encode | URL-encode (`@`→`%40`, `#`→`%23`) |
| `self signed certificate` | `ssl` tidak aktif | Tambahkan `?sslmode=require` di URL |
| `too many connections` | Pool terlalu besar untuk paket gratis | `PG_POOL_MAX=3` (pooler Supabase sudah membatasi) |
| `relation "articles" does not exist` | Skema belum dimuat | Jalankan ulang `node setup-supabase.js` |
| `/api/health` → `provider: "lokal"` | `SUPABASE_DB_URL` belum terbaca | Pastikan `.env` ada di folder `server/` dan proses di-restart |

---

## 5. Yang TIDAK saya lakukan (dan alasannya)

- **Tidak membuat proyek Supabase atas nama Anda** — butuh email, organisasi, dan sandi milik MBC;
  membuatkannya berarti saya memegang kredensial produksi Anda.
- **Tidak menyimpan kredensial apa pun** di repo/dokumen ini (`.env` diblokir `.gitignore`).
- **Tidak mengaktifkan connector Supabase** di percakapan ini: connector tersebut belum terhubung
  (status: *disconnected*) dan sekalipun terhubung, ia mengelola **Storage/Bucket**, bukan mengeksekusi
  `schema.sql`. Untuk memuat skema, jalur yang benar adalah `psql`/driver seperti di atas.

Setelah Anda menjalankan 2.3–2.5, cukup balas “Sudah” beserta keluaran `/api/health`; saya lanjutkan
ke penutupan go-live (uji produksi, backup otomatis, dan tanda tangan rilis).

---

## 6. Panduan klik-demi-klik: mengambil **Session pooler** (Update Dashboard Nov 2026)

> Dashboard Supabase sekarang memakai satu tombol **Connect** di bagian atas halaman proyek.
> Tombol lama *Settings → Database → Connection string* sudah digantikan, tetapi halaman
> `…/database/settings` masih ada untuk **mengatur/mengatur ulang sandi**.

### Rute A — lewat tombol Connect (paling cepat, 4 klik)
1. Buka **https://supabase.com/dashboard** lalu klik organisasi **MBCINDONESIA.TV**.
2. Klik proyek **`MBCINDONESIA.TV`** (ref `uoepuofjitaozrlmxomk`, region *Southeast Asia (Singapore)*).
3. Di bar atas halaman proyek, klik tombol **Connect** (ikon colokan/prize; di layar HP ikonnya saja).
   Tautan langsung: **https://supabase.com/dashboard/project/uoepuofjitaozrlmxomk?showConnect=true&method=session**
4. Muncul dialog **Connect to your database** dengan 3–4 tab:
   `Direct connection` · **`Session pooler`** · `Transaction pooler` · (`Dedicated pooler` hanya Pro).
   → Pilih tab **Session pooler**.
5. Panel berisi **Connection string** dengan dua format: `URI` dan `PSQL`/`JDBC`.
   Pastikan pemilih **URI** aktif, lalu klik ikon **Copy** di kanan.
   Hasilnya berbentuk:
   ```
   postgresql://postgres.uoepuofjitaozrlmxomk:[YOUR-DATABASE-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```
6. Di string itu, **ganti `[YOUR-DATABASE-PASSWORD]`** dengan sandi database proyek Anda.
   Jangan mengubah `postgres.uoepuofjitaozrlmxomk`, host, atau `:5432`.

### Rute B — lewat Settings → Database (bila tombol Connect tidak terlihat)
1. **https://supabase.com/dashboard/project/uoepuofjitaozrlmxomk/settings/database**
2. Gulir ke bagian **Connection string** → tab **URI**.
3. Pilih **Session pooler** (mode *session*, port `5432`), klik **Copy**.
4. Bila sandi tidak diingat: pada panel yang sama buka **Database password** →
   **Reset database password** → simpan sandi baru → **salin segera** (dashboard tidak
   menampilkan sandi setelah dialog ditutup, dan reset memutus koneksi lama).

### Kalau lupa sandi
Dashboard → **Connect** → bagian **Database password** → **Reset database password**.
Sandi baru hanya tampil sekali; simpan di password manager.

### Karakter khusus pada sandi
Bila sandi memuat `& # ? / % @ spasi`, **percent-encode** dulu:
`@`→`%40`, `#`→`%23`, `?`→`%3F`, `&`→`%26`, `/`→`%2F`, `+`→`%2B`.
Contoh: sandi `Mbcdb#2026` → `Mbcdb%232026`.

### Tempel & uji (2 menit)
Pilih salah satu cara:

**a. Sekali pakai (paling aman, tidak tersimpan di file):**
```bash
cd /home/user/mbcindonesia/server
export SUPABASE_DB_URL="postgresql://postgres.uoepuofjitaozrlmxomk:SANDI_ANDA@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
node cek-koneksi.js        # ✅ harus: TERSAMBUNG, 28 tabel public, 7 artikel, 4 akun
```

**b. Permanen (disarankan untuk server):** buat `server/.env` — sudah ada di `.gitignore`,
dan `db.js` membacanya otomatis lewat `dotenv`:
```bash
cd /home/user/mbcindonesia/server
cp .env.example .env        # bila belum ada
nano .env                   # isi baris SUPABASE_DB_URL=... lalu simpan (Ctrl+O, Enter, Ctrl+X)
node cek-koneksi.js         # tanpa argumen: membaca .env
```

**c. Verifikasi aplikasi memakai Supabase:**
```bash
cd /home/user/mbcindonesia/server && node server.js &
curl -s localhost:8080/api/health
# {"ok":true,"db":true,…,"provider":"supabase","db_host":"aws-1-ap-southeast-1.pooler.supabase.com","tls":true,"pooler":true,"version":"1.4.0"}
```

### Arti pesan galat yang umum
| Pesan | Arti | Tindakan |
|---|---|---|
| `tenant/user … not found` / `no tenant identifier` | nomor cluster pooler salah (`aws-0` vs `aws-1`) | salin host dari dialog Connect, jangan diketik |
| `password authentication failed` | sandi salah / belum di-percent-encode | reset sandi, encode karakter khusus |
| `ENETUNREACH` / `getaddrinfo ENOTFOUND db.…` | memakai Direct connection (IPv6 saja) | ganti ke Session pooler |
| `ETIMEDOUT` / `ECONNREFUSED` | port diblokir jaringan | pastikan port `5432` dan host pooler |
| `database "…" does not exist` | nama database salah | gunakan `postgres` |

---

## 7. Cara menjalankan "Tempel & uji" (versi ringkas, 3 perintah)

```bash
# 1) uji connection string saja (boleh dari .env, tanpa argumen)
cd /home/user/mbcindonesia/server
node cek-koneksi.js

# 2) jalankan aplikasi memakai database itu
node server.js

# 3) buktikan lewat health (terminal lain)
curl -s localhost:8080/api/health
```

Keluaran yang benar:
```json
{"ok":true,"db":true,"provider":"supabase",
 "db_host":"aws-1-ap-southeast-1.pooler.supabase.com","db_name":"postgres",
 "tls":true,"pooler":true,"version":"1.4.1"}
```

Bila ingin memakai string sendiri, cukup salin ke file `server/.env` satu baris:
```
SUPABASE_DB_URL=postgresql://postgres.uoepuofjitaozrlmxomk:SANDI@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```
`db.js` membacanya otomatis (dotenv). `.env` sudah di-`.gitignore` dan ber-mode `600`.

Bila memakai role aplikasi (yang sedang dipakai sekarang):
```
SUPABASE_DB_URL=postgresql://mbc_app.uoepuofjitaozrlmxomk:<sandi-role>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```
Bedanya: username `mbc_app.<ref>` dan **tidak bisa DDL** (hanya SELECT/INSERT/UPDATE/DELETE).
