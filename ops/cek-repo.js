#!/usr/bin/env node
/* ============================================================
   ops/cek-repo.js — 1.6.4
   Membandingkan ukuran berkas di GitHub dengan berkas di komputer.
   Kalau ukurannya berbeda, berarti versi di repo masih versi lama.
   Pakai: node ops/cek-repo.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = process.env.REPO_RAW || 'https://raw.githubusercontent.com/Yudi8377/MBCINDONESIA.TV/main';
const AKAR = path.join(__dirname, '..');

const BERKAS = [
  'server/db.js',
  'server/akun.js',
  'server/server.js',
  'server/newsroom-modul.js',
  'server/skema-modul.js',
  'server/skema-1.6.3.js',
  'server/newsroom/cms-modul.js', 'server/newsroom/cms.js',
  'server/newsroom/index.html',
  'website/assets/js/akun.js',
  'website/diagnosa-masuk.html',
  'ops/sinkron-artikel.js',
  'ops/ganti-sandi.js',
  'ops/cek-repo.js',
  'docs/PATCH-1.6.4-nomor-unik.sql'
];

(async () => {
  let sama = 0, beda = 0, hilang = 0;
  console.log('Membandingkan repo GitHub dengan berkas lokal…');
  console.log('(angka = jumlah BYTE; garis bawah = ' + 'garis bawah'.replace(/.*/, '-'.repeat(8)) + ')\n');
  console.log('status  repo      lokal     berkas');
  console.log('------  --------  --------  ------------------------------------');
  for (const f of BERKAS) {
    const jalur = path.join(AKAR, f);
    const lokal = fs.existsSync(jalur) ? fs.statSync(jalur).size : null;
    let repo = null, kode = 0;
    try {
      const r = await fetch(`${REPO}/${f}`);
      kode = r.status;
      /* jumlah BYTE, bukan panjang teks: berkas berisi emoji/aksen (é, ·) sehingga
         panjang karakter lebih kecil dari ukuran byte — dulu ini membuat berkas yang
         sudah benar tetap dilaporkan BEDA. */
      if (r.ok) repo = Buffer.byteLength(await r.text(), 'utf8');
    } catch (_) { kode = -1; }
    let status;
    if (kode === 404) { status = 'HILANG'; hilang++; }
    else if (kode !== 200) { status = 'GAGAL'; beda++; }
    else if (lokal != null && repo === lokal) { status = 'SAMA  '; sama++; }
    else { status = 'BEDA  '; beda++; }
    console.log(`${status}  ${String(repo ?? '-').padEnd(8)}  ${String(lokal ?? '-').padEnd(8)}  ${f}`);
    await new Promise(r => setTimeout(r, 120)); /* sopan ke GitHub */
  }
  console.log('\nRingkasan: ' + sama + ' sama · ' + beda + ' beda · ' + hilang + ' belum ada di repo');
  if (beda || hilang) {
    console.log('\nBerkas bertanda BEDA/HILANG masih versi lama di repo.');
    console.log('Jalankan: python3 ops/push-isi.py   (lihat dulu apa yang akan diubah)');
    console.log('lalu   : python3 ops/push-isi.py --kirim   (kirim ke GitHub).');
    console.log('Lihat juga CARA-PASANG-MANUAL.md.');
    process.exitCode = 1;
  } else {
    console.log('\nSemua berkas di repo sudah sama dengan versi terbaru. Deploy ulang di Vercel.');
  }
})();
