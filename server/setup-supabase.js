#!/usr/bin/env node
/* ============================================================
   setup-supabase.js — siapkan database Supabase untuk MBCINDONESIA.TV
   ------------------------------------------------------------
   Menjalankan: schema.sql → cms-schema.sql → seed.js → cms-seed.js
   lalu memeriksa jumlah tabel & akun peran.

   Pakai:
     SUPABASE_DB_URL="postgresql://postgres.<ref>:<sandi>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
       node setup-supabase.js

   Aman diulang (idempotent). Tidak menyimpan kredensial ke disk.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pool, dbInfo } = require('./db');

const FILES = ['schema.sql', 'cms-schema.sql'];
const SEEDS = ['seed.js', 'cms-seed.js'];

async function psqlAvailable() {
  try { execFileSync('psql', ['--version'], { stdio: 'ignore' }); return true; } catch (_) { return false; }
}

/* Jalankan SQL tanpa psql: pisahkan per pernyataan menggunakan parser sederhana
   (mendukung dollar-quoted $$ ... $$ yang dipakai fungsi/trigger). */
function splitSql(sql) {
  const out = []; let buf = ''; let i = 0; let dollar = false;
  while (i < sql.length) {
    const ch = sql[i];
    if (!dollar && ch === '$' && sql[i + 1] === '$') { dollar = true; buf += '$$'; i += 2; continue; }
    if (dollar && ch === '$' && sql[i + 1] === '$') { dollar = false; buf += '$$'; i += 2; continue; }
    if (!dollar && ch === ';') { out.push(buf); buf = ''; i++; continue; }
    buf += ch; i++;
  }
  if (buf.trim()) out.push(buf);
  return out.map(s => s.trim()).filter(s => s && !/^--/.test(s));
}

async function runSqlFile(file) {
  const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const stmts = splitSql(sql);
  const client = await pool.connect();
  try {
    for (const st of stmts) {
      try { await client.query(st); }
      catch (e) {
        if (/already exists|duplicate object/i.test(e.message)) continue; // idempotent
        throw new Error(`${file}: ${e.message}\n→ ${st.slice(0, 160)}`);
      }
    }
  } finally { client.release(); }
  console.log(`   ✓ ${file} (${stmts.length} pernyataan)`);
}

(async () => {
  console.log(`== Supabase setup · ${dbInfo.provider} · host ${dbInfo.host} · db ${dbInfo.database}`);
  if (dbInfo.provider !== 'supabase') console.log('   ⚠️  Host bukan Supabase — pastikan SUPABASE_DB_URL sudah benar.');
  try { await pool.query('SELECT 1'); console.log(`   ✓ koneksi database berhasil${dbInfo.ssl ? ' (TLS)' : ''}`); }
  catch (e) {
    console.error('   ✗ gagal konek:', e.message);
    console.error('     Periksa: host pooler, user "postgres.<ref>", sandi, dan sslmode=require.');
    process.exit(1);
  }

  const usePsql = await psqlAvailable();
  console.log(`== Memuat skema (${usePsql ? 'psql' : 'driver pg'})`);
  for (const f of FILES) {
    if (usePsql) {
      const u = new URL(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
        || 'postgres://mbc:mbc_dev_password@127.0.0.1:5432/mbctv');
      execFileSync('psql', ['-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username),
        '-d', u.pathname.slice(1) || 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', path.join(__dirname, f)],
        { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) } });
      console.log(`   ✓ ${f} (psql)`);
    } else await runSqlFile(f);
  }

  console.log('== Mengisi data awal');
  for (const s of SEEDS) {
    execFileSync(process.execPath, [path.join(__dirname, s)], { stdio: 'inherit', env: process.env });
  }

  const t = await pool.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`);
  const u = await pool.query(`SELECT role, count(*)::int AS n FROM users GROUP BY role ORDER BY role`);
  const a = await pool.query(`SELECT count(*)::int AS n FROM articles`).catch(() => ({ rows: [{ n: 0 }] }));
  console.log(`\n✅ Selesai. ${t.rows[0].n} tabel publik · ${a.rows[0].n} artikel CMS · akun: ${u.rows.map(r => r.role + '=' + r.n).join(', ')}`);
  console.log('   Langkah berikutnya: simpan SUPABASE_DB_URL + JWT_SECRET di environment produksi, lalu restart server.');
  await pool.end();
})().catch(e => { console.error('✗ GAGAL:', e.message); process.exit(1); });
