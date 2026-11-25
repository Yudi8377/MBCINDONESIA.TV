/* Koneksi PostgreSQL — Supabase (produksi), Neon, atau lokal.
   Urutan: SUPABASE_DB_URL → DATABASE_URL → lokal dev.
   Supabase Pooler mewajibkan TLS: sslmode=require otomatis bila host supabase. */
'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const rawUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || 'postgres://mbc:mbc_dev_password@127.0.0.1:5432/mbctv';
/* Bersihkan parameter yang tidak dikenal driver pg (mis. ?pgbouncer=true) */
function toPgUrl(u) {
  try {
    const url = new URL(u);
    ['pgbouncer', 'supa', 'connection_limit', 'pool_mode'].forEach(k => url.searchParams.delete(k));
    return url.toString();
  } catch (_) { return u; }
}
const connectionString = toPgUrl(rawUrl);
const isRemote = /supabase\.(co|com|in)|neon\.tech|neon\.build|render\.com|railway|aws|azure|digitalocean|sslmode=require/.test(connectionString) || process.env.PGSSL === 'require';
const isSupabasePooler = /pooler\.supabase\.com/.test(connectionString);
/* Session pooler Supabase (:5432) menghitung satu klien per proses SELAMA koneksi
   terbuka, dan jatahnya hanya 15 untuk seluruh proyek. Serverless membuat banyak
   instance sekaligus, jadi jatah itu cepat habis ("max clients reached in session
   mode"). Karena itu di lingkungan serverless: klien per instance kecil dan
   koneksi menganggur cepat ditutup. Transaction pooler (:6543) tidak butuh
   penyesuaian ini, tetapi nilainya tetap aman untuknya. */
const SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_TARGET);
/* Port menentukan mode Supavisor:
   5432 = session mode (jatah 15 klien per proyek, dihitung per koneksi terbuka)
   6543 = transaction mode (koneksi dipinjam per transaksi, aman untuk serverless)
   Selama host masih pooler dan port masih 5432, seburuk apa pun kode ini,
   trafik nyata bisa menghabiskan 15 jatah itu dan memunculkan
   "(EMAXCONNSESSION) max clients reached in session mode". */
let modePooler = 'lain';
try {
  if (isSupabasePooler) modePooler = new URL(connectionString).port === '6543' ? 'transaction' : 'sesi';
} catch (_) { /* biarkan 'lain' */ }
if (isSupabasePooler && modePooler === 'sesi' && SERVERLESS) {
  console.warn('[pg] PERINGATAN: serverless memakai session pooler (:5432, jatah 15 klien). ' +
    'Ganti port SUPABASE_DB_URL ke 6543 (transaction pooler) agar login tidak gagal saat trafik naik.');
}
const batasKlien = Number(
  process.env.PG_POOL_MAX ||
  (isSupabasePooler ? (modePooler === 'sesi' ? 1 : (SERVERLESS ? 3 : 5)) : (SERVERLESS ? 2 : 10))
);

const pool = new Pool({
  connectionString,
  max: batasKlien,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT || 20000),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || (SERVERLESS ? 3000 : 30000)),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT || (SERVERLESS ? 10000 : 15000)),
  allowExitOnIdle: SERVERLESS,
  application_name: 'mbcindonesia-tv'
});

/* ---- Ketahanan terhadap pemutusan koneksi Supabase pooler ----
   Pooler menutup koneksi diam setelah idle. Koneksi mati itu masih ada di pool,
   sehingga satu permintaan bisa gagal (500/503) walau database sehat.
   Strategi: buang klien mati lewat event 'error', dan ulangi query sekali
   bila galatnya transien (jaringan atau kelas 08/57 PostgreSQL). */
pool.on('error', err => console.error('[pg] pool error:', err.message));

const TRANSIEN = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE',
  '57P01', '57P02', '57P03', '08000', '08001', '08003', '08006', '53300', 'XX000',
  'EMAXCONNSESSION']);   /* jatah sesi pooler penuh → tunggu sebentar, coba lagi */

const queryAsli = pool.query.bind(pool);
pool.query = async function (...args) {
  try {
    return await queryAsli(...args);
  } catch (e) {
    if (!TRANSIEN.has(e.code)) throw e;
    console.warn(`[pg] galat transien (${e.code}) — coba ulang dengan koneksi baru`);
    await new Promise(r => setTimeout(r, 350));
    return queryAsli(...args);
  }
};

/* Info koneksi tanpa membocorkan kata sandi */
const dbInfo = (() => {
  try {
    const u = new URL(connectionString);
    return { host: u.hostname, port: u.port || '5432', database: u.pathname.slice(1) || 'postgres', user: u.username,
      provider: /supabase/.test(u.hostname) ? 'supabase' : /neon/.test(u.hostname) ? 'neon' : 'lokal',
      pooler: isSupabasePooler, pooler_mode: modePooler, ssl: isRemote };
  } catch (_) { return { host: '?', port: '?', database: '?', provider: '?', pooler: false, pooler_mode: 'lain', ssl: isRemote }; }
})();

module.exports = { pool, dbInfo: { ...dbInfo, max_clients: batasKlien, serverless: SERVERLESS } };
