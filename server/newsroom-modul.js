/* ============================================================
   newsroom-modul.js — Registri dokumen untuk SEMUA modul sidebar
   ------------------------------------------------------------
   Satu API generik yang melayani 19 menu: daftar (cari/filter/paging),
   buat, baca, ubah, hapus (soft → arsip), ubah status, riwayat, dan
   data cetak. Skema field per modul ada di server/skema-modul.js.

     GET    /api/newsroom/modul                    daftar modul + skema
     GET    /api/newsroom/modul/:modul/skema       skema satu modul
     GET    /api/newsroom/modul/:modul             daftar dokumen
     POST   /api/newsroom/modul/:modul             buat dokumen (+nomor otomatis)
     GET    /api/newsroom/modul/:modul/:id         baca satu dokumen
     PATCH  /api/newsroom/modul/:modul/:id         ubah isian
     POST   /api/newsroom/modul/:modul/:id/status  ubah status (alur dijaga)
     DELETE /api/newsroom/modul/:modul/:id         arsipkan (tidak menghapus permanen)
     GET    /api/newsroom/modul/:modul/:id/riwayat jejak perubahan
     GET    /api/newsroom/modul/:modul/:id/cetak   data siap cetak (dokumen resmi)

   Dasar aturan yang ditegakkan di sini (bukan hanya di tampilan):
     - izin per modul lewat RBAC (server/peran.js)
     - field wajib, pola NPWP/NIB, batas angka, perhitungan pajak
     - alur status draf → diperiksa → disetujui → final, tanpa lompatan
     - dokumen final tidak bisa diubah isinya (harus dikembalikan dulu)
     - penghapusan = arsip; masa simpan pajak 10 tahun (UU KUP Pasal 28)
   ============================================================ */
'use strict';

const RBAC = require('./peran');
const SKEMA = require('./skema-modul');

/* izin minimum per modul — memakai kunci izin yang sudah ada di peran.js */
const IZIN_MODUL = {
  keuangan: 'keuangan',
  laporan: 'keuangan',
  master: 'keuangan',
  audit: 'keuangan',
  crm: 'komersial',
  ads: 'komersial',
  produksi: 'produksi',
  desk: 'cms', articles: 'cms', calendar: 'cms', findings: 'cms',
  antrean: 'cms', moderation: 'cms', media: 'cms', 'content-analytics': 'cms',
  'ai-studio': 'cms',
  dashboard: 'metrik',
  pengguna: 'kelola_pengguna',
  pengaturan: 'cms'
};

const labelDari = (modul, status) => (SKEMA.labelModul(modul) || {})[status] || status;
const bersih = (s) => String(s == null ? '' : s).trim();
const angkaDari = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const bulat = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ---------- validasi & perhitungan ---------- */
function hitungNilai(field, data) {
  const out = { ...data };
  for (const f of field) {
    if (!f.hitung) continue;
    const ambil = (k) => angkaDari(out[k]) || 0;
    const [a, b] = (f.hitungDari || []).map(ambil);
    if (f.hitung === 'ppn') out[f.kunci] = bulat(a * (b || 0) / 100);
    else if (f.hitung === 'pph23') out[f.kunci] = bulat(a * (b || 0) / 100);
    else if (f.hitung === 'ppn_kontrak') out[f.kunci] = bulat(a * 0.11);
    else if (f.hitung === 'jumlah') out[f.kunci] = bulat((ambil('dpp') || 0) + (ambil('ppn') || 0) - (ambil('pph23') || 0));
  }
  return out;
}

function validasi(skema, data) {
  const salah = [];
  const hasil = {};
  for (const f of skema.field) {
    let v = data[f.kunci];
    const kosong = v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
    if (kosong) {
      if (f.wajib) salah.push(`${f.label} wajib diisi`);
      continue;
    }
    if (f.jenis === 'angka' || f.jenis === 'uang') {
      const n = angkaDari(v);
      if (n === null) { salah.push(`${f.label} harus berupa angka`); continue; }
      if (f.min != null && n < f.min) salah.push(`${f.label} minimal ${f.min}`);
      if (f.max != null && n > f.max) salah.push(`${f.label} maksimal ${f.max}`);
      v = n;
    } else if (f.jenis === 'centang') {
      v = !!v;
    } else if (f.jenis === 'multi') {
      if (!Array.isArray(v)) v = String(v).split(',').map(s => s.trim()).filter(Boolean);
      const sah = (f.opsi || []).map(o => o.nilai);
      const asing = v.filter(x => sah.length && !sah.includes(x));
      if (asing.length) salah.push(`${f.label}: pilihan tidak dikenal (${asing.join(', ')})`);
    } else if (f.jenis === 'pilih') {
      const sah = (f.opsi || []).map(o => o.nilai);
      if (sah.length && !sah.includes(String(v))) salah.push(`${f.label}: nilai tidak dikenal (${v})`);
      v = String(v);
    } else {
      v = String(v);
      if (f.pola && !new RegExp(f.pola).test(v)) salah.push(`${f.label} formatnya tidak sesuai`);
      if (f.jenis === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v)) salah.push(`${f.label} bukan email sah`);
      if (v.length > 20000) salah.push(`${f.label} terlalu panjang (maks 20.000 karakter)`);
    }
    hasil[f.kunci] = v;
  }
  return { salah, data: hitungNilai(skema.field, hasil) };
}

/* ringkasan satu baris untuk kolom 'judul' */
/* Ringkasan satu baris untuk kolom 'judul'.
   1.6.4 — dulu daftar kolom ditulis tetap dan TIDAK memuat 'judul_artikel',
   sehingga dokumen artikel yang disimpan berjudul "Berita (straight news)"
   (label jenis), bukan judul naskahnya. Sekarang: nama kolom yang lazim,
   lalu kolom mana pun yang labelnya bernuansa judul, lalu teks terpanjang. */
function judulDari(skema, data) {
  const calon = ['judul_artikel', 'judul', 'uraian', 'perihal', 'agenda', 'judul_perkara',
    'pokok', 'proyek', 'perusahaan', 'pengiklan', 'nama', 'objek', 'maksud',
    'judul_dok', 'komentar', 'staf', 'temuan'];
  for (const k of calon) {
    const v = bersih(data[k]);
    if (v) return v.slice(0, 180);
  }
  /* cadangan 1: kolom yang labelnya menyiratkan judul (mis. "Judul Artikel") */
  for (const f of (skema.field || [])) {
    if (/judul|nama|perihal|uraian|agenda|pokok|ringkas/i.test(f.label || '')) {
      const v = bersih(data[f.kunci]);
      if (v) return v.slice(0, 180);
    }
  }
  /* cadangan 2: isian teks terpanjang — hampir selalu judul/uraian */
  const teks = (skema.field || [])
    .filter(f => f.jenis === 'teks' || f.jenis === 'textarea')
    .map(f => bersih(data[f.kunci])).filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (teks.length) return teks[0].slice(0, 180);
  const jenis = (skema.jenisDokumen.find(j => j.nilai === data.jenis) || {}).label;
  return jenis || 'Dokumen tanpa uraian';
}

module.exports = function mountModul(app, ctx) {
  /* Dokumen resmi (pajak, kontrak, izin) tidak boleh tersimpan di cache peramban/proxy. */
  app.use('/api/newsroom/modul', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const { pool, requireAuth, audit } = ctx;
  const q = (sql, p) => pool.query(sql, p);
  const pelaku = (req) => (req.user && (req.user.email || req.user.name)) || 'operator';
  const nama = (req) => (req.user && (req.user.name || req.user.email)) || 'operator';

  /* tabel tersedia? (migrasi 1.6.2) */
  let adaTabel = null;
  async function cekTabel() {
    if (adaTabel !== null) return adaTabel;
    const { rows } = await q(`SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('modul_rekam','modul_nomor','modul_riwayat')`);
    adaTabel = rows.length >= 2;
    return adaTabel;
  }
  const pesanMigrasi = (res) => res.status(501).json({
    error: 'Tabel modul belum ada. Jalankan docs/MIGRASI-1.6.2.sql di Supabase SQL Editor, lalu coba lagi.',
    migrasi: 'docs/MIGRASI-1.6.2.sql'
  });

  /* Gerbang izin. Dua tingkat:
     - baca  : pemilik modul (finance → keuangan, sales → komersial, dst.) ATAU penyetuju
               (admin/direksi/pemred), karena dokumen harus bisa diperiksa & disetujui
               walau penyetuju bukan pemilik modulnya.
     - tulis : hanya pemilik modul. Penyetuju tidak mengisi dokumen orang lain. */
  function gerbang(modulNama, tingkat) {
    const kunci = IZIN_MODUL[modulNama];
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: 'Token tidak ada' });
      if (!SKEMA.layak(modulNama)) return res.status(404).json({ error: 'Modul tidak dikenal: ' + modulNama });
      const punyaModul = !kunci || RBAC.boleh(req.user.role, kunci);
      const penyetuju = RBAC.boleh(req.user.role, 'setujui');
      if (tingkat === 'tulis' ? !punyaModul : !(punyaModul || penyetuju)) {
        return res.status(403).json({ error: `Peran ${RBAC.info(req.user.role).nama} tidak berhak ${tingkat === 'tulis' ? 'mengisi' : 'mengakses'} modul ini` });
      }
      next();
    };
  }

  /* ---------- daftar modul & skema ---------- */
  app.get('/api/newsroom/modul', requireAuth, (req, res) => {
    const peran = req.user.role;
    const daftar = SKEMA.semua().map(m => ({
      ...m,
      siklus: SKEMA.siklusModul(m.modul),
      label_status: SKEMA.labelModul(m.modul),
      boleh: !IZIN_MODUL[m.modul] || RBAC.boleh(peran, IZIN_MODUL[m.modul])
    }));
    res.json({ modul: daftar, alur: SKEMA.ALUR, status_label: SKEMA.STATUS_LABEL, tabel_siap: adaTabel !== false });
  });

  app.get('/api/newsroom/modul/:modul/skema', requireAuth, gerbang2, (req, res) => {
    const k = req.params.modul;
    res.json({ modul: k, skema: SKEMA.ambil(k), alur: SKEMA.siklusModul(k), status_label: SKEMA.labelModul(k) });
  });
  function gerbang2(req, res, next) {
    if (!SKEMA.layak(req.params.modul)) return res.status(404).json({ error: 'Modul tidak dikenal' });
    next();
  }

  /* Penjaga id: /modul/kalender/abc sebelumnya menghasilkan
     `invalid input syntax for type bigint: "NaN"` → HTTP 500 seolah server
     rusak. Id yang bukan angka harus dijawab 400, bukan 500. */
  function idSah(req, res, next) {
    const v = String(req.params.id || '');
    if (!/^[0-9]{1,18}$/.test(v)) {
      return res.status(400).json({ error: 'Id dokumen harus berupa angka' });
    }
    next();
  }

  /* ---------- daftar dokumen ---------- */
  app.get('/api/newsroom/modul/:modul', requireAuth, (req, res, next) => gerbang(req.params.modul)(req, res, next), async (req, res) => {
    try {
      if (!(await cekTabel())) return pesanMigrasi(res);
      const modul = req.params.modul;
      const cari = bersih(req.query.cari);
      const status = bersih(req.query.status);
      const batas = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const halaman = Math.max(Number(req.query.page) || 1, 1);
      const where = ['modul=$1'];
      const args = [modul];
      if (status && SKEMA.siklusModul(modul)[status]) { args.push(status); where.push(`status=$${args.length}`); }
      if (cari) { args.push(`%${cari.toLowerCase()}%`); where.push(`(lower(judul) LIKE $${args.length} OR coalesce(nomor,'') ILIKE $${args.length})`); }
      const klausa = where.join(' AND ');
      const total = (await q(`SELECT count(*)::int AS n FROM modul_rekam WHERE ${klausa}`, args)).rows[0].n;
      args.push(batas, (halaman - 1) * batas);
      const { rows } = await q(`SELECT id, nomor, judul, status, data, dibuat_oleh, dibuat_at, diubah_at
        FROM modul_rekam WHERE ${klausa} ORDER BY id DESC LIMIT $${args.length - 1} OFFSET $${args.length}`, args);
      /* ringkasan status untuk tab filter */
      const perStatus = (await q(`SELECT status, count(*)::int AS n FROM modul_rekam WHERE modul=$1 GROUP BY status`, [modul])).rows;
      res.json({ modul, dokumen: rows, total, halaman, batas, status: Object.fromEntries(perStatus.map(r => [r.status, r.n])) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- buat dokumen ---------- */
  app.post('/api/newsroom/modul/:modul', requireAuth, (req, res, next) => gerbang(req.params.modul, 'tulis')(req, res, next), async (req, res) => {
    try {
      if (!(await cekTabel())) return pesanMigrasi(res);
      const modul = req.params.modul;
      const skema = SKEMA.ambil(modul);
      const { salah, data } = validasi(skema, req.body || {});
      if (salah.length) return res.status(400).json({ error: salah[0], rincian: salah });
      const judul = judulDari(skema, data);
      /* Nomor urut resmi. 1.6.4: bila nomor hasil counter ternyata sudah terpakai
         (pernah terjadi setelah data disalin dari CMS lama), ambil nomor berikutnya
         alih-alih menyimpan nomor kembar. Nomor kembar pada dokumen resmi =
         masalah hukum, jadi ini dijaga di sisi server, bukan hanya di UI. */
      let nomor = null;
      try {
        for (let coba = 0; coba < 50 && !nomor; coba++) {
          const r = await q('SELECT modul_nomor_berikut($1,$2) AS nomor', [modul, skema.prefiks]);
          const calon = r.rows[0].nomor;
          const pakai = await q('SELECT 1 FROM modul_rekam WHERE modul=$1 AND nomor=$2 LIMIT 1', [modul, calon]);
          if (!pakai.rows.length) nomor = calon;
        }
      } catch (_) { nomor = null; }
      if (!nomor) nomor = `${skema.prefiks}/${Date.now().toString().slice(-6)}/${new Date().getFullYear()}`;
      const awal = SKEMA.statusAwal(modul);
      const { rows } = await q(`INSERT INTO modul_rekam (modul, nomor, judul, status, data, dibuat_oleh)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nomor, judul, status, data, dibuat_at`,
        [modul, nomor, judul, awal, data, pelaku(req)]);
      await q(`INSERT INTO modul_riwayat (rekam_id, modul, aksi, status_baru, oleh) VALUES ($1,$2,'buat',$3,$4)`,
        [rows[0].id, modul, awal, pelaku(req)]).catch(() => {});
      await audit(`Modul ${modul}: dokumen baru ${nomor} — ${judul.slice(0, 80)} oleh ${nama(req)}`, nama(req));
      res.status(201).json({ ok: true, dokumen: rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- baca satu ---------- */
  app.get('/api/newsroom/modul/:modul/:id', requireAuth, (req, res, next) => gerbang(req.params.modul)(req, res, next), idSah, async (req, res) => {
    try {
      if (!(await cekTabel())) return pesanMigrasi(res);
      const { rows } = await q('SELECT * FROM modul_rekam WHERE id=$1 AND modul=$2', [Number(req.params.id), req.params.modul]);
      if (!rows.length) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
      res.json({ dokumen: rows[0], skema: SKEMA.ambil(req.params.modul), alur: SKEMA.ALUR });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- ubah isian ---------- */
  app.patch('/api/newsroom/modul/:modul/:id', requireAuth, (req, res, next) => gerbang(req.params.modul, 'tulis')(req, res, next), idSah, async (req, res) => {
    try {
      if (!(await cekTabel())) return pesanMigrasi(res);
      const modul = req.params.modul, id = Number(req.params.id);
      const skema = SKEMA.ambil(modul);
      const { rows: ada } = await q('SELECT * FROM modul_rekam WHERE id=$1 AND modul=$2', [id, modul]);
      if (!ada.length) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
      if (SKEMA.siklusModul(modul)[ada[0].status] && SKEMA.siklusModul(modul)[ada[0].status].length === 0) {
        return res.status(409).json({ error: `Dokumen berstatus “${labelDari(modul, ada[0].status)}” sudah dikunci.` });
      }
      if (['final', 'tayang', 'menang', 'berlaku'].includes(ada[0].status)) {
        return res.status(409).json({ error: `Dokumen berstatus “${labelDari(modul, ada[0].status)}” terkunci. Kembalikan satu langkah dulu bila perlu perbaikan.` });
      }
      if (ada[0].status === 'arsip') return res.status(409).json({ error: 'Dokumen sudah diarsipkan dan tidak bisa diubah.' });
      const { salah, data } = validasi(skema, { ...ada[0].data, ...(req.body || {}) });
      if (salah.length) return res.status(400).json({ error: salah[0], rincian: salah });
      const judul = judulDari(skema, data);
      const { rows } = await q(`UPDATE modul_rekam SET data=$1, judul=$2, diubah_at=now() WHERE id=$3
        RETURNING id, nomor, judul, status, data, diubah_at`, [data, judul, id]);
      await q(`INSERT INTO modul_riwayat (rekam_id, modul, aksi, perubahan, oleh) VALUES ($1,$2,'ubah',$3,$4)`,
        [id, modul, JSON.stringify(req.body || {}), pelaku(req)]).catch(() => {});
      await audit(`Modul ${modul}: dokumen ${ada[0].nomor} diubah oleh ${nama(req)}`, nama(req));
      res.json({ ok: true, dokumen: rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- ubah status ---------- */
  app.post('/api/newsroom/modul/:modul/:id/status', requireAuth, (req, res, next) => gerbang(req.params.modul)(req, res, next), idSah, async (req, res) => {
    try {
      if (!(await cekTabel())) return pesanMigrasi(res);
      const modul = req.params.modul, id = Number(req.params.id);
      const tujuan = bersih((req.body || {}).status);
      const { rows } = await q('SELECT id, nomor, judul, status FROM modul_rekam WHERE id=$1 AND modul=$2', [id, modul]);
      if (!rows.length) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
      const dari = rows[0].status;
      const alur = SKEMA.siklusModul(modul);
      const lab = SKEMA.labelModul(modul);
      if (!alur[dari] || !alur[dari].includes(tujuan)) {
        const boleh = (alur[dari] || []).map(x => lab[x] || x).join(', ') || 'tidak ada';
        return res.status(409).json({ error: `Perpindahan ${lab[dari] || dari} → ${lab[tujuan] || tujuan} tidak sah. Dari status ini hanya bisa ke: ${boleh}.` });
      }
      /* wewenang: status puncak (tayang/final/menang/aktif/berlaku) hanya penyetuju */
      if (SKEMA.butuhSetuju(modul, tujuan) && !RBAC.boleh(req.user.role, 'setujui')) {
        return res.status(403).json({ error: `Status “${lab[tujuan] || tujuan}” hanya bisa diberikan oleh pemimpin redaksi/direksi/administrator.` });
      }
      const kolom = tujuan === 'diperiksa' ? ', diperiksa_oleh=$3' : tujuan === 'disetujui' ? ', disetujui_oleh=$3' : '';
      const args = kolom ? [tujuan, id, pelaku(req)] : [tujuan, id];
      await q(`UPDATE modul_rekam SET status=$1, diubah_at=now()${kolom} WHERE id=$2`, args);
      await q(`INSERT INTO modul_riwayat (rekam_id, modul, aksi, status_lama, status_baru, oleh)
        VALUES ($1,$2,'status',$3,$4,$5)`, [id, modul, dari, tujuan, pelaku(req)]).catch(() => {});
      await audit(`Modul ${modul}: ${rows[0].nomor} → ${SKEMA.labelModul(modul)[tujuan] || tujuan} oleh ${nama(req)}`, nama(req));
      res.json({ ok: true, id, status: tujuan, status_label: SKEMA.labelModul(modul)[tujuan] || tujuan });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- arsipkan (tidak menghapus) ---------- */
  app.delete('/api/newsroom/modul/:modul/:id', requireAuth, (req, res, next) => gerbang(req.params.modul)(req, res, next), idSah, async (req, res) => {
    try {
      if (!(await cekTabel())) return pesanMigrasi(res);
      const modul = req.params.modul, id = Number(req.params.id);
      const { rows } = await q('SELECT id, nomor, status FROM modul_rekam WHERE id=$1 AND modul=$2', [id, modul]);
      if (!rows.length) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
      if (['final', 'tayang', 'menang', 'berlaku'].includes(rows[0].status) && !RBAC.boleh(req.user.role, 'setujui')) {
        return res.status(403).json({ error: 'Dokumen final hanya bisa diarsipkan oleh penyetuju.' });
      }
      await q(`UPDATE modul_rekam SET status='arsip', diubah_at=now() WHERE id=$1`, [id]);
      await q(`INSERT INTO modul_riwayat (rekam_id, modul, aksi, status_lama, status_baru, oleh)
        VALUES ($1,$2,'arsip',$3,'arsip',$4)`, [id, modul, rows[0].status, pelaku(req)]).catch(() => {});
      await audit(`Modul ${modul}: ${rows[0].nomor} diarsipkan oleh ${nama(req)} (bukan dihapus — masa simpan UU KUP 10 tahun)`, nama(req));
      res.json({ ok: true, id, status: 'arsip', catatan: 'Dokumen diarsipkan, bukan dihapus. Pemulihan bisa dilakukan administrator.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- riwayat ---------- */
  app.get('/api/newsroom/modul/:modul/:id/riwayat', requireAuth, (req, res, next) => gerbang(req.params.modul)(req, res, next), idSah, async (req, res) => {
    try {
      if (!(await cekTabel())) return pesanMigrasi(res);
      const { rows } = await q(`SELECT aksi, status_lama, status_baru, perubahan, oleh, at
        FROM modul_riwayat WHERE rekam_id=$1 ORDER BY id ASC`, [Number(req.params.id)]);
      res.json({ riwayat: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- data cetak (dokumen resmi) ---------- */
  app.get('/api/newsroom/modul/:modul/:id/cetak', requireAuth, (req, res, next) => gerbang(req.params.modul)(req, res, next), idSah, async (req, res) => {
    try {
      if (!(await cekTabel())) return pesanMigrasi(res);
      const modul = req.params.modul;
      const { rows } = await q('SELECT * FROM modul_rekam WHERE id=$1 AND modul=$2', [Number(req.params.id), modul]);
      if (!rows.length) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
      const skema = SKEMA.ambil(modul);
      const d = rows[0];
      const nilai = skema.field.map(f => {
        let v = d.data[f.kunci];
        if (Array.isArray(v)) v = v.map(x => (f.opsi || []).find(o => o.nilai === x)?.label || x).join(', ');
        else if (f.jenis === 'pilih' && v) v = (f.opsi || []).find(o => o.nilai === v)?.label || v;
        else if (f.jenis === 'centang') v = v ? 'Ya' : 'Tidak';
        else if (f.jenis === 'uang' && v != null) v = 'Rp ' + Number(v).toLocaleString('id-ID');
        return { label: f.label, nilai: v == null || v === '' ? '—' : v, jenis: f.jenis, acuan: f.acuan || '' };
      });
      const acuan = [...new Set(skema.field.map(f => f.acuan).filter(Boolean))];
      await q(`INSERT INTO modul_riwayat (rekam_id, modul, aksi, oleh) VALUES ($1,$2,'cetak',$3)`, [d.id, modul, pelaku(req)]).catch(() => {});
      res.json({
        dokumen: { id: d.id, nomor: d.nomor, judul: d.judul, status: d.status, status_label: (SKEMA.labelModul(modul)[d.status] || d.status),
          dibuat_oleh: d.dibuat_oleh, dibuat_at: d.dibuat_at, diperiksa_oleh: d.diperiksa_oleh, disetujui_oleh: d.disetujui_oleh },
        modul: { kunci: modul, judul: skema.judul, prefiks: skema.prefiks },
        field: nilai, acuan,
        perusahaan: {
          nama: 'MBC INDONESIA GROUP', unit: 'MBCINDONESIA.TV',
          alamat: 'Kediri, Jawa Timur', npwp: '—',
          catatan: 'Dokumen ini dihasilkan sistem Newsroom MBC Indonesia dan sah tanpa tanda tangan basah bila dicetak dari akun berwenang.'
        }
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* tabel tersedia dicatat saat pertama kali diakses */
  cekTabel().catch(() => {});
};
