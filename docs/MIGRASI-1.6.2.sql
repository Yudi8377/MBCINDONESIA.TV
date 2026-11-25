-- ============================================================
-- MIGRASI 1.6.2 — Kerangka Modul (registri dokumen semua menu)
-- ============================================================
-- Jalankan SEKALI di Supabase SQL Editor (sebagai pemilik project,
-- bukan `mbc_app` — peran aplikasi tidak berhak membuat tabel).
--
--   Supabase Dashboard → SQL Editor → tempel berkas ini → Run
--
-- Aman dijalankan berulang (idempoten).
--
-- Kenapa satu tabel untuk semua modul
-- -----------------------------------
-- Setiap menu punya form berbeda (faktur pajak, insertion order,
-- penugasan liputan, aset media, dsb.). Daripada membuat 19 tabel dan
-- 19 migrasi baru setiap kali ada kolom tambahan, formulir disimpan
-- sebagai JSONB dengan skema yang divalidasi server (server/skema-modul.js).
-- Hasilnya: satu migrasi, field bisa ditambah tanpa DDL.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. Registri dokumen semua modul
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modul_rekam (
  id            BIGSERIAL PRIMARY KEY,
  modul         TEXT NOT NULL,                 -- 'keuangan', 'crm', 'articles', …
  nomor         TEXT,                          -- nomor dokumen resmi (auto, berurut per modul)
  judul         TEXT NOT NULL,                 -- ringkasan satu baris untuk daftar/pencarian
  status        TEXT NOT NULL DEFAULT 'draf',  -- draf|diperiksa|disetujui|final|arsip (per modul)
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,   -- seluruh isian form
  dibuat_oleh   TEXT,                          -- email pelaku
  diperiksa_oleh TEXT,
  disetujui_oleh TEXT,
  dibuat_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  diubah_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT modul_rekam_status_check
    CHECK (status IN ('draf','diperiksa','disetujui','final','arsip','dibatalkan'))
);

CREATE INDEX IF NOT EXISTS idx_modul_rekam_modul   ON modul_rekam (modul, dibuat_at DESC);
CREATE INDEX IF NOT EXISTS idx_modul_rekam_status  ON modul_rekam (modul, status);
CREATE INDEX IF NOT EXISTS idx_modul_rekam_nomor   ON modul_rekam (modul, nomor);
-- pencarian teks pada isian form
CREATE INDEX IF NOT EXISTS idx_modul_rekam_data    ON modul_rekam USING gin (data);
-- pencarian judul (ILIKE '%…%')
CREATE INDEX IF NOT EXISTS idx_modul_rekam_judul   ON modul_rekam (lower(judul));

-- ------------------------------------------------------------------
-- 2. Penomoran dokumen berurut per modul & tahun
--    (Faktur pajak harus unik berurut; kwitansi & IO pun butuh urutan)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modul_nomor (
  modul      TEXT NOT NULL,
  tahun      INT  NOT NULL,
  urut       INT  NOT NULL DEFAULT 0,
  prefiks    TEXT,
  PRIMARY KEY (modul, tahun)
);

-- fungsi pengambil nomor berikutnya — atomik, aman untuk banyak pengguna
CREATE OR REPLACE FUNCTION modul_nomor_berikut(p_modul TEXT, p_prefiks TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_tahun INT := EXTRACT(YEAR FROM now());
  v_urut  INT;
  v_pref  TEXT;
BEGIN
  INSERT INTO modul_nomor (modul, tahun, urut, prefiks)
  VALUES (p_modul, v_tahun, 1, p_prefiks)
  ON CONFLICT (modul, tahun)
  DO UPDATE SET urut = modul_nomor.urut + 1,
                prefiks = COALESCE(p_prefiks, modul_nomor.prefiks)
  RETURNING urut, COALESCE(prefiks, 'DOK') INTO v_urut, v_pref;

  RETURN v_pref || '/' || LPAD(v_urut::text, 4, '0') || '/' || v_tahun;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------
-- 3. Riwayat perubahan tiap dokumen (siapa, kapan, apa)
--    Melengkapi audit_log yang sudah ada; wajib untuk dokumen pajak
--    (UU KUP Pasal 28: dokumen & catatan harus tersimpan 10 tahun).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modul_riwayat (
  id          BIGSERIAL PRIMARY KEY,
  rekam_id    BIGINT REFERENCES modul_rekam(id) ON DELETE CASCADE,
  modul       TEXT NOT NULL,
  aksi        TEXT NOT NULL,        -- buat|ubah|status|cetak|hapus
  status_lama TEXT,
  status_baru TEXT,
  perubahan   JSONB,
  oleh        TEXT,
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_modul_riwayat_rekam ON modul_riwayat (rekam_id, at DESC);

-- ------------------------------------------------------------------
-- 4. Lampiran (bukti tayang, faktur scan, kontrak, izin lokasi)
--    Berkas disimpan sebagai data URI/tautan; batas 2 MB per lampiran.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modul_lampiran (
  id        BIGSERIAL PRIMARY KEY,
  rekam_id  BIGINT REFERENCES modul_rekam(id) ON DELETE CASCADE,
  nama      TEXT NOT NULL,
  jenis     TEXT,                  -- image/png, application/pdf, …
  ukuran    INT,
  isi       TEXT,                  -- data URI base64 ATAU tautan arsip
  diunggah_oleh TEXT,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_modul_lampiran_rekam ON modul_lampiran (rekam_id);

-- ------------------------------------------------------------------
-- 5. Hak akses peran aplikasi + RLS
--    Dijalankan di blok DO supaya tidak gagal bila peran tidak ada
--    (mis. saat migrasi diuji di PostgreSQL lokal/WASM).
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mbc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON modul_rekam, modul_nomor, modul_riwayat, modul_lampiran TO mbc_app;
    GRANT USAGE, SELECT ON SEQUENCE modul_rekam_id_seq, modul_riwayat_id_seq, modul_lampiran_id_seq TO mbc_app;
    GRANT EXECUTE ON FUNCTION modul_nomor_berikut(TEXT, TEXT) TO mbc_app;

    ALTER TABLE modul_rekam    ENABLE ROW LEVEL SECURITY;
    ALTER TABLE modul_nomor    ENABLE ROW LEVEL SECURITY;
    ALTER TABLE modul_riwayat  ENABLE ROW LEVEL SECURITY;
    ALTER TABLE modul_lampiran ENABLE ROW LEVEL SECURITY;

    -- kebijakan tunggal untuk peran aplikasi (selaras dengan tabel lain:
    -- invoices & master_items memakai pola `mbc_app_all` yang sama)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='modul_rekam' AND policyname='mbc_app_all') THEN
      CREATE POLICY mbc_app_all ON modul_rekam    FOR ALL TO mbc_app USING (true) WITH CHECK (true);
      CREATE POLICY mbc_app_all ON modul_nomor    FOR ALL TO mbc_app USING (true) WITH CHECK (true);
      CREATE POLICY mbc_app_all ON modul_riwayat  FOR ALL TO mbc_app USING (true) WITH CHECK (true);
      CREATE POLICY mbc_app_all ON modul_lampiran FOR ALL TO mbc_app USING (true) WITH CHECK (true);
    END IF;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- CATATAN OPERASIONAL
-- ------------------------------------------------------------
-- * Setelah tabel ini ada, menu "Data & Formulir" di setiap modul
--   langsung aktif. Sebelumnya, form tetap bisa dibuka tetapi
--   penyimpanan menjawab 501 disertai petunjuk migrasi ini.
-- * Masa simpan: dokumen keuangan/pajak 10 tahun (UU KUP 28/2007
--   Pasal 28 ayat (11)); dokumen penyiaran & iklan minimal 5 tahun
--   (UU Penyiaran 32/2002 Pasal 24). Jangan hapus baris—gunakan
--   status 'arsip'.
-- * Nomor dokumen diambil dari modul_nomor_berikut() sehingga
--   unik & berurut per modul per tahun; jangan diisi manual.
-- ============================================================
