#!/usr/bin/env node
/* smoke.js — uji integrasi API end-to-end (tanpa browser).
   Prasyarat: database mbctv_ci sudah ada & postgres berjalan (lihat .github/workflows/ci.yml).
   Jalankan:  node scripts/smoke.js            (DATABASE_URL bisa di-override via env)
   Keluar 0 jika semua lulus, 1 jika ada yang gagal. */
'use strict';
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_URL = process.env.DATABASE_URL || 'postgres://mbc:mbc_dev_password@127.0.0.1:5432/mbctv_ci';
const PORT = Number(process.env.SMOKE_PORT || 8095);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SERVER = path.join(__dirname, '..', 'server.js');

/* ── PENGAMAN: jangan pernah menabrak database produksi ───────────────────────
   Insiden 22 Nov 2026: server uji memuat server/.env (SUPABASE_DB_URL) sehingga
   smoke test menulis ke database PRODUKSI. Sekarang:
     1) SUPABASE_DB_URL dihapus dari proses uji (dotenv tidak menimpanya).
     2) Host DB uji wajib lokal, kecuali SMOKE_ALLOW_REMOTE=1 diberikan sadar.
     3) Nama database wajib mengandung "ci"/"test" bila remote. */
delete process.env.SUPABASE_DB_URL;
const _u = new URL(DB_URL);
const _lokal = ['127.0.0.1', 'localhost', '::1', '/var/run'].some(h => _u.hostname === h || _u.hostname.startsWith('/'));
if (!_lokal) {
  if (process.env.SMOKE_ALLOW_REMOTE !== '1') {
    console.error('❌ DIBATALKAN: target uji bukan localhost (' + _u.hostname + ').');
    console.error('   Smoke test membuat & menghapus data. Jalankan di DB lokal: DATABASE_URL=postgres://…@127.0.0.1:5432/mbctv_ci');
    console.error('   Bila benar-benar ingin remote, set SMOKE_ALLOW_REMOTE=1 (db harus bernama *ci* / *test*).');
    process.exit(2);
  }
  if (!/(ci|test)/i.test(_u.pathname)) {
    console.error('❌ DIBATALKAN: DB remote "' + _u.pathname.slice(1) + '" tidak mengandung "ci"/"test".');
    process.exit(2);
  }
}

const log = [];
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); if (!cond) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('== smoke: siapkan schema + seed (mbctv_ci)');
  const PSQL = process.env.PSQL_BIN || (fs.existsSync('/usr/lib/postgresql/17/bin/psql') ? '/usr/lib/postgresql/17/bin/psql' : 'psql');
  const u = new URL(DB_URL);
  const pgEnv = { ...process.env, SUPABASE_DB_URL: '', PGPASSWORD: decodeURIComponent(u.password || '') };
  for (const f of ['schema.sql', 'cms-schema.sql']) {
    execSync(`"${PSQL}" -h ${u.hostname} -p ${u.port || 5432} -U ${decodeURIComponent(u.username)} -d ${u.pathname.slice(1)} -v ON_ERROR_STOP=1 -f "${path.join(__dirname, '..', f)}" >/dev/null`, { stdio: 'inherit', env: pgEnv });
  }
  const seedEnv = { ...process.env, SUPABASE_DB_URL: '', DATABASE_URL: DB_URL };
  execSync('node seed.js', { cwd: path.join(__dirname, '..'), env: seedEnv, stdio: 'inherit' });
  execSync('node cms-seed.js', { cwd: path.join(__dirname, '..'), env: seedEnv, stdio: 'inherit' });

  console.log('== smoke: jalankan server pada port', PORT);
  const srv = spawn('node', [SERVER], { env: { ...process.env, SUPABASE_DB_URL: '', DATABASE_URL: DB_URL, JWT_SECRET: 'smoke-test-secret', PORT: String(PORT), NODE_ENV: 'production' }, stdio: 'pipe' });
  srv.stdout.on('data', d => log.push(String(d)));
  srv.stderr.on('data', d => log.push(String(d)));

  // tunggu health ok (maks 15 dtk)
  let up = false;
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(ORIGIN + '/api/health'); if (r.ok) { up = true; break; } } catch (_) {}
    await wait(300);
  }
  if (!up) { console.error(log.join('')); srv.kill(); process.exit(1); }

  try {
    // health & statis
    const health = await (await fetch(ORIGIN + '/api/health')).json();
    ok('GET /api/health → db:true', health.db === true);
    const home = await fetch(ORIGIN + '/');
    ok('GET / → 200 & memuat MBC', home.status === 200 && (await home.text()).includes('MBC'));
    const nf = await fetch(ORIGIN + '/halaman-tidak-ada');
    ok('404 HTML untuk halaman publik', nf.status === 404);
    const nfApi = await fetch(ORIGIN + '/api/tidak-ada');
    ok('404 JSON untuk /api', nfApi.status === 404 && (await nfApi.json()).error != null);

    // auth
    const bad = await fetch(ORIGIN + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'direktur@mbcindonesia.tv', password: 'salah' }) });
    ok('login password salah → 401', bad.status === 401);
    const login = await fetch(ORIGIN + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'direktur@mbcindonesia.tv', password: 'demo123' }) });
    const loginData = await login.json();
    ok('login direktur → token', login.status === 200 && !!loginData.token);
    const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + loginData.token };

    // RBAC
    const noTok = await fetch(ORIGIN + '/api/metrics');
    ok('metrics tanpa token → 401', noTok.status === 401);
    const metrics = await (await fetch(ORIGIN + '/api/metrics', { headers: H })).json();
    ok('metrics direksi → programs=8', metrics.counts && metrics.counts.programs === 8);
    const salesTok = (await (await fetch(ORIGIN + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'sales@mbcindonesia.tv', password: 'demo123' }) })).json()).token;
    const csvSales = await fetch(ORIGIN + '/api/laporan/kpi.csv', { headers: { Authorization: 'Bearer ' + salesTok } });
    ok('sales akses CSV keuangan → 403', csvSales.status === 403);
    const csvDir = await fetch(ORIGIN + '/api/laporan/kpi.csv', { headers: H });
    ok('direksi akses CSV → 200 text/csv', csvDir.status === 200 && (csvDir.headers.get('content-type') || '').includes('csv'));

    // CRM lifecycle
    const created = await (await fetch(ORIGIN + '/api/crm/deals', { method: 'POST', headers: H, body: JSON.stringify({ company: 'PT Smoke CI', deal: 'Uji integrasi', value: 11 }) })).json();
    ok('CRM create deal', !!created.id);
    const mv = await fetch(`${ORIGIN}/api/crm/deals/${created.id}/stage`, { method: 'PATCH', headers: H, body: JSON.stringify({ stage: 'penawaran' }) });
    ok('CRM pindah tahap', mv.status === 200);
    const del = await fetch(`${ORIGIN}/api/crm/deals/${created.id}`, { method: 'DELETE', headers: H });
    ok('CRM hapus deal', del.status === 200);

    // Keamanan akun: ganti kata sandi sendiri (dipakai sebelum go-live untuk hapus demo123)
    const pwShort = await fetch(ORIGIN + '/api/auth/password', { method: 'POST', headers: H, body: JSON.stringify({ current: 'demo123', next: 'pendek' }) });
    ok('sandi baru < 10 karakter → 400', pwShort.status === 400);
    const pwDemo = await fetch(ORIGIN + '/api/auth/password', { method: 'POST', headers: H, body: JSON.stringify({ current: 'demo123', next: 'demo123' }) });
    ok('sandi baru = demo123 ditolak → 400', pwDemo.status === 400);
    const pwBad = await fetch(ORIGIN + '/api/auth/password', { method: 'POST', headers: H, body: JSON.stringify({ current: 'salah', next: 'RahasiaBaru2026!' }) });
    ok('sandi lama salah → 401', pwBad.status === 401);
    const pwOk = await fetch(ORIGIN + '/api/auth/password', { method: 'POST', headers: H, body: JSON.stringify({ current: 'demo123', next: 'RahasiaBaru2026!' }) });
    ok('ganti kata sandi valid → 200', pwOk.status === 200);
    const relogin = await fetch(ORIGIN + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'direktur@mbcindonesia.tv', password: 'RahasiaBaru2026!' }) });
    ok('login dengan sandi baru → 200', relogin.status === 200);
    const oldLogin = await fetch(ORIGIN + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'direktur@mbcindonesia.tv', password: 'demo123' }) });
    ok('login dengan sandi lama → 401', oldLogin.status === 401);

    // Profil: validasi email
    const profBad = await fetch(ORIGIN + '/api/auth/profile', { method: 'PATCH', headers: H, body: JSON.stringify({ name: 'Direktur Utama', email: 'bukan-email' }) });
    ok('profil dengan email tidak valid → 400', profBad.status === 400);
    const profDup = await fetch(ORIGIN + '/api/auth/profile', { method: 'PATCH', headers: H, body: JSON.stringify({ name: 'Direktur Utama', email: 'sales@mbcindonesia.tv' }) });
    ok('profil dengan email terpakai → 409', profDup.status === 409);

    // Approvals & newsletter & comments
    const appr = await fetch(ORIGIN + '/api/keuangan/approvals/PBJ-2026-037', { method: 'POST', headers: H, body: JSON.stringify({ action: 'reject' }) });
    ok('approval reject (bukan approve)', appr.status === 200);
    const nl = await fetch(ORIGIN + '/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'smoke-ci@example.com' }) });
    ok('newsletter subscribe', nl.status === 200 || nl.status === 201);
    const cm = await fetch(ORIGIN + '/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ program_id: 'jejak-nusantara', author: 'Smoke CI', body: 'Komentar uji integrasi' }) });
    ok('comment create', cm.status === 201);
    const list = await (await fetch(ORIGIN + '/api/comments?program_id=jejak-nusantara')).json();
    ok('comment list memuat komentar baru', (list.comments || []).some(c => c.body === 'Komentar uji integrasi'));
    const progs = await (await fetch(ORIGIN + '/api/programs')).json();
    ok('GET /api/programs → 8 program', (progs.programs || []).length === 8);
    ok('program punya deskripsi (desc tidak kosong)', (progs.programs || []).every(p => (p.desc || '').trim().length > 10));
    ok('program punya daftar episode', (progs.programs || []).every(p => Array.isArray(p.eps)));

    // ---------- NEWSROOM: RBAC, CMS, multi-agent AI ----------
    const salesTok2 = (await (await fetch(ORIGIN + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'sales@mbcindonesia.tv', password: 'demo123' }) })).json()).token;
    const nrSales = await fetch(ORIGIN + '/api/newsroom/articles', { headers: { Authorization: 'Bearer ' + salesTok2 } });
    ok('newsroom: sales → 403', nrSales.status === 403);
    const nrAnon = await fetch(ORIGIN + '/api/newsroom/articles');
    ok('newsroom: anonim → 401', nrAnon.status === 401);

    const edTok = (await (await fetch(ORIGIN + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'redaksi@mbcindonesia.tv', password: 'demo123' }) })).json()).token;
    const EH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + edTok };
    const nrList = await (await fetch(ORIGIN + '/api/newsroom/articles', { headers: EH })).json();
    ok('newsroom: daftar artikel (redaksi) → ada isi', Array.isArray(nrList.articles) && nrList.articles.length >= 5);
    const desk = await (await fetch(ORIGIN + '/api/newsroom/desk', { headers: EH })).json();
    ok('newsroom: meja redaksi punya tugas & approval', Array.isArray(desk.tasks) && Array.isArray(desk.pending_approvals));
    const agentsList = await (await fetch(ORIGIN + '/api/newsroom/ai/agents', { headers: EH })).json();
    ok('newsroom: 9 agen AI terdaftar', agentsList.agents.length === 9);

    // alur editorial: transisi tidak sah ditolak
    const longBody = Array.from({ length: 8 }, (_, i) => `Paragraf ${i + 1} menjelaskan konteks liputan secara rinci dengan angka ${10 + i * 5} persen agar syarat minimal naskah terpenuhi.`).join(' ');
    const createdArt = await (await fetch(ORIGIN + '/api/newsroom/articles', { method: 'POST', headers: EH, body: JSON.stringify({ title: 'Uji Smoke Newsroom', deck: 'Deck uji', body: longBody, channel_id: 'ekonomi', tags: ['uji'] }) })).json();
    ok('newsroom: buat artikel', !!createdArt.article.id);
    const artId = createdArt.article.id;
    const badFlow = await fetch(ORIGIN + `/api/newsroom/articles/${artId}/status`, { method: 'POST', headers: EH, body: JSON.stringify({ status: 'tayang' }) });
    ok('newsroom: draft→tayang ditolak (409)', badFlow.status === 409);
    for (const st of ['review', 'fakta', 'hukum', 'siap']) {
      await fetch(ORIGIN + `/api/newsroom/articles/${artId}/status`, { method: 'POST', headers: EH, body: JSON.stringify({ status: st }) });
    }
    const noSrc = await fetch(ORIGIN + `/api/newsroom/articles/${artId}/status`, { method: 'POST', headers: EH, body: JSON.stringify({ status: 'tayang' }) });
    const noSrcBody = await noSrc.json();
    ok('newsroom: tayang tanpa sumber ditolak + alasannya', noSrc.status === 409 && Array.isArray(noSrcBody.blockers));
    await fetch(ORIGIN + `/api/newsroom/articles/${artId}`, { method: 'PATCH', headers: EH, body: JSON.stringify({ sources: [{ title: 'BPS', url: 'https://bps.go.id', type: 'data', note: 'uji' }], fact_checks: [{ claim: '12 persen', status: 'terverifikasi', source: 'BPS' }] }) });
    const nowPublish = await fetch(ORIGIN + `/api/newsroom/articles/${artId}/status`, { method: 'POST', headers: EH, body: JSON.stringify({ status: 'tayang' }) });
    ok('newsroom: tayang setelah sumber lengkap', nowPublish.status === 200);
    const pubList = await (await fetch(ORIGIN + '/api/newsroom/public-list')).json();
    ok('newsroom: artikel tayang muncul di daftar publik', pubList.articles.some(a => a.title === 'Uji Smoke Newsroom'));
    const delLive = await fetch(ORIGIN + `/api/newsroom/articles/${artId}`, { method: 'DELETE', headers: EH });
    ok('newsroom: artikel tayang tidak bisa dihapus (409)', delLive.status === 409);

    // AI pipeline
    const pipeline = await (await fetch(ORIGIN + '/api/newsroom/ai/pipeline', { method: 'POST', headers: EH, body: JSON.stringify({ article_id: artId }) })).json();
    ok('AI: pipeline 9 agen berjalan', pipeline.runs.length === 9 && pipeline.findings > 0);
    const findings = await (await fetch(ORIGIN + '/api/newsroom/ai/findings?status=baru', { headers: EH })).json();
    ok('AI: temuan tersimpan dengan severity', findings.findings.length > 0 && ['kritis', 'peringatan', 'saran', 'info'].includes(findings.findings[0].severity));
    const sweep = await (await fetch(ORIGIN + '/api/newsroom/ai/sweep', { method: 'POST', headers: EH, body: JSON.stringify({}) })).json();
    ok('AI: sweep seluruh newsroom', sweep.articles >= 1 && sweep.findings >= 1);
    const metrics2 = await (await fetch(ORIGIN + '/api/metrics', { headers: H })).json();
    ok('metrics: menghitung artikel newsroom', metrics2.counts.newsroom_articles >= 5);

    // moderasi komentar
    const mod = await (await fetch(ORIGIN + '/api/newsroom/moderation', { headers: EH })).json();
    ok('newsroom: daftar moderasi komentar', Array.isArray(mod.comments));

    // Audit bertambah setelah mutasi
    const state = await (await fetch(ORIGIN + '/api/state', { headers: H })).json();
    ok('audit tercatat (append-only)', Array.isArray(state.audit) && state.audit.length > 0);
  } finally {
    srv.kill('SIGTERM');
    await wait(500);
  }

  console.log('\n' + (failures === 0 ? '✅ SMOKE CI LULUS — API siap deploy' : '❌ ' + failures + ' KEGAGALAN'));
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('SMOKE CRASH:', e); process.exit(1); });
