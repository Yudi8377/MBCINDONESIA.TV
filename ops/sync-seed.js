#!/usr/bin/env node
/**
 * sync-seed.js — salin tabel referensi dari DB LOKAL (bersih) ke DB target (Supabase).
 *
 * Aman & idempoten: tiap tabel dikosongkan (DELETE) lalu diisi ulang dari sumber, dalam satu
 * transaksi per tabel. Gunanya: memulihkan data demo/produksi awal tanpa menyentuh
 * struktur (DDL) dan tanpa menebak isi.
 *
 * Pakai:
 *   node ops/sync-seed.js                       # pratinjau (dry-run), tidak menulis
 *   node ops/sync-seed.js --tulis               # benar-benar menulis ke target
 *   SOURCE_DB_URL=... TARGET_DB_URL=... node ops/sync-seed.js --tulis
 *
 * Default:
 *   SOURCE = postgres://mbc:mbc_dev_password@127.0.0.1:5432/mbctv_seed
 *   TARGET = SUPABASE_DB_URL (server/.env)
 */
'use strict';
const path = require('path');
const { Pool } = require(path.join(__dirname, '..', 'server', 'node_modules', 'pg'));

const TULIS = process.argv.includes('--tulis');
const SOURCE = process.env.SOURCE_DB_URL || 'postgres://mbc:mbc_dev_password@127.0.0.1:5432/mbctv_seed';

require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv'))
  .config({ path: path.join(__dirname, '..', 'server', '.env') });
const TARGET = process.env.TARGET_DB_URL || process.env.SUPABASE_DB_URL;

// Urutan penting: induk lebih dulu (FK), anak belakangan.
const TABEL = [
  'programs', 'channels', 'tags', 'users', 'staff',
  'episodes', 'articles',
  'article_revisions', 'editorial_notes', 'editorial_approvals', 'editorial_tasks',
  'content_analytics', 'media_assets',
  'ai_agents', 'ai_runs', 'ai_findings', 'agent_jobs',
  'comments', 'comment_moderation',
  'crm_deals', 'ad_slots', 'campaigns', 'invoices', 'approvals',
  'master_items', 'production_projects', 'audit_log', 'newsletter_subscribers'
];

if (!TARGET) { console.error('❌ TARGET kosong — set SUPABASE_DB_URL atau TARGET_DB_URL'); process.exit(1); }
if (TARGET === SOURCE) { console.error('❌ Sumber dan target sama. Dibatalkan.'); process.exit(1); }

const src = new Pool({ connectionString: SOURCE, max: 2 });
const dst = new Pool({ connectionString: TARGET, max: 2, ssl: /localhost|127\.0\.0\.1/.test(TARGET) ? false : { rejectUnauthorized: false } });

const q = (c, s, p) => c.query(s, p);

(async () => {
  const hostT = (() => { try { return new URL(TARGET).hostname; } catch { return '?'; } })();
  const hostS = (() => { try { return new URL(SOURCE).hostname; } catch { return '?'; } })();
  console.log(`sumber : ${hostS}`);
  console.log(`target : ${hostT}`);
  console.log(`mode   : ${TULIS ? 'TULIS (truncate + insert)' : 'PRATINJAU (dry-run)'}\n`);

  let totalBaris = 0;
  for (const t of TABEL) {
    let rows;
    try {
      rows = (await q(src, `SELECT * FROM ${t}`)).rows;
    } catch (e) { console.log(`– ${t.padEnd(22)} dilewati (tidak ada di sumber: ${e.code || e.message})`); continue; }
    if (!rows.length) { console.log(`– ${t.padEnd(22)} kosong di sumber, dilewati`); continue; }

    const kol = Object.keys(rows[0]);
    // Tipe kolom di TARGET: sumber lokal bisa beda tipe (json vs jsonb, text[] vs jsonb),
    // jadi nilai diserialisasi sesuai tipe tujuan lalu di-cast eksplisit.
    const tipe = {};
    for (const r of (await q(dst, `SELECT column_name, data_type, udt_name FROM information_schema.columns
                                 WHERE table_schema='public' AND table_name=$1`, [t])).rows) {
      tipe[r.column_name] = r.data_type === 'ARRAY' ? r.udt_name : r.data_type;
    }
    const siapkan = (v, k) => {
      const t = tipe[k];
      if (v === null || v === undefined) return null;
      if (t === '_text') return Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v) : [String(v)]);
      if (t === 'jsonb' || t === 'json') return typeof v === 'string' ? v : JSON.stringify(v);
      return v;
    };
    const kolSql = kol.map(k => `"${k}"`).join(', ');
    console.log(`+ ${t.padEnd(22)} ${String(rows.length).padStart(4)} baris, ${kol.length} kolom`);

    if (!TULIS) { totalBaris += rows.length; continue; }

    const cli = await dst.connect();
    try {
      await cli.query('BEGIN');
      // DELETE, bukan TRUNCATE: role aplikasi (mbc_app) sengaja tidak diberi hak TRUNCATE.
      // Urutan tabel di atas sudah induk→anak sehingga FK tidak dilanggar.
      await cli.query(`DELETE FROM ${t}`);
      // INSERT berkelompok agar cepat & aman
      const PER = 200;
      for (let i = 0; i < rows.length; i += PER) {
        const bagian = rows.slice(i, i + PER);
        const params = [];
        const nilai = bagian.map((r, ri) => {
          const ph = kol.map((k, ki) => {
            params.push(siapkan(r[k], k));
            const t = tipe[k];
            const cast = t === '_text' ? '::text[]' : (t === 'jsonb' ? '::jsonb' : (t === 'json' ? '::json' : ''));
            return `$${ri * kol.length + ki + 1}${cast}`;
          });
          return '(' + ph.join(', ') + ')';
        });
        await cli.query(`INSERT INTO ${t} (${kolSql}) VALUES ${nilai.join(', ')}`, params);
      }
      // selaraskan sequence (penting: id eksplisit membuat sequence tertinggal)
      const seq = await cli.query(`SELECT pg_get_serial_sequence($1,'id') s`, [t]);
      if (seq.rows[0].s) {
        await cli.query(`SELECT setval($1, GREATEST((SELECT COALESCE(MAX(id),1) FROM ${t}),1))`, [seq.rows[0].s]);
      }
      await cli.query('COMMIT');
      totalBaris += rows.length;
    } catch (e) {
      await cli.query('ROLLBACK').catch(() => {});
      console.error(`   ❌ ${t}: ${e.message}`);
      cli.release();
      process.exitCode = 1;
      continue;
    }
    cli.release();
  }
  console.log(`\n${TULIS ? '✅ selesai' : 'ℹ️  pratinjau'}: ${totalBaris} baris ${TULIS ? 'disalin' : 'akan disalin'}`);
  await src.end(); await dst.end();
  if (process.exitCode) process.exit(process.exitCode);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
