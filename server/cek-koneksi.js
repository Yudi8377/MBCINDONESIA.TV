#!/usr/bin/env node
/**
 * cek-koneksi.js — uji satu connection string PostgreSQL/Supabase & beri diagnosis.
 *
 * Pakai:
 *   node cek-koneksi.js                       # baca SUPABASE_DB_URL / DATABASE_URL
 *   node cek-koneksi.js "postgresql://..."    # uji string tertentu
 *
 * Keluar 0 bila tersambung, 1 bila gagal.
 */
'use strict';

try { require('dotenv').config(); } catch {}   // baca server/.env bila ada

const url = process.argv[2] || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!url) {
  console.error('❌ Belum ada connection string.');
  console.error('   Buat server/.env berisi:  SUPABASE_DB_URL=postgresql://<user>.<ref>:<sandi>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres');
  console.error('   atau:  node cek-koneksi.js "postgresql://..."');
  process.exit(1);
}

// --- Ringkasan tanpa membocorkan sandi -------------------------------------
function ringkas(u) {
  try {
    const p = new URL(u);
    return {
      user: decodeURIComponent(p.username),
      host: p.hostname,
      port: p.port || '5432',
      db: p.pathname.replace(/^\//, '') || 'postgres',
      adaSandi: Boolean(p.password)
    };
  } catch {
    return null;
  }
}

const info = ringkas(url);
if (!info) {
  console.error('❌ Format connection string tidak valid (harus diawali postgresql://).');
  process.exit(1);
}

console.log('── Yang akan diuji ─────────────────────────────');
console.log(`  user  : ${info.user}`);
console.log(`  host  : ${info.host}`);
console.log(`  port  : ${info.port}`);
console.log(`  db    : ${info.db}`);
console.log(`  sandi : ${info.adaSandi ? 'ada' : 'KOSONG ← isi [YOUR-DATABASE-PASSWORD]'}`);
console.log('────────────────────────────────────────────────');

// --- Petunjuk diagnosis ----------------------------------------------------
function diagnosa(pesan) {
  const m = String(pesan);
  const saran = [];
  if (/tenant\/user .* not found|no tenant identifier/i.test(m)) {
    saran.push('Nomor cluster pooler salah. Proyek ini memakai aws-1-ap-southeast-1, bukan aws-0.');
    saran.push('Salin ulang host dari dialog Connect → Session pooler (host TIDAK bisa ditebak dari region).');
  }
  if (/password authentication failed|28P01/i.test(m)) {
    saran.push('Sandi salah, atau ada karakter khusus (& # ? / spasi) yang belum di-percent-encode.');
    saran.push('Ambil/reset di Dashboard → Connect → Reset database password.');
  }
  if (/ENETUNREACH|EHOSTUNREACH|could not translate host name|getaddrinfo ENOTFOUND db\./i.test(m)) {
    saran.push('Anda memakai koneksi Direct (db.<ref>.supabase.co) yang hanya IPv6. Pakai Session pooler.');
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(m)) {
    saran.push('Jaringan/firewall memblokir port. Coba port 5432 (session) dari host pooler.');
  }
  if (/database .* does not exist|3D000/i.test(m)) {
    saran.push('Nama database harus "postgres" di Supabase.');
  }
  if (!saran.length) saran.push('Cek ulang user, host, port, dan sandi dari dialog Connect.');
  return saran;
}

// --- Uji koneksi -----------------------------------------------------------
process.env.SUPABASE_DB_URL = url;
let db;
try {
  db = require('./db');
} catch (e) {
  console.error('❌ Modul ./db tidak bisa dimuat:', e.message);
  process.exit(1);
}

(async () => {
  const { pool, dbInfo } = db;
  const t0 = Date.now();
  try {
    const r = await pool.query(
      `select current_database() db,
              current_user usr,
              (select count(*) from information_schema.tables
                where table_schema='public') tabel,
              (select count(*) from articles) artikel,
              (select count(*) from users) pengguna`
    );
    const w = r.rows[0];
    console.log('✅ TERSAMBUNG');
    console.log(`  waktu     : ${Date.now() - t0} ms`);
    console.log(`  database  : ${w.db} · user: ${w.usr}`);
    console.log(`  provider  : ${dbInfo.provider} · TLS: ${dbInfo.ssl} · pooler: ${dbInfo.pooler}`);
    console.log(`  isi       : ${w.tabel} tabel public · ${w.artikel} artikel · ${w.pengguna} akun`);
    if (dbInfo.provider !== 'supabase' && /supabase/.test(info.host)) {
      console.log('  ⚠️  host Supabase tapi provider terdeteksi lokal — periksa server/db.js');
    }
    await pool.end();
    console.log('\nLangkah berikutnya:  cd server && node server.js   lalu   curl localhost:8080/api/health');
    console.log('Health harus memuat: "provider":"supabase"  "tls":true  "pooler":true');
    process.exit(0);
  } catch (e) {
    console.error('❌ GAGAL:', e.message);
    console.error('\nKemungkinan penyebab & perbaikan:');
    diagnosa(e.message).forEach((s, i) => console.error(`  ${i + 1}. ${s}`));
    try { await pool.end(); } catch {}
    process.exit(1);
  }
})();
