#!/usr/bin/env node
/* ============================================================
   ops/ganti-sandi.js — 1.6.4
   Mengganti sandi staf dari "demo123" menjadi sandi acak yang kuat,
   lalu menuliskan sandi itu ke berkas SANDSI-BARU.txt (hak 600).

   Pakai:
     node ops/ganti-sandi.js --contoh   # buat sandi kuat, TULIS ke layar+berkas, JANGAN ubah DB
     node ops/ganti-sandi.js --terapkan # benar-benar mengganti di database
   Sandi hanya diubah bila sudah diterapkan; berkas berisi sandi mentah —
   simpan di tempat aman, jangan diunggah ke GitHub.
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, max: 2 });

/* sandi kuat yang masih bisa diketik ulang tanpa salah:
   4 kelompok kata Indonesia + 4 angka + 1 tanda. 15 karakter, mudah dibaca. */
const KATA = ['Kopi', 'Brantas', 'Kediri', 'Siaran', 'Redaksi', 'Kelud', 'Wilwatikta', 'Tembakau',
  'Gedeg', 'Pare', 'Ngadiluwih', 'Kertosono', 'Wilis', 'Semeru', 'Jagung', 'Tebu'];

function sandiAcak() {
  const ambil = () => KATA[crypto.randomInt(KATA.length)];
  const kata = new Set();
  while (kata.size < 3) kata.add(ambil());
  const angka = String(crypto.randomInt(1000, 9999));
  const tanda = '!#$%&*?@'[crypto.randomInt(9)];
  return [...kata].join('-') + angka + tanda;
}

(async () => {
  const terapkan = process.argv.includes('--terapkan');
  try {
    const { rows } = await pool.query('SELECT id, name, email, role, pass_hash FROM users ORDER BY id');
    const hasil = [];
    for (const u of rows) {
      const samaDemo = await bcrypt.compare('demo123', u.pass_hash).catch(() => false);
      if (!samaDemo) { hasil.push({ ...u, sandi: null, catatan: 'sandi sudah bukan demo123' }); continue; }
      const sandi = sandiAcak();
      if (terapkan) {
        const hash = await bcrypt.hash(sandi, 12);
        await pool.query('UPDATE users SET pass_hash=$1 WHERE id=$2', [hash, u.id]);
      }
      hasil.push({ ...u, sandi, catatan: terapkan ? 'DIGANTI di database' : 'belum diterapkan' });
    }

    const baris = hasil.map(u => `${u.name} | ${u.email} | ${u.role} | ${u.sandi || '(tetap)'} | ${u.catatan}`);
    console.log('\n=== DAFTAR SANDI STAF ===');
    console.log(baris.join('\n'));
    const belum = hasil.filter(u => u.sandi).length;
    console.log(`\nTotal akun: ${hasil.length}; masih memakai demo123: ${belum}; mode: ${terapkan ? 'DITERAPKAN' : 'contoh (belum diubah di DB)'}`);

    /* sengaja di luar folder proyek supaya tidak ikut snapshot repo/paket unggah */
  const berkas = process.env.BERKAS_SANDI || path.join(__dirname, '..', '..', 'SANDI-BARU.txt');
    const isi = [
      'SANDI BARU STAF MBC INDONESIA TV',
      'Dibuat: ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      'Status: ' + (terapkan ? 'SUDAH diterapkan di database' : 'BELUM diterapkan (hanya contoh)'),
      '',
      ...baris,
      '',
      'PENTING: berkas ini memuat sandi mentah. Jangan diunggah ke GitHub / Vercel.',
      'Setelah semua staf mencatat sandinya, hapus berkas ini.'
    ].join('\n');
    fs.writeFileSync(berkas, isi, { mode: 0o600 });
    console.log('Ditulis ke:', berkas);
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('GAGAL:', e.message);
    process.exit(1);
  }
})();
