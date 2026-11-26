#!/usr/bin/env node
/* ============================================================
   ops/sinkron-artikel.js — 1.6.4
   Tujuan: menu "Artikel" (dan panel modul) tidak lagi kosong.
   Menyalin isi tabel lama `articles` ke `modul_rekam` modul='articles'
   memakai siklus status yang dipakai tab UI.

   Pakai:
     node ops/sinkron-artikel.js            # impor artikel -> panel modul
     node ops/sinkron-artikel.js --bersih   # hapus dokumen & temuan uji
     node ops/sinkron-artikel.js --cek      # hanya laporkan, tak mengubah
   Aman dijalankan berulang (idempoten lewat kolom nomor).
   ============================================================ */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 2
});

const q = (sql, p) => pool.query(sql, p);

/* status lama (CMS articles) -> status siklus modul 'articles' */
const PETA = {
  ide: 'ide',
  riset: 'riset',
  fakta: 'riset',        // fakta = artikel di tahap pengecekan fakta
  penulisan: 'penulisan',
  draft: 'penulisan',    // draft = sedang ditulis
  review: 'review',
  siap: 'siap',
  tayang: 'tayang',
  tarik: 'tarik',
  arsip: 'arsip'
};

const KANAL = ['nasional', 'hukum', 'ekonomi', 'politik', 'daerah', 'olahraga', 'hiburan', 'teknologi', 'kesehatan', 'pendidikan'];

function kanalDari(art) {
  if (art.channel_id && KANAL.includes(art.channel_id)) return art.channel_id;
  const t = (art.tags || []).join(' ').toLowerCase();
  if (/ekonomi|upah|pasar|investasi|harga/.test(t)) return 'ekonomi';
  if (/politik|dpr|pilkada|pemilu/.test(t)) return 'politik';
  if (/hukum|hukum|kasus|pengadilan|polisi/.test(t)) return 'hukum';
  if (/teknologi|digital|ai|aplikasi/.test(t)) return 'teknologi';
  if (/pendidikan|sekolah|kampus|kuliah/.test(t)) return 'pendidikan';
  return 'daerah';
}

const tanggal = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);

function tahun(v) {
  return (v ? new Date(v) : new Date()).getFullYear();
}

async function siapkanTabel() {
  /* tabel sudah dibuat lewat docs/MIGRASI-1.6.2.sql; akun mbc_app bukan owner
     sehingga tidak boleh CREATE. Kita hanya memastikan tabelnya ada. */
  const { rows } = await q(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('modul_rekam','modul_riwayat')`);
  if (rows.length < 2) {
    throw new Error('Tabel modul belum ada. Jalankan docs/MIGRASI-1.6.2.sql di Supabase SQL Editor.');
  }
}

async function impor(cekSaja) {
  await siapkanTabel();
  const { rows: art } = await q(`SELECT id, slug, title, deck, body, channel_id, author_email, editor_email,
      status, priority, tags, hero_image, sources, published_at, scheduled_at, created_at, updated_at,
      word_count, read_time_min, views
      FROM articles ORDER BY id`);

  let baru = 0, lewat = 0;
  for (const a of art) {
    const nomor = `ART/${String(a.id).padStart(4, '0')}/${tahun(a.created_at)}`;
    const sudah = await q('SELECT id FROM modul_rekam WHERE modul=$1 AND nomor=$2', ['articles', nomor]);
    if (sudah.rows.length) { lewat++; continue; }

    const st = PETA[a.status] || 'ide';
    const data = {
      jenis: 'berita',
      kanal: kanalDari(a),
      editorial_jenis: 'berita',
      prioritas: ['breaking', 'tinggi', 'normal', 'rendah'].includes(a.priority) ? a.priority : 'normal',
      bahasa: 'id',
      judul_artikel: a.title,
      dek: a.deck || '',
      slug: a.slug,
      isi: a.body || '-',
      ringkasan: (a.deck || a.title || '').slice(0, 400),
      penulis: a.author_email || 'redaksi@mbcindonesia.tv',
      redaktur: a.editor_email || '',
      tag: a.tags || [],
      media_utama: a.hero_image || '',
      tayang: tanggal(a.published_at),
      jam_tayang: a.published_at ? new Date(a.published_at).toISOString().slice(11, 16) : '',
      sumber_utama: (Array.isArray(a.sources) && a.sources[0]) || 'Redaksi MBC',
      catatan_redaktur: 'Disalin otomatis dari arsip CMS lama (sinkron 1.6.4).',
      status_perpus: a.status,
      jumlah_kata: a.word_count || 0,
      dibaca_menit: a.read_time_min || 0,
      dilihat: a.views || 0
    };

    if (cekSaja) { console.log(`  [cek] ${nomor} | ${a.status} -> ${st} | ${a.title.slice(0, 50)}`); continue; }

    const ins = await q(`INSERT INTO modul_rekam (modul, nomor, judul, status, data, dibuat_oleh, dibuat_at, diubah_at)
      VALUES ('articles',$1,$2,$3,$4,$5,$6,$6) RETURNING id`,
      [nomor, a.title.slice(0, 200), st, data, a.author_email || 'sinkron', a.created_at || new Date()]);
    await q(`INSERT INTO modul_riwayat (rekam_id, modul, aksi, status_lama, status_baru, perubahan, oleh)
      VALUES ($1,'articles','impor',$2,$3,$4,'sinkron-artikel')`,
      [ins.rows[0].id, a.status, st, { dari: 'articles', id: a.id }]);
    baru++;
    console.log(`  + ${nomor} | ${a.status} -> ${st} | ${a.title.slice(0, 50)}`);
  }
  /* Penting 1.6.4: impor memakai nomor sendiri (ART/0001/2026, dst.) sehingga
     penghitung resmi harus diselaraskan. Tanpa ini, dokumen BARU dari CMS akan
     mendapat nomor yang sudah dipakai -> nomor kembar. */
  if (!cekSaja && baru > 0) {
    const u = await q(`UPDATE modul_nomor mn SET urut = x.maks
      FROM (SELECT modul,
                   MAX(NULLIF(regexp_replace(nomor,'^[^/]+/(\\d+)/.*$','\\1'),'')::int) AS maks
            FROM modul_rekam WHERE nomor IS NOT NULL GROUP BY modul) x
      WHERE mn.modul = x.modul AND x.maks IS NOT NULL AND mn.urut < x.maks
      RETURNING mn.modul, mn.urut`);
    if (u.rowCount) console.log('Penghitung nomor diselaraskan: ' + u.rows.map(r => `${r.modul} -> ${r.urut}`).join(', '));
  }
  console.log(`\nSelesai: ${baru} artikel disalin, ${lewat} sudah ada (dilewati).`);
  const r = await q(`SELECT status, count(*)::int n FROM modul_rekam WHERE modul='articles' GROUP BY 1 ORDER BY 2 DESC`);
  console.log('Sebaran status panel Artikel:', r.rows.map(x => `${x.status}=${x.n}`).join(', '));
}

async function bersih() {
  const ujiRekam = await q(`DELETE FROM modul_rekam WHERE judul ILIKE 'UJI %' OR judul ILIKE '%UJI TAB%' RETURNING id, judul`);
  const ujiTemuan = await q(`DELETE FROM ai_findings WHERE title ILIKE '%uji%' OR title ILIKE '%sesi%' RETURNING id, title`);
  console.log(`Dokumen uji dihapus: ${ujiRekam.rowCount} ${ujiRekam.rows.map(r => `#${r.id} ${r.judul}`).join(', ')}`);
  console.log(`Temuan AI uji dihapus: ${ujiTemuan.rowCount} ${ujiTemuan.rows.map(r => `#${r.id} ${r.title}`).join(', ')}`);
  const sisa = await q(`SELECT modul, status, count(*)::int n FROM modul_rekam GROUP BY 1,2 ORDER BY 1,2`);
  console.log('Isi modul_rekam sekarang:', sisa.rows.map(r => `${r.modul}/${r.status}=${r.n}`).join(', ') || '(kosong)');
}

(async () => {
  const arg = process.argv[2] || '';
  try {
    if (arg === '--bersih') await bersih();
    else await impor(arg === '--cek');
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('GAGAL:', e.message);
    process.exit(1);
  }
})();
