-- ============================================================================
--  PATCH 1.6.4 — hentikan nomor dokumen kembar
--  Jalankan SEKALI di Supabase → SQL Editor → New query → Run
--
--  MASALAH YANG DIPERBAIKI
--  Tabel modul_rekam punya INDEX BIASA bernama idx_modul_rekam_nomor pada
--  kolom (modul, nomor). Index itu TIDAK unik, jadi dua dokumen bisa punya
--  nomor resmi yang sama — mis. dua artikel sama-sama "ART/0001/2026".
--  Untuk dokumen resmi (kontrak, pajak, izin) nomor kembar adalah masalah
--  hukum, bukan sekadar tampilan.
--
--  Apa yang dilakukan skrip ini
--   1. Menampilkan nomor yang saat ini kembar (kalau ada).
--   2. Mengganti index biasa menjadi UNIQUE (nama tetap sama).
--   3. Menyediakan perbaikan data bila ada nomor kembar.
--
--  Aman dijalankan berulang. Kalau sudah unik, langkah 2 hanya menegaskan.
-- ============================================================================

-- ---------- 1. LIHAT nomor yang kembar (seharusnya 0 baris) ----------
SELECT modul, nomor, COUNT(*) AS jumlah, array_agg(id ORDER BY id) AS id_dokumen
FROM modul_rekam
WHERE nomor IS NOT NULL
GROUP BY modul, nomor
HAVING COUNT(*) > 1
ORDER BY modul, nomor;

-- ---------- 2. PERBAIKI data kembar (jalankan bila langkah 1 ada isinya) ----------
-- Nomor yang kembar diberi akhiran -2, -3, ... supaya tetap unik tanpa menghapus
-- dokumen. Catatan: cara paling rapi adalah membuka dokumen kembar itu di CMS,
-- catat nomornya, lalu terbitkan ulang — tetapi langkah ini menyelamatkan data
-- lama yang sudah terlanjur dibuat.
WITH kembar AS (
  SELECT id, modul, nomor,
         ROW_NUMBER() OVER (PARTITION BY modul, nomor ORDER BY id) AS ke
  FROM modul_rekam
  WHERE nomor IS NOT NULL
    AND (modul, nomor) IN (
      SELECT modul, nomor FROM modul_rekam
      WHERE nomor IS NOT NULL GROUP BY modul, nomor HAVING COUNT(*) > 1
    )
)
UPDATE modul_rekam r
SET nomor = k.nomor || '-' || k.ke,
    diubah_at = now()
FROM kembar k
WHERE r.id = k.id AND k.ke > 1;

-- ---------- 3. JADIKAN nomor WAJIB UNIK per modul ----------
DROP INDEX IF EXISTS idx_modul_rekam_nomor;
CREATE UNIQUE INDEX idx_modul_rekam_nomor ON modul_rekam (modul, nomor);

-- ---------- 4. VERIFIKASI (harus menampilkan "unik" = true) ----------
SELECT i.indexname,
       i.indexdef LIKE '%UNIQUE%' AS unik
FROM pg_indexes i
WHERE i.tablename = 'modul_rekam'
  AND i.indexname = 'idx_modul_rekam_nomor';

-- ---------- 5. Selaraskan penghitung nomor dengan data nyata ----------
-- (menjamin nomor berikutnya melanjutkan yang terakhir, bukan mulai dari 1)
UPDATE modul_nomor mn
SET urut = x.maks
FROM (
  SELECT modul,
         MAX(NULLIF(regexp_replace(nomor, '^[^/]+/(\d+)/.*$', '\1'), '')::int) AS maks
  FROM modul_rekam
  WHERE nomor IS NOT NULL
  GROUP BY modul
) x
WHERE mn.modul = x.modul
  AND x.maks IS NOT NULL
  AND mn.urut <> x.maks;

-- ---------- 6. HASIL AKHIR ----------
SELECT modul, tahun, urut, prefiks FROM modul_nomor ORDER BY modul;
