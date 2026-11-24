-- ============================================================
-- MIGRASI 1.6.1 — Peran lengkap (RBAC) & status akun
-- ============================================================
-- Jalankan sebagai PEMILIK tabel (mis. user `postgres`). Peran aplikasi
-- `mbc_app` tidak punya hak DDL, sehingga perintah ini akan gagal bila
-- dijalankan dari aplikasi. Di Supabase: SQL Editor → tempel → Run.
--
--   psql "$DATABASE_URL_PEMILIK" -f docs/MIGRASI-1.6.1.sql
--
-- Aman dijalankan berulang (idempoten).
--
-- PENTING — yang dibutuhkan dan yang tidak:
--   * Peran baru (admin, pemred, redaktur, reporter) SUDAH berfungsi tanpa
--     migrasi ini. Peran disimpan pada label jabatan (`staff.title`) dengan
--     penanda `mbc:role=…`, dibaca oleh server/peran.js. Tidak perlu DDL.
--   * Migrasi ini menambah kolom operasional: status akun, updated_at,
--     last_login. Tanpa migrasi, tombol Aktif/Nonaktif di panel menjawab 501
--     disertai petunjuk (bukan error 500).
--   * Melonggarkan `users_role_check` BERSIFAT OPSIONAL. Bila dilakukan,
--     `users.role` boleh menyimpan nilai peran baru dan aplikasi otomatis
--     memakainya apa adanya (tanpa penanda).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. Kolom operasional akun
-- ------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'aktif';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- created_at sudah ada di instalasi sekarang; tambahkan bila belum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'created_at') THEN
    ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- ------------------------------------------------------------------
-- 2. Batasi nilai status (peran TIDAK dikunci — lihat catatan di atas)
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_status_check
      CHECK (status IN ('aktif', 'nonaktif', 'ditangguhkan'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users (role);

-- ------------------------------------------------------------------
-- 3. (OPSIONAL) Longgarkan constraint peran lama
--    Hanya jalankan bila ingin `users.role` menyimpan peran baru
--    secara langsung. Aplikasi tetap kompatibel dengan keduanya.
-- ------------------------------------------------------------------
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
--   'admin', 'direksi', 'pemred', 'redaktur', 'reporter',
--   'editorial', 'finance', 'sales'
-- ));

-- ------------------------------------------------------------------
-- 4. Penanda peran pada tabel staff (dipakai bila constraint dibiarkan)
--    Format: "<Jabatan> · mbc:role=<kode>"
-- ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff (lower(user_email));

COMMIT;

-- ============================================================
-- LANGKAH SETELAH MIGRASI
-- ------------------------------------------------------------
-- 1. Angkat administrator pertama (sekali saja, dari SQL):
--
--      UPDATE staff SET title = 'Administrator · mbc:role=admin'
--      WHERE lower(user_email) = 'pimpinan@mbcindonesia.tv';
--
--    Bila tabel staff tidak dipakai untuk akun itu, cadangannya:
--
--      UPDATE users SET role_label = 'Administrator · mbc:role=admin'
--      WHERE lower(email) = 'pimpinan@mbcindonesia.tv';
--
-- 2. Masuk ke Newsroom dengan akun tersebut → menu
--    TATA KELOLA → Pengguna & Peran. Semua penugasan peran berikutnya
--    dilakukan dari UI, tidak perlu SQL lagi.
--
-- 3. Periksa hasilnya:
--
--      SELECT u.email, u.role, u.role_label, s.title
--      FROM users u LEFT JOIN staff s ON lower(s.user_email) = lower(u.email)
--      ORDER BY u.id;
--
--    Kolom `s.title` memuat jabatan + penanda peran; `u.role` tetap pada
--    nilai yang diterima constraint lama (direksi/finance/sales/editorial).
--
-- 4. Ganti kata sandi demo (`demo123`) untuk setiap akun staf lewat
--    panel administrator (Setel sandi).
-- ============================================================
