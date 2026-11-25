-- ============================================================
-- MIGRASI 1.6.3 — Siklus hidup per menu
-- ============================================================
-- Jalankan SEKALI di Supabase SQL Editor setelah migrasi 1.6.2.
-- Idempoten: aman dijalankan berulang.
--
-- Kenapa perlu
-- ------------
-- Kolom `modul_rekam.status` pada 1.6.2 dibatasi CHECK hanya 6 nilai
-- (draf, diperiksa, disetujui, final, arsip, dibatalkan). Mulai 1.6.3
-- setiap menu punya siklus hidupnya sendiri sesuai pekerjaannya, sehingga
-- diperlukan nilai tambahan: ide, riset, penulisan, review, siap, tayang,
-- terjadwal, berjalan, selesai, prospek, kualifikasi, penawaran, negosiasi,
-- menang, kalah, booking, batal, rencana, pra, produksi, pasca, masuk,
-- triase, verifikasi, dikerjakan, ditolak, spam, ditinjau, tampil, dipakai,
-- baru, ditindaklanjuti, ditutup, aktif, nonaktif, berlaku, dicabut, antre,
-- proses, gagal, diterbitkan, diajukan, tarik.
--
-- Constraint diganti: dari daftar tertutup menjadi daftar nilai yang
-- diizinkan (masih divalidasi) + VALIDASI UTAMA tetap di server
-- (server/skema-modul.js: siklus per modul), jadi tidak ada status liar.
-- ============================================================

BEGIN;

-- daftar nilai status yang sah (satu tempat, mudah ditambah)
CREATE TABLE IF NOT EXISTS modul_status_sah (status TEXT PRIMARY KEY);
INSERT INTO modul_status_sah (status) VALUES
  ('draf'),('diperiksa'),('disetujui'),('final'),('arsip'),('dibatalkan'),
  ('ide'),('riset'),('penulisan'),('review'),('siap'),('tayang'),('tarik'),
  ('terjadwal'),('berjalan'),('selesai'),('rencana'),('pra'),('produksi'),('pasca'),
  ('prospek'),('kualifikasi'),('penawaran'),('negosiasi'),('menang'),('kalah'),
  ('booking'),('batal'),('masuk'),('triase'),('verifikasi'),('dikerjakan'),('ditolak'),('spam'),
  ('ditinjau'),('tampil'),('dipakai'),('baru'),('ditindaklanjuti'),('ditutup'),
  ('aktif'),('nonaktif'),('berlaku'),('dicabut'),('antre'),('proses'),('gagal'),('diterbitkan'),('diajukan')
ON CONFLICT (status) DO NOTHING;

-- buang constraint lama
ALTER TABLE modul_rekam DROP CONSTRAINT IF EXISTS modul_rekam_status_check;

-- pasang constraint baru: daftar 49 nilai yang sah (PostgreSQL tidak
-- mengizinkan subquery di CHECK, jadi daftarnya ditulis eksplisit di sini;
-- tabel modul_status_sah di atas dipakai untuk verifikasi & dokumentasi)
ALTER TABLE modul_rekam
  ADD CONSTRAINT modul_rekam_status_check
  CHECK (status = ANY (ARRAY[
    'draf','diperiksa','disetujui','final','arsip','dibatalkan',
    'ide','riset','penulisan','review','siap','tayang','tarik',
    'terjadwal','berjalan','selesai','rencana','pra','produksi','pasca',
    'prospek','kualifikasi','penawaran','negosiasi','menang','kalah',
    'booking','batal','masuk','triase','verifikasi','dikerjakan','ditolak','spam',
    'ditinjau','tampil','dipakai','baru','ditindaklanjuti','ditutup',
    'aktif','nonaktif','berlaku','dicabut','antre','proses','gagal','diterbitkan','diajukan'
  ]::text[]));

-- indeks tambahan: dashboard per status akan sering difilter
CREATE INDEX IF NOT EXISTS idx_modul_rekam_status_only ON modul_rekam (status, modul);

-- kolom tambahan: menandai siklus hidup yang dipakai saat dokumen dibuat
-- (berguna bila suatu menu kelak mengubah alurnya)
ALTER TABLE modul_riwayat ADD COLUMN IF NOT EXISTS siklus TEXT;

-- catatan pada kolom agar jelas siapa yang memvalidasi
COMMENT ON COLUMN modul_rekam.status IS
  'Status per menu. Nilai yang sah divalidasi server/skema-modul.js (siklus hidup per modul), bukan hanya oleh constraint ini.';

COMMIT;

-- ============================================================
-- Verifikasi cepat (jalankan setelah migrasi):
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'modul_rekam_status_check';
-- Harus tampil CHECK dengan daftar panjang (ide, riset, … diajukan).
-- ============================================================
