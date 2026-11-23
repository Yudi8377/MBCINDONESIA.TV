#!/usr/bin/env node
/**
 * ops/audit-akun.js — cek & bersihkan akun demo sebelum go-live (gerbang 10).
 *
 *   node ops/audit-akun.js                 # LAPORAN: akun mana yang masih memakai sandi demo
 *   node ops/audit-akun.js --ganti         # ganti sandi akun demo dengan sandi acak yang kuat
 *   node ops/audit-akun.js --ganti --nonaktifkan
 *
 * --ganti menulis kredensial baru ke berkas `KREDENSIAL-BARU-<stamp>.txt` (mode 600) dan
 * TIDAK mencetak sandi ke layar/log, supaya tidak bocor di riwayat terminal atau CI.
 * Berkas itu WAJIB dihapus/dipindahkan ke password manager setelah dibagikan ke staf.
 *
 * Aman: hanya menyentuh tabel `users`; tidak menghapus akun (kecuali --nonaktifkan diminta,
 * dan itu pun hanya menandai, bukan menghapus, agar jejak audit tetap utuh).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', 'server');
require(path.join(ROOT, 'node_modules', 'dotenv')).config({ path: path.join(ROOT, '.env') });
const { Pool } = require(path.join(ROOT, 'node_modules', 'pg'));
const bcrypt = require(path.join(ROOT, 'node_modules', 'bcryptjs'));

const URL_TARGET = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!URL_TARGET) { console.error('❌ SUPABASE_DB_URL / DATABASE_URL belum diisi'); process.exit(1); }

const GANTI = process.argv.includes('--ganti');
const NONAKTIF = process.argv.includes('--nonaktifkan');
const SANDI_DEMO = (process.env.SANDI_DEMO || 'demo123').split(',');

const pool = new Pool({
  connectionString: URL_TARGET, max: 2,
  ssl: /localhost|127\.0\.0\.1/.test(URL_TARGET) ? false : { rejectUnauthorized: false }
});

/* Sandi kuat & mudah diketik: 4 blok kata acak + angka + simbol, ≥ 16 karakter. */
const KATA = ['bambu', 'cendana', 'gelombang', 'harimau', 'jambu', 'kenari', 'lontar', 'merapi',
  'nusa', 'ombak', 'pandan', 'rawon', 'sagu', 'tembaga', 'udang', 'wijaya', 'yodium', 'zaitun'];
function sandiKuat() {
  const p = () => KATA[crypto.randomInt(KATA.length)];
  const n = String(crypto.randomInt(100, 999));
  return `${p()}-${p()}${n}-${p()}-${p()}!`;
}

(async () => {
  const { rows } = await pool.query('SELECT id, email, name, role, role_label, pass_hash FROM users ORDER BY id');
  console.log(`target : ${new URL(URL_TARGET).hostname}`);
  console.log(`akun   : ${rows.length}\n`);

  const lemah = [];
  for (const u of rows) {
    let pakaiDemo = false;
    for (const s of SANDI_DEMO) {
      if (await bcrypt.compare(s, u.pass_hash)) { pakaiDemo = true; break; }
    }
    const label = pakaiDemo ? '⚠️  SANDI DEMO' : '✅ sandi sudah diganti';
    console.log(`  ${String(u.id).padStart(2)} ${u.email.padEnd(30)} ${u.role_label.padEnd(28)} ${label}`);
    if (pakaiDemo) lemah.push(u);
  }

  console.log(`\n${lemah.length ? '❌' : '✅'} ${lemah.length} dari ${rows.length} akun masih memakai sandi demo.`);
  if (!lemah.length) { await pool.end(); return; }
  if (!GANTI) {
    console.log('\nJalankan dengan --ganti untuk membuat sandi acak yang kuat bagi akun tersebut:');
    console.log('   node ops/audit-akun.js --ganti [--nonaktifkan]');
    await pool.end();
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const berkas = path.join(__dirname, '..', `KREDENSIAL-BARU-${stamp}.txt`);
  const baris = [
    `# Kredensial baru MBCINDONESIA.TV — dibuat ${new Date().toISOString()}`,
    '# SIMPAN DI PASSWORD MANAGER, LALU HAPUS BERKAS INI.',
    '# Sandi demo lama sudah tidak berlaku untuk akun di bawah.',
    ''
  ];
  for (const u of lemah) {
    const baru = sandiKuat();
    const hash = await bcrypt.hash(baru, 12);
    await pool.query('UPDATE users SET pass_hash=$1 WHERE id=$2', [hash, u.id]);
    baris.push(`${u.role_label}`);
    baris.push(`  email : ${u.email}`);
    baris.push(`  sandi : ${baru}`);
    baris.push('');
    console.log(`  🔑 ${u.email} → sandi baru dibuat (tidak ditampilkan di layar)`);
  }
  fs.writeFileSync(berkas, baris.join('\n'), { mode: 0o600 });

  if (NONAKTIF) {
    // Tidak menghapus: menandai lewat role_label agar jejak audit & FK tetap aman.
    const r = await pool.query(
      `UPDATE users SET role_label = role_label || ' (NONAKTIF)'
       WHERE email = ANY($1::text[]) AND role_label NOT LIKE '%NONAKTIF%' RETURNING email`,
      [lemah.map(u => u.email)]
    );
    console.log(`  🚫 ditandai nonaktif: ${r.rows.map(x => x.email).join(', ')}`);
  }

  console.log(`\n✅ selesai. Kredensial ditulis ke:\n   ${berkas}\n   (mode 600; pindahkan ke password manager lalu hapus)`);
  await pool.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
