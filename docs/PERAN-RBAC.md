# Peran & Hak Akses (RBAC) — MBC INDONESIA

Sumber tunggal kebenaran: **`server/peran.js`**. Dokumen ini adalah cermin yang bisa dibaca manusia;
bila keduanya berbeda, `server/peran.js` yang menang.

Panel pengelolaan: **Newsroom → Tata Kelola → Pengguna & Peran** (hanya untuk Administrator).

---

## 1. Dua pintu masuk

| Pintu | Alamat | Untuk siapa | Peran |
|---|---|---|---|
| Publik | `/masuk.html` | pembaca, kreator, kontributor, komunitas, mitra | Anggota Publik (otomatis, tidak bisa masuk Newsroom) |
| Internal | `/newsroom` | karyawan MBC | 8 peran di bawah, diatur administrator |

`/masuk.html` **bukan** tempat memilih peran internal. Pendaftar publik selalu dicatat sebagai
`role='editorial'` dengan label **“Anggota Publik”**, dan login `/newsroom` menolak akun tersebut
karena labelnya bukan peran staf — inilah sebabnya peran tidak dipilih di halaman publik.

---

## 2. Daftar peran

| Kode | Nama | Grup | Ringkasan |
|---|---|---|---|
| `admin` | Administrator | SISTEM | Mengelola pengguna, peran, dan pengaturan sistem |
| `direksi` | Direksi / Pimpinan | PIMPINAN | Melihat seluruh modul & menyetujui terbit |
| `pemred` | Pemimpin Redaksi | PIMPINAN | Memutuskan terbit, memimpin redaksi |
| `redaktur` | Redaktur / Editor | EDITORIAL | Mengedit, memverifikasi, menyiapkan terbit |
| `reporter` | Reporter | EDITORIAL | Menulis draf, mengirim ke review |
| `editorial` | Staf Editorial | EDITORIAL | Peran lama, setara redaktur tanpa wewenang terbit |
| `finance` | Keuangan | KEUANGAN | Keuangan, pajak, metrik |
| `sales` | Komersial | KOMERSIAL | CRM, iklan, sponsorship |

### Bagaimana peran baru disimpan tanpa mengubah database

Constraint `users_role_check` milik database hanya menerima empat nilai:
`direksi`, `finance`, `sales`, `editorial` — dan peran aplikasi `mbc_app` tidak berhak mengubahnya.
Karena itu peran baru disimpan pada **label jabatan** dengan penanda:

```
staff.title = "Pemimpin Redaksi · mbc:role=pemred"
users.role  = "editorial"        ← nilai aman constraint, tidak dipakai untuk wewenang
```

- `server/peran.js` membaca penanda itu lewat `peranEfektif()` / `dariBaris()`.
- Semua jalur (login, token, `/api/state`, gerbang peran, panel admin) memakai **peran efektif**.
- Jabatan tetap bisa dibaca manusia: panel menampilkan `Pemimpin Redaksi`, bukan penandanya.
- Bila constraint dilonggarkan (`docs/MIGRASI-1.6.1.sql` §3 opsional), aplikasi otomatis memakai
  `users.role` apa adanya — tidak ada kode yang perlu diubah.
- Penambahan peran baru **tidak memerlukan migrasi**. Migrasi 1.6.1 hanya untuk kolom
  `status` (aktif/nonaktif), `updated_at`, dan `last_login`.

---

## 3. Matriks izin

| Peran | CMS & Newsroom | Menyetujui terbit | Produksi | Keuangan | Komersial | Metrik & BI | Kelola pengguna |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `admin` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `direksi` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| `pemred` | ✔ | ✔ | ✔ | — | — | ✔ | — |
| `redaktur` | ✔ | — | ✔ | — | — | — | — |
| `reporter` | ✔ | — | — | — | — | — | — |
| `editorial` | ✔ | — | ✔ | — | — | — | — |
| `finance` | — | — | — | ✔ | — | ✔ | — |
| `sales` | — | — | — | — | ✔ | — | — |

Matriks yang sama dikembalikan API `GET /api/newsroom/pengguna/peran` sehingga tampilan UI
tidak pernah menebak — ia membaca sumber yang sama dengan gerbang server.

---

## 4. Aturan yang ditegakkan server (bukan sekadar disembunyikan di UI)

1. **Reporter hanya boleh draf.** Semua perpindahan tahap (`draft → review → fakta → …`) ditolak 403,
   termasuk `terbit` dan `DELETE /articles/:id`.
2. **Hanya `admin`, `direksi`, `pemred` boleh menerbitkan** (`status='tayang'`) dan memanggil
   `POST /articles/:id/approvals`.
3. **`finance` & `sales` ditolak (403) dari modul editorial** — mereka memakai CRM/Komersial dan Keuangan.
4. **Akun `nonaktif` ditolak** saat login dan di setiap `requireRole`, termasuk bila tokennya masih sah.
5. **Studio AI terbuka bagi semua peran ber-CMS**, dengan kuota & audit seperti biasa.

---

## 5. Panel administrator — Pengguna & Peran

Masuk sebagai `admin`, buka **TATA KELOLA → Pengguna & Peran**.

| Aksi | Hasil |
|---|---|
| Daftar akun + pencarian | nama, email, peran, jabatan, status |
| **Ubah peran** | pilih langsung dari daftar 8 peran di kolom Peran (tanpa mengetik kode) |
| **Jabatan** | label bebas, mis. “Redaktur Pelaksana”, “Wakil Pemred”, “Manajer Pemasaran” |
| **Setel sandi** | sandi baru ≥8 karakter, wajib memuat huruf dan angka (bcrypt cost 12) |
| **Aktif / Nonaktifkan** | akun nonaktif tidak bisa login (perlu migrasi 1.6.1) |
| **+ Akun staf baru** | email, nama, peran, jabatan → sandi sementara acak ditampilkan **sekali** |
| **Matriks izin** | tabel peran × izin, dibaca dari `server/peran.js` |

### Pengaman
- Administrator **tidak bisa** menurunkan peran atau menonaktifkan **dirinya sendiri** (409).
- **Administrator terakhir** tidak bisa dicabut (409) — angkat pengganti dulu.
- Setiap perubahan ditulis ke `audit_log` dengan nama pelaku.
- Bila kolom `users.status` belum ada, panel tetap bisa dipakai untuk ubah peran & buat akun;
  tombol status menjawab 501 dengan petunjuk `docs/MIGRASI-1.6.1.sql`.

---

## 6. API

| Metode | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/newsroom/pengguna` | daftar akun, matriks peran, kolom, info migrasi, `saya` |
| GET | `/api/newsroom/pengguna/peran` | matriks izin saja (tanpa data pribadi) |
| PATCH | `/api/newsroom/pengguna/:id/peran` | `{peran, jabatan?}` |
| POST | `/api/newsroom/pengguna/:id/status` | `{status: 'aktif'\|'nonaktif'}` |
| POST | `/api/newsroom/pengguna/:id/sandi` | `{sandi}` |
| POST | `/api/newsroom/pengguna` | `{email, nama, peran, jabatan?, sandi?}` → 201 + `sandi_sementara` |

Semua endpoint di atas: `requireAuth` + izin `kelola_pengguna`.

---

## 7. Akun pertama & pemulihan

1. Jalankan `docs/MIGRASI-1.6.1.sql` (untuk kolom status; peran sendiri tidak butuh migrasi).
2. Angkat satu akun jadi administrator — sekali, dari SQL Editor:
   ```sql
   UPDATE staff SET title = 'Administrator · mbc:role=admin'
   WHERE lower(user_email) = 'pimpinan@mbcindonesia.tv';
   ```
3. Masuk ke Newsroom dengan akun itu → **Pengguna & Peran** → buat akun staf lain.
4. Jika administrator terkunci: ulangi langkah 2 dengan akun lain (tidak ada pintu belakang di aplikasi).

---

## 8. Uji otomatis

```bash
python3 ops/uji-rbac.py          # 60 pemeriksaan API: matriks izin, login per peran,
                                 # batas reporter, wewenang terbit, panel admin,
                                 # proteksi diri sendiri & admin terakhir, validasi sandi,
                                 # audit, peran baru di database ber-constraint lama,
                                 # dan kondisi tanpa migrasi
python3 ops/uji-ui-pengguna.py   # 50 pemeriksaan UI (Chromium): menu admin, tabel,
                                 # pilihan peran, jabatan, setel sandi, aktif/nonaktif,
                                 # akun baru, penolakan 403, peringatan migrasi
```

Keduanya memakai backend tiruan; tidak menyentuh database produksi.
