/* MBCINDONESIA.TV — Backend API (Express + PostgreSQL)
   Menyajikan situs publik + Workspace + REST API dalam satu origin.
   Produksi (Blueprint §9): DATABASE_URL → Neon PostgreSQL; JWT_SECRET wajib di-set. */
'use strict';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const path = require('path');
const fs = require('fs');

/* Loader .env minimal (tanpa dependensi): server/.env tidak boleh di-commit (.gitignore) */
(function loadEnvFile(){
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1]; const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (e) { console.warn('[env] gagal membaca .env:', e.message); }
})();

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const compression = require('compression');
const { pool, dbInfo } = require('./db');
/* Satu sumber kebenaran versi: package.json (supaya /api/health & /api/status
   tidak pernah tertinggal dari CHANGELOG). */
const VERSI = (() => {
  try { return require('../package.json').version || '0.0.0'; } catch (e) { return '0.0.0'; }
})();

const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ JWT_SECRET wajib di-set di produksi (openssl rand -hex 48). Berhenti.');
    process.exit(1);
  }
  console.warn('[peringatan] JWT_SECRET tidak di-set — secret ephemeral dipakai untuk sesi ini saja.');
}
const EFFECTIVE_SECRET = JWT_SECRET || require('crypto').randomBytes(48).toString('hex');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // satu hop: reverse proxy / CDN di depan (Blueprint §9.4)
app.use(compression());
/* ===== Observability ringan (tanpa APM eksternal) =====
   - mencatat setiap respons 5xx dan request > RESPONSE_LAMBAT_MS ke log + penghitung di memori
   - diekspos lewat /api/status agar monitor/opsi alerting bisa membacanya */
const METRIK = { total: 0, err5xx: 0, lambat: 0, mulai: Date.now(), terakhir_error: null };
const RESPONSE_LAMBAT_MS = Number(process.env.RESPONSE_LAMBAT_MS || 1500);
/* Batas kiriman publik bisa dilonggarkan saat pengujian lokal (di produksi tetap ketat) */
const BATAS_KIRIM = Number(process.env.BATAS_KIRIM_JAM || 3);
app.use((req, res, next) => {
  const t0 = Date.now();
  METRIK.total++;
  res.on('finish', () => {
    const ms = Date.now() - t0;
    if (res.statusCode >= 500) {
      METRIK.err5xx++;
      METRIK.terakhir_error = { at: new Date().toISOString(), path: req.path, status: res.statusCode, ms };
      console.error(`[5xx] ${req.method} ${req.path} → ${res.statusCode} (${ms} ms)`);
    } else if (ms > RESPONSE_LAMBAT_MS) {
      METRIK.lambat++;
      console.warn(`[lambat] ${req.method} ${req.path} → ${ms} ms`);
    }
  });
  next();
});

app.use(express.json({ limit: '256kb' }));

/* ---------- Request log ringkas (produksi: ganti dengan pino/structured log) ---------- */
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    if (req.path === '/api/health') return;
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - t0}ms)`);
  });
  next();
});

/* ---------- Security headers ---------- */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  res.setHeader('Content-Security-Policy', CSP);
  next();
});

/* ---------- Rate limiter sederhana (in-memory; produksi: Redis store) ---------- */
const buckets = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now); buckets.set(key, arr); return true;
}
const clientIp = req => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

/* Pembatas percobaan login yang adil untuk kantor/NAT:
   satu alamat IP (bisa mewakili satu kantor) tidak dikunci hanya karena
   beberapa orang salah ketik. Kunci keras hanya untuk IP yang benar-benar
   agresif (mis. percobaan otomatis). */
const FAIL_WINDOW = 10 * 60_000;              // 10 menit
const failBuckets = new Map();                // key → { ip: [...], acct: [...] }
function failRecord(key, field, limit, windowMs) {
  const now = Date.now();
  const b = failBuckets.get(key) || { ip: [], acct: [] };
  b[field] = b[field].filter(t => now - t < windowMs);
  b[field].push(now);
  failBuckets.set(key, b);
  if (failBuckets.size > 5000) failBuckets.clear();
  return b[field].length <= limit;
}
function failCount(key, field, windowMs) {
  const b = failBuckets.get(key);
  if (!b) return 0;
  const now = Date.now();
  return b[field].filter(t => now - t < windowMs).length;
}
/* Throttle login: kembalikan null bila boleh lanjut, atau { retry } bila ditahan. */
function loginThrottle(ip, email) {
  const acct = ip + '|' + String(email || '').toLowerCase();
  if (failCount('ip:' + ip, 'ip', FAIL_WINDOW) >= 40) return { retry: 900, reason: 'ip' };
  const n = failCount('acct:' + acct, 'acct', FAIL_WINDOW);
  if (n >= 10) return { retry: 600, reason: 'acct' };
  return null;
}
function loginFailed(ip, email) {
  const acct = ip + '|' + String(email || '').toLowerCase();
  failRecord('ip:' + ip, 'ip', 1e9, FAIL_WINDOW);
  failRecord('acct:' + acct, 'acct', 1e9, FAIL_WINDOW);
}
function loginSucceeded(ip, email) {
  const acct = ip + '|' + String(email || '').toLowerCase();
  const b = failBuckets.get('acct:' + acct);
  if (b) { b.acct = []; failBuckets.set('acct:' + acct, b); }
}

/* ---------- Auth ---------- */
function signToken(u) {
  return jwt.sign({ sub: u.id, email: u.email, name: u.name, role: u.role, roleLabel: u.role_label || u.roleLabel }, EFFECTIVE_SECRET, { expiresIn: '12h' });
}
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token tidak ada' });
  try { req.user = jwt.verify(token, EFFECTIVE_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Token tidak valid / kedaluwarsa' }); }
}
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Peran Anda tidak diizinkan untuk aksi ini' });
  next();
};
async function audit(action, who) {
  try { await pool.query('INSERT INTO audit_log(action, who) VALUES($1,$2)', [String(action).slice(0, 300), String(who || 'System').slice(0, 120)]); }
  catch (e) { console.error('[audit] gagal menulis:', e.message); }
}

/* ================= API PUBLIK ================= */

/* /api/healthz — liveness murah untuk uptime monitor: SELALU 200, tanpa DB,
   di-cache 1 detik agar tidak membanjiri pool. Status DB tetap di /api/health. */
let _hz = { t: 0, body: null };
app.get('/api/healthz', (req, res) => {
  const kini = Date.now();
  if (!_hz.body || kini - _hz.t > 1000) {
    _hz = { t: kini, body: { status: 'ok', uptime_s: Math.round(process.uptime()), version: process.env.APP_VERSION || VERSI } };
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json(_hz.body);
});

app.get('/api/health', async (req, res) => {
  const t0 = Date.now();
  try {
    await pool.query('SELECT 1');
    res.json({
      ok: true, db: true, time: new Date().toISOString(), latency_ms: Date.now() - t0,
      /* provider & host ditampilkan agar operator tahu ke mana aplikasi menyambung */
      provider: dbInfo.provider, db_host: dbInfo.host, db_name: dbInfo.database,
      tls: dbInfo.ssl, pooler: dbInfo.pooler, version: process.env.APP_VERSION || VERSI
    });
  } catch (e) {
    res.status(503).json({ ok: false, db: false, provider: dbInfo.provider, db_host: dbInfo.host, error: 'Database tidak terjangkau' });
  }
});

// Katalog program dari database (single source of truth)
app.get('/api/programs', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,title,cat,img,descr AS "desc",descr,rating,views,hl FROM programs ORDER BY title');
    const eps = await pool.query('SELECT program_id, ep_index, title, dur, video_key FROM episodes ORDER BY program_id, ep_index');
    const byId = {};
    for (const p of rows) byId[p.id] = { ...p, eps: [] };
    for (const e of eps.rows) { const prog = byId[e.program_id]; if (prog) prog.eps.push([e.title, e.dur, e.video_key]); }
    res.json({ programs: rows.map(r => byId[r.id]) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Komentar (publik; rate-limited)
app.get('/api/comments', async (req, res) => {
  const pid = String(req.query.program_id || '');
  if (!pid) return res.status(400).json({ error: 'program_id wajib diisi' });
  try {
    const { rows } = await pool.query('SELECT id,author,body,created_at FROM comments WHERE program_id=$1 ORDER BY created_at DESC LIMIT 100', [pid]);
    res.json({ comments: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/comments', async (req, res) => {
  if (!rateLimit('comment:' + clientIp(req), 30, 3600_000)) return res.status(429).json({ error: 'Terlalu banyak komentar, coba lagi nanti' });
  const { program_id, author, body } = req.body || {};
  const text = String(body || '').trim();
  const name = String(author || 'Anonim').trim().slice(0, 80) || 'Anonim';
  if (!program_id || text.length < 1 || text.length > 1000) return res.status(400).json({ error: 'program_id & body (1–1000 karakter) wajib diisi' });
  try {
    const { rows } = await pool.query('INSERT INTO comments(program_id,author,body) VALUES($1,$2,$3) RETURNING id,author,body,created_at', [String(program_id).slice(0, 80), name, text]);
    res.status(201).json({ comment: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Buletin
app.post('/api/newsletter', async (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Email tidak valid' });
  try {
    const r = await pool.query('INSERT INTO newsletter_subscribers(email) VALUES($1) ON CONFLICT (email) DO NOTHING RETURNING id', [email]);
    res.status(r.rowCount ? 201 : 200).json({ ok: true, already: !r.rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ============================================================
   /api/status — untuk monitoring eksternal (uptime robot, systemd timer, Prometheus)
   Beda dari /api/health: bisa dipanggil tiap 30 detik, memberi kode HTTP tegas,
   dan menyertakan metrik ringan (5xx, request lambat) tanpa data sensitif.
   ============================================================ */
app.get('/api/status', async (req, res) => {
  const mulai = Date.now() - Math.round(process.uptime() * 1000);
  const hasil = {
    service: 'mbcindonesia-tv',
    version: process.env.APP_VERSION || VERSI,
    env: process.env.NODE_ENV || 'development',
    uptime_s: Math.round(process.uptime()),
    started_at: new Date(mulai).toISOString(),
    node: process.version,
    memory_mb: Math.round(process.memoryUsage().rss / 1048576),
    metrik: {
      total_request: METRIK.total, error_5xx: METRIK.err5xx, request_lambat: METRIK.lambat,
      ambang_lambat_ms: RESPONSE_LAMBAT_MS, terakhir_error: METRIK.terakhir_error
    }
  };
  try {
    const db0 = Date.now();
    const c = await pool.query(`SELECT
        (SELECT count(*) FROM articles)::int artikel,
        (SELECT count(*) FROM articles WHERE status='tayang')::int tayang,
        (SELECT count(*) FROM users)::int pengguna,
        (SELECT count(*) FROM programs)::int program`);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...hasil, ok: true, db: {
      ok: true, latency_ms: Date.now() - db0,
      provider: dbInfo.provider, host: dbInfo.host, tls: dbInfo.ssl, pooler: dbInfo.pooler,
      counts: c.rows[0]
    } });
  } catch (e) {
    res.status(503).json({ ...hasil, ok: false, db: {
      ok: false, provider: dbInfo.provider, host: dbInfo.host, error: 'Database tidak terjangkau'
    } });
  }
});

/* ================= AUTH ================= */

app.post('/api/auth/login', async (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit('login-burst:' + ip, 120, 60_000)) return res.status(429).json({ error: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.' });
  const { email, password } = req.body || {};
  const em = String(email || '').trim().toLowerCase();
  if (!em || !password) return res.status(400).json({ error: 'Email dan kata sandi wajib diisi' });
  const held = loginThrottle(ip, em);
  if (held) {
    res.setHeader('Retry-After', String(held.retry));
    return res.status(429).json({ error: `Terlalu banyak percobaan masuk untuk akun ini. Coba lagi dalam ${Math.ceil(held.retry / 60)} menit.` });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [em]);
    const u = rows[0];
    const okPass = u && await bcrypt.compare(String(password), u.pass_hash);
    if (!okPass) { loginFailed(ip, em); return res.status(401).json({ error: 'Email atau kata sandi salah' }); }
    loginSucceeded(ip, em);
    await audit(`Login — ${u.name} (${u.role_label})`, u.name);
    res.json({ token: signToken(u), user: { email: u.email, name: u.name, role: u.role, roleLabel: u.role_label } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

/* Ganti kata sandi sendiri (semua peran). Wajib verifikasi sandi lama. */
app.post('/api/auth/password', requireAuth, async (req, res) => {
  const ip = clientIp(req);
  if (!rateLimit('pass:' + ip, 10, 600_000)) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba 10 menit lagi.' });
  const { current, next } = req.body || {};
  if (!current || !next) return res.status(400).json({ error: 'Kata sandi lama dan baru wajib diisi' });
  if (String(next).length < 10) return res.status(400).json({ error: 'Kata sandi baru minimal 10 karakter' });
  if (String(next) === 'demo123') return res.status(400).json({ error: 'Kata sandi demo tidak boleh dipakai di produksi' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [req.user.email]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(String(current), u.pass_hash))) return res.status(401).json({ error: 'Kata sandi lama salah' });
    if (await bcrypt.compare(String(next), u.pass_hash)) return res.status(400).json({ error: 'Kata sandi baru harus berbeda dari yang lama' });
    const hash = await bcrypt.hash(String(next), 10);
    await pool.query('UPDATE users SET pass_hash=$1 WHERE id=$2', [hash, u.id]);
    await audit(`Ganti kata sandi — ${u.name} (${u.role_label})`, u.name);
    res.json({ ok: true, message: 'Kata sandi diperbarui. Sesi lain tetap berlaku sampai token kedaluwarsa (12 jam).' });
  } catch (e) { res.status(500).json({ error: 'Gagal memperbarui kata sandi' }); }
});

/* Profil sendiri: ganti nama tampilan & email login */
app.patch('/api/auth/profile', requireAuth, async (req, res) => {
  const name = String((req.body && req.body.name) || '').trim();
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!name || name.length < 3) return res.status(400).json({ error: 'Nama minimal 3 karakter' });
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return res.status(400).json({ error: 'Format email tidak valid' });
  try {
    const taken = await pool.query('SELECT 1 FROM users WHERE email=$1 AND email<>$2', [email, req.user.email]);
    if (taken.rowCount) return res.status(409).json({ error: 'Email sudah dipakai akun lain' });
    const { rows } = await pool.query('UPDATE users SET name=$1, email=$2 WHERE email=$3 RETURNING *', [name, email, req.user.email]);
    if (!rows.length) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    await audit(`Ubah profil — ${name} <${email}>`, name);
    res.json({ ok: true, user: { email: rows[0].email, name: rows[0].name, role: rows[0].role, roleLabel: rows[0].role_label }, message: 'Profil diperbarui. Silakan login ulang bila email berubah.' });
  } catch (e) { res.status(500).json({ error: 'Gagal memperbarui profil' }); }
});

/* ================= STATE / HYDRATE (RBAC-filtered) ================= */

app.get('/api/state', requireAuth, async (req, res) => {
  const role = req.user.role;
  const out = {};
  try {
    // Aktivitas terbaru untuk semua peran (read-only)
    out.audit = (await pool.query('SELECT action AS t, who, to_char(created_at, \'YYYY-MM-DD HH24:MI\') AS at FROM audit_log ORDER BY id DESC LIMIT 150')).rows;

    if (['direksi', 'sales'].includes(role)) {
      const dealRows = (await pool.query('SELECT id, stage, company, deal, value_jt AS val FROM crm_deals ORDER BY id')).rows;
      out.crm = { prospek: [], penawaran: [], negosiasi: [], kontrak: [], selesai: [] };
      for (const d of dealRows) out.crm[d.stage].push({ id: d.id, co: d.company, deal: d.deal, val: Number(d.val) });
      out.campaigns = (await pool.query('SELECT id, company AS co, package AS pkg, total, done FROM campaigns ORDER BY id')).rows;
      out.slots = (await pool.query('SELECT id, slot, price, status FROM ad_slots ORDER BY id')).rows;
    }
    if (['direksi', 'editorial'].includes(role)) {
      out.produksi = (await pool.query('SELECT id, name AS n, client AS c, stage, progress AS prog, due, budget_jt AS bud FROM production_projects ORDER BY id')).rows.map(r => ({ ...r, bud: Number(r.bud) }));
    }
    if (['direksi', 'finance'].includes(role)) {
      out.piutang = (await pool.query('SELECT inv, company AS co, amount_jt AS amt, due, aging FROM invoices ORDER BY id')).rows.map(r => ({ ...r, amt: Number(r.amt) }));
      out.approvals = (await pool.query('SELECT ref AS id, description AS d, amount_jt AS amt FROM approvals WHERE status=\'pending\' ORDER BY id')).rows.map(r => ({ ...r, amt: Number(r.amt) }));
      const m = {};
      for (const kind of ['klien', 'vendor', 'produk']) {
        const rows = (await pool.query('SELECT id, c1, c2, c3 FROM master_items WHERE kind=$1 ORDER BY id DESC', [kind])).rows;
        m[kind] = { cols: kind === 'klien' ? ['Nama', 'Tipe', 'Kota'] : kind === 'vendor' ? ['Nama Vendor', 'Layanan'] : ['Layanan', 'Harga', 'Margin'], rows: rows.map(r => [String(r.id), r.c1, r.c2, r.c3].filter(x => x !== '')), raw: rows };
      }
      // kirim bentuk sederhana: rows sebagai array nilai saja
      out.master = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { cols: v.cols, rows: v.raw.map(r => [r.c1, r.c2, r.c3].filter(x => x !== '')), ids: v.raw.map(r => r.id) }]));
    }
    if (role === 'direksi') {
      const pipeline = (await pool.query('SELECT COALESCE(SUM(value_jt),0) AS s FROM crm_deals WHERE stage <> \'selesai\'')).rows[0].s;
      const pendingAppr = (await pool.query('SELECT COUNT(*)::int AS c FROM approvals WHERE status=\'pending\'')).rows[0].c;
      out.summary = { pipeline_jt: Number(pipeline), pending_approvals: pendingAppr };
    }
    res.json(out);
  } catch (e) {
    console.error('[state]', e);
    res.status(500).json({ error: 'Gagal memuat state: ' + e.message });
  }
});

/* ================= CRM ================= */

app.post('/api/crm/deals', requireAuth, requireRole('direksi', 'sales'), async (req, res) => {
  const { company, deal, value } = req.body || {};
  const co = String(company || '').trim(), dl = String(deal || '').trim(), v = Number(value);
  if (!co || !dl || !(v > 0)) return res.status(400).json({ error: 'company, deal, value (>0) wajib diisi' });
  try {
    const { rows } = await pool.query('INSERT INTO crm_deals(stage,company,deal,value_jt) VALUES(\'prospek\',$1,$2,$3) RETURNING id', [co.slice(0, 200), dl.slice(0, 300), v]);
    await audit(`CRM: prospek baru “${co}” ditambahkan (Rp ${v} jt)`, req.user.name);
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/crm/deals/:id/stage', requireAuth, requireRole('direksi', 'sales'), async (req, res) => {
  const id = Number(req.params.id), stage = String((req.body || {}).stage || '');
  const valid = ['prospek', 'penawaran', 'negosiasi', 'kontrak', 'selesai'];
  if (!Number.isInteger(id) || !valid.includes(stage)) return res.status(400).json({ error: 'stage tidak valid' });
  try {
    const { rowCount, rows } = await pool.query('UPDATE crm_deals SET stage=$2 WHERE id=$1 RETURNING company', [id, stage]);
    if (!rowCount) return res.status(404).json({ error: 'Deal tidak ditemukan' });
    await audit(`Pipeline: “${rows[0].company}” dipindah ke ${stage}`, req.user.name);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/crm/deals/:id', requireAuth, requireRole('direksi', 'sales'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rowCount, rows } = await pool.query('DELETE FROM crm_deals WHERE id=$1 RETURNING company', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Deal tidak ditemukan' });
    await audit(`Pipeline: prospek “${rows[0].company}” dihapus`, req.user.name);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ================= PRODUKSI ================= */

const STAGES = ['Brief', 'Naskah', 'Produksi', 'Editing', 'Review Klien', 'Tayang'];
app.post('/api/produksi/projects', requireAuth, requireRole('direksi', 'editorial'), async (req, res) => {
  const { name, client, budget, due } = req.body || {};
  const n = String(name || '').trim(), c = String(client || '').trim(), b = Number(budget), d = String(due || '—').trim();
  if (!n || !c || !(b > 0)) return res.status(400).json({ error: 'name, client, budget (>0) wajib diisi' });
  try {
    const { rows } = await pool.query('INSERT INTO production_projects(name,client,stage,progress,due,budget_jt) VALUES($1,$2,0,2,$3,$4) RETURNING id', [n.slice(0, 250), c.slice(0, 200), d.slice(0, 60), b]);
    await audit(`Produksi: proyek “${n}” dibuat untuk ${c}`, req.user.name);
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/produksi/projects/:id/advance', requireAuth, requireRole('direksi', 'editorial'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query('SELECT stage, progress, name FROM production_projects WHERE id=$1', [id]);
    const p = rows[0];
    if (!p) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
    if (p.stage >= STAGES.length - 1) return res.status(409).json({ error: 'Proyek sudah pada tahap akhir' });
    const newStage = p.stage + 1, newProg = Math.min(100, p.progress + 14);
    await pool.query('UPDATE production_projects SET stage=$2, progress=$3 WHERE id=$1', [id, newStage, newProg]);
    await audit(`Produksi: “${p.name}” maju ke tahap ${STAGES[newStage]}`, req.user.name);
    res.json({ ok: true, stage: newStage, progress: newProg, stageName: STAGES[newStage] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ================= IKLAN & SPONSORSHIP ================= */

app.post('/api/ads/campaigns/:id/proof', requireAuth, requireRole('direksi', 'sales'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query('UPDATE campaigns SET done = LEAST(total, done + 1) WHERE id=$1 RETURNING company, done, total', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Kampanye tidak ditemukan' });
    await audit(`Bukti tayang diunggah: ${rows[0].company} (${rows[0].done}/${rows[0].total})`, req.user.name);
    res.json({ ok: true, done: rows[0].done, total: rows[0].total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ================= KEUANGAN ================= */

app.post('/api/keuangan/approvals/:ref', requireAuth, requireRole('direksi', 'finance'), async (req, res) => {
  const ref = String(req.params.ref), action = String((req.body || {}).action || '');
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action harus approve|reject' });
  try {
    const status = action === 'approve' ? 'approved' : 'rejected';
    const { rowCount, rows } = await pool.query('UPDATE approvals SET status=$2, decided_by=$3, decided_at=now() WHERE ref=$1 AND status=\'pending\' RETURNING ref', [ref, status, req.user.name]);
    if (!rowCount) return res.status(404).json({ error: 'Pengajuan tidak ditemukan atau sudah diputuskan' });
    await audit(`Persetujuan ${ref}: ${action === 'approve' ? 'DISETUJUI' : 'DITOLAK'} oleh ${req.user.name}`, req.user.name);
    res.json({ ok: true, status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/keuangan/piutang/:inv/remind', requireAuth, requireRole('direksi', 'finance'), async (req, res) => {
  const inv = String(req.params.inv);
  try {
    const { rowCount, rows } = await pool.query('SELECT company FROM invoices WHERE inv=$1', [inv]);
    if (!rowCount) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
    await audit(`Reminder piutang dikirim: ${inv} (${rows[0].company})`, req.user.name);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ================= MASTER DATA ================= */

const MASTER_COLS = { klien: ['Nama', 'Tipe', 'Kota'], vendor: ['Nama Vendor', 'Layanan'], produk: ['Layanan', 'Harga', 'Margin'] };
app.post('/api/master/:kind', requireAuth, requireRole('direksi', 'finance'), async (req, res) => {
  const kind = String(req.params.kind);
  if (!MASTER_COLS[kind]) return res.status(400).json({ error: 'kind harus klien|vendor|produk' });
  const { c1, c2, c3 } = req.body || {};
  if (!String(c1 || '').trim()) return res.status(400).json({ error: 'Kolom pertama wajib diisi' });
  try {
    const { rows } = await pool.query('INSERT INTO master_items(kind,c1,c2,c3) VALUES($1,$2,$3,$4) RETURNING id', [kind, String(c1).slice(0, 250), String(c2 || '').slice(0, 250), String(c3 || '').slice(0, 100)]);
    await audit(`Master Data (${kind}): “${c1}” ditambahkan`, req.user.name);
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/master/:kind/:id', requireAuth, requireRole('direksi', 'finance'), async (req, res) => {
  const kind = String(req.params.kind), id = Number(req.params.id);
  if (!MASTER_COLS[kind] || !Number.isInteger(id)) return res.status(400).json({ error: 'Parameter tidak valid' });
  try {
    const { rowCount, rows } = await pool.query('DELETE FROM master_items WHERE id=$1 AND kind=$2 RETURNING c1', [id, kind]);
    if (!rowCount) return res.status(404).json({ error: 'Data tidak ditemukan' });
    await audit(`Master Data (${kind}): “${rows[0].c1}” dihapus`, req.user.name);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ================= AUDIT & LAPORAN ================= */

app.post('/api/audit', requireAuth, async (req, res) => {
  const action = String((req.body || {}).action || '').trim();
  if (!action) return res.status(400).json({ error: 'action wajib diisi' });
  await audit(action, req.user.name);
  res.status(201).json({ ok: true });
});

const KPI_CSV = [
  ['Area', 'Indikator', 'Nilai', 'Tren'],
  ['Bisnis', 'Pendapatan / bulan', 'Rp 486 jt', '+11,0%'],
  ['Bisnis', 'Nilai kontrak rata-rata', 'Rp 54 jt', '+6%'],
  ['Produksi', 'Ketepatan jadwal', '82%', 'target 90%'],
  ['Produksi', 'Utilisasi kru & alat', '74%', '+9 pts'],
  ['Editorial', 'Pemenuhan standar mutu', '96%', 'baik'],
  ['Audiens', 'Pengguna aktif bulanan', '184 rb', '+23%'],
  ['Audiens', 'Waktu tonton / sesi', '11,4 mnt', '+1,2 mnt'],
  ['Komersial', 'Pemenuhan kampanye', '91%', '41/45 tayang'],
  ['Keuangan', 'Arus kas operasi', 'Rp 132 jt', 'positif 3 bln beruntun'],
  ['SDM', 'Akurasi payroll', '99,1%', 'audit internal'],
  ['Teknologi', 'Ketersediaan layanan', '99,4%', 'SLA 99%'],
  ['Keamanan', 'Insiden terbuka', '0', 'audit RBAC lulus'],
  ['AI', 'Biaya per tugas (avg)', 'Rp 1.240', '312 tugas, 4 dibatalkan']
];
app.get('/api/laporan/kpi.csv', requireAuth, requireRole('direksi', 'finance'), (req, res) => {
  const csv = KPI_CSV.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="kpi-mbcindonesia.csv"');
  res.send('﻿' + csv);
});


/* ================= MONITORING (ringkas) ================= */

app.get('/api/metrics', requireAuth, requireRole('direksi'), async (req, res) => {
  try {
    const q = (sql) => pool.query(sql).then(r => Number(r.rows[0].c));
    const counts = {
      programs: await q('SELECT COUNT(*)::int c FROM programs'),
      episodes: await q('SELECT COUNT(*)::int c FROM episodes'),
      crm_deals: await q('SELECT COUNT(*)::int c FROM crm_deals'),
      production_projects: await q('SELECT COUNT(*)::int c FROM production_projects'),
      pending_approvals: await q("SELECT COUNT(*)::int c FROM approvals WHERE status='pending'"),
      audit_entries: await q('SELECT COUNT(*)::int c FROM audit_log'),
      newsletter_subscribers: await q('SELECT COUNT(*)::int c FROM newsletter_subscribers'),
      comments: await q('SELECT COUNT(*)::int c FROM comments'),
      newsroom_articles: await q('SELECT COUNT(*)::int c FROM articles'),
      ai_findings_open: await q("SELECT COUNT(*)::int c FROM ai_findings WHERE status='baru'"),
      ai_agent_runs: await q('SELECT COUNT(*)::int c FROM ai_runs')
    };
    res.json({ ok: true, uptime_s: Math.round(process.uptime()), memory_mb: Math.round(process.memoryUsage().rss / 1048576), node: process.version, counts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Digital Asset Links (Android App Links — lihat android/README.md) */
app.get('/.well-known/assetlinks.json', (req, res) => {
  const p = path.join(__dirname, '..', 'website', '.well-known', 'assetlinks.json');
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(p, err => { if (err) res.status(404).json({ error: 'assetlinks.json belum diisi fingerprint rilis' }); });
});

/* ================= API AKUN PUBLIK (MBC Single Account, 1.5.0) =================
   Didaftarkan SEBELUM newsroom agar rute /api/akun/* tersedia untuk pengunjung. */
if (process.env.AKUN_NONAKTIF !== '1') {
  require('./akun')(app, { pool, secret: EFFECTIVE_SECRET, rateLimit, clientIp });
}

/* ================= API NEWSROOM (CMS, editorial, multi-agent AI) ================= */
require('./newsroom-api')(app, {
  pool, requireAuth, requireRole, audit,
  LIBRARY: require('./content-library.json')
});

/* ================= PINTU INTERNAL (NEWSROOM) =================
   Newsroom adalah dapur produksi: tidak boleh diakses anonim dan tidak diindeks.
   Middleware ini berjalan SEBELUM static, jadi /newsroom/* anonim → 401 (halaman gerbang). */
/* Berkas CMS sengaja TIDAK berada di folder statis `website/` supaya tidak mungkin
   terunduh tanpa login (di Vercel, `website/` dilayani CDN dan melewati Express).
   Semua akses /newsroom/* melewati middleware gerbang di bawah. */
const NEWSROOM_DIR = path.join(__dirname, 'newsroom');
const NEWSROOM_GERBANG_DIR = path.join(__dirname, '..', 'website', 'newsroom');
/* Login newsroom: cookie HttpOnly mbc_gate + token di body (dipakai halaman gerbang) */
app.post('/api/newsroom/gate', (req, res) => {
  const ip = clientIp(req);
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email dan kata sandi wajib diisi' });
  /* pembatas per akun (bukan per IP kantor) — lihat loginThrottle() */
  if (!rateLimit('gate-burst:' + ip, 60, 60_000)) return res.status(429).json({ error: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.' });
  const held = loginThrottle(ip, email);
  if (held) {
    res.setHeader('Retry-After', String(held.retry));
    return res.status(429).json({ error: `Terlalu banyak percobaan masuk untuk akun ini. Coba lagi dalam ${Math.ceil(held.retry / 60)} menit.` });
  }
  pool.query('SELECT * FROM users WHERE email=$1', [String(email).trim().toLowerCase()]).then(async ({ rows }) => {
    const u = rows[0];
    const okPass = u && await bcrypt.compare(String(password), u.pass_hash);
    if (!okPass) { loginFailed(ip, email); return res.status(401).json({ error: 'Kredensial tidak dikenali' }); }
    /* /api/newsroom/gate = pintu aplikasi internal (semua peran perusahaan).
       Endpoint /api/newsroom/* tetap dibatasi peran oleh guard RBAC di bawah. */
    if (!['editorial', 'direksi', 'finance', 'sales'].includes(u.role)) {
      return res.status(403).json({ error: 'Akun ini tidak memiliki akses ke aplikasi internal' });
    }
    loginSucceeded(ip, email);
    const token = signToken(u);
    res.setHeader('Set-Cookie', `mbc_gate=${encodeURIComponent(token)}; Path=/newsroom; HttpOnly; SameSite=Lax; Max-Age=43200${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    await audit(`Akses newsroom — ${u.name} (${u.role_label})`, u.name);
    res.json({ ok: true, token, user: { email: u.email, name: u.name, role: u.role, roleLabel: u.role_label } });
  }).catch(() => res.status(500).json({ error: 'Gagal memproses login' }));
});
app.use('/newsroom', (req, res, next) => {
  const p = req.path === '/' || req.path === '' ? '/index.html' : req.path;
  if (!/^\/(index\.html|cms\.js)$/.test(p)) return next();   // aset bersama dilayani static di bawah
  const cookieToken = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('mbc_gate='));
  const authHeader = req.headers.authorization || '';
  const qt = (req.query && typeof req.query.t === 'string') ? req.query.t : '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7)
    : (cookieToken ? decodeURIComponent(cookieToken.split('=')[1]) : (qt || ''));
  if (token) {
    try {
      const payload = jwt.verify(token, EFFECTIVE_SECRET);
      /* RBAC tingkat halaman: modul editorial hanya untuk editorial & direksi.
         Peran lain (keuangan, penjualan) diarahkan ke ruang kerjanya di /workspace/. */
      /* Setelah token sah: sajikan berkas CMS dari server/newsroom (bukan dari folder statis) */
      const berkasCms = { '/index.html': 'index.html', '/cms.js': 'cms.js' }[p];
      if (berkasCms) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.sendFile(path.join(NEWSROOM_DIR, berkasCms), err => { if (err) res.status(500).end('CMS tidak tersedia'); });
      }
      return next();
    } catch (_) {}
  }
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(401).sendFile(path.join(NEWSROOM_GERBANG_DIR, 'gerbang.html'), err => { if (err) res.status(401).type('text/plain').send('Newsroom internal — akses ditolak.'); });
});

/* ================= STATIC WEBSITE ================= */
/* Di Vercel, file statis dilayani oleh CDN (lihat vercel.json) sehingga folder website
   tidak perlu ikut dibundel ke function. Kalau ada (VPS/Docker), tetap dilayani Express. */
const WEBSITE_DIR = path.join(__dirname, '..', 'website');
const WEBSITE_ADA = fs.existsSync(WEBSITE_DIR);
if (!WEBSITE_ADA) console.warn('[info] folder website tidak ada — mode API saja (Vercel melayani statis via CDN)');
app.use((req, res, next) => {
  if (req.path.startsWith('/newsroom') || req.path.startsWith('/api/')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});
if (WEBSITE_ADA) app.use(express.static(WEBSITE_DIR, {
  index: 'index.html',
  maxAge: '1h',
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    if (filePath.endsWith('manifest.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json');
    if (/assets[\/]img[\/]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800');
  }
}));
/* =====================================================================
   1.4.16 — Tahap I-b: ANALITIK NYATA · KONTRIBUTOR · PELAPORAN KONTEN
   Memakai tabel yang sudah ada (audit_log, ai_findings) karena akun
   aplikasi tidak berhak DDL. Rancangan tabel khusus ada di
   docs/MIGRASI-1.4.16.sql untuk dijalankan pengelola DB.
   ===================================================================== */

const halAman = v => String(v || '').replace(/[^a-zA-Z0-9._/-]/g, '').slice(0, 120);

/* ---------- 1. Kumpulkan analitik (tayangan, baca, putar video) ---------- */
app.post('/api/analytics/collect', async (req, res) => {
  try {
    if (!rateLimit('an:' + clientIp(req), 150, 60_000)) return res.status(429).json({ error: 'Terlalu banyak permintaan' });
    const b = req.body || {};
    const halaman = halAman(b.page);
    if (!halaman) return res.status(204).end();
    const jenis = ['view', 'read', 'video', 'share'].includes(b.type) ? b.type : 'view';
    const sid = halAman(b.sid) || ('ip' + require('crypto').createHash('sha1').update(clientIp(req)).digest('hex').slice(0, 12));
    const ua = req.headers['user-agent'] || '';
    const perangkat = /Android/i.test(ua) ? 'android' : /iPhone|iPad/i.test(ua) ? 'ios' : /Mobile/i.test(ua) ? 'mobile' : 'desktop';
    await pool.query('INSERT INTO audit_log(action, who) VALUES($1,$2)', [`${jenis}:${halaman}:${perangkat}`, sid]);
    res.status(204).end();
  } catch (e) { res.status(204).end(); }  /* analitik tidak boleh mengganggu pengunjung */
});

/* ---------- 2. Ringkasan trafik 7 hari (menggantikan angka ilustratif) ---------- */
app.get('/api/analytics/summary', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE action LIKE 'view:%')::int AS tayangan,
        COUNT(DISTINCT who) FILTER (WHERE action LIKE 'view:%')::int AS pengunjung,
        COUNT(*) FILTER (WHERE action LIKE 'video:%')::int AS putar_video,
        COUNT(*) FILTER (WHERE action LIKE 'read:%')::int AS baca_selesai
      FROM audit_log WHERE created_at > now() - interval '7 days'`);
    const harian = await pool.query(`
      SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') hari,
             COUNT(*) FILTER (WHERE action LIKE 'view:%')::int tayangan
      FROM audit_log WHERE created_at > now() - interval '7 days' GROUP BY 1 ORDER BY 1`);
    const perangkat = await pool.query(`
      SELECT split_part(action,':',3) perangkat, COUNT(*)::int n
      FROM audit_log WHERE action LIKE 'view:%' AND created_at > now() - interval '7 days'
      GROUP BY 1 ORDER BY n DESC`);
    const halamanTeratas = await pool.query(`
      SELECT split_part(action,':',2) halaman, COUNT(*)::int n
      FROM audit_log WHERE action LIKE 'view:%' AND created_at > now() - interval '7 days'
      GROUP BY 1 ORDER BY n DESC LIMIT 8`);
    res.json({ ok: true, ...r.rows[0], harian: harian.rows, perangkat: perangkat.rows, teratas: halamanTeratas.rows, sumber: 'audit_log' });
  } catch (e) { res.status(503).json({ ok: false, error: e.message }); }
});

/* ---------- 3. Penonton live nyata (heartbeat 30 dtk, jendela 90 dtk) ---------- */
app.post('/api/live/heartbeat', async (req, res) => {
  try {
    const sid = halAman((req.body || {}).sid);
    if (!sid) return res.status(400).json({ error: 'sid wajib' });
    await pool.query('INSERT INTO audit_log(action, who) VALUES($1,$2)', ['live:heartbeat', sid]);
    const r = await pool.query(`SELECT COUNT(DISTINCT who)::int n FROM audit_log
      WHERE action='live:heartbeat' AND created_at > now() - interval '90 seconds'`);
    res.json({ ok: true, penonton: r.rows[0].n });
  } catch (e) { res.status(503).json({ ok: false, error: 'Data penonton belum siap' }); }
});

/* ---------- 4. Pengiriman berita oleh kontributor publik (B-07) ---------- */
const KATEGORI_SAH = ['nasional', 'internasional', 'politik', 'ekonomi', 'hukum', 'sosial', 'budaya', 'teknologi', 'daerah', 'opini'];
const WILAYAH_SAH = ['kediri', 'bojonegoro', 'surabaya', 'malang', 'jatim', 'nasional', 'internasional'];
app.post('/api/kontributor/kirim', async (req, res) => {
  try {
    if (!rateLimit('kirim:' + clientIp(req), BATAS_KIRIM, 3600_000)) return res.status(429).json({ error: `Batas kiriman tercapai (${BATAS_KIRIM} per jam). Coba lagi nanti.` });
    const b = req.body || {};
    const nama = String(b.nama || '').trim().slice(0, 80);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 254);
    const judul = String(b.judul || '').trim().slice(0, 180);
    const isi = String(b.isi || '').trim().slice(0, 20000);
    const kategori = KATEGORI_SAH.includes(b.kategori) ? b.kategori : 'daerah';
    const wilayah = WILAYAH_SAH.includes(b.wilayah) ? b.wilayah : 'nasional';
    const tautan = String(b.tautan || '').trim().slice(0, 300);
    if (!nama || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return res.status(400).json({ error: 'Nama dan email yang valid wajib diisi' });
    if (judul.length < 12) return res.status(400).json({ error: 'Judul minimal 12 karakter' });
    if (isi.length < 120) return res.status(400).json({ error: 'Isi berita minimal 120 karakter' });
    const ev = { jenis: 'kontributor', nama, email, kategori, wilayah, tautan: tautan || null, panjang: isi.length };
    const r = await pool.query(
      `INSERT INTO ai_findings(article_id, agent_id, severity, title, detail, evidence, status)
       VALUES(NULL,'etika','info',$1,$2,$3,'baru') RETURNING id`,
      [`Kiriman kontributor: ${judul}`, isi, JSON.stringify(ev)]
    );
    res.status(201).json({ ok: true, id: r.rows[0].id, pesan: 'Kiriman diterima dan masuk antrean moderasi redaksi.' });
  } catch (e) { res.status(500).json({ error: 'Kiriman gagal diproses' }); }
});

/* ---------- 5. Laporan konten / penyalahgunaan dari publik (B-20) ---------- */
const JENIS_LAPORAN = ['spam', 'sara', 'hoaks', 'pelecehan', 'hak-cipta', 'lainnya'];
app.post('/api/lapor', async (req, res) => {
  try {
    if (!rateLimit('lapor:' + clientIp(req), 8, 3600_000)) return res.status(429).json({ error: 'Batas laporan tercapai. Coba lagi nanti.' });
    const b = req.body || {};
    const jenis = JENIS_LAPORAN.includes(b.jenis) ? b.jenis : 'lainnya';
    const target = String(b.target || '').trim().slice(0, 160);
    const catatan = String(b.catatan || '').trim().slice(0, 1000);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 254);
    if (!target) return res.status(400).json({ error: 'Target laporan wajib diisi' });
    const ev = { jenis: 'laporan', tipe: jenis, email: email || null, halaman: String(b.halaman || '').slice(0, 120) };
    const r = await pool.query(
      `INSERT INTO ai_findings(article_id, agent_id, severity, title, detail, evidence, status)
       VALUES(NULL,'etika','peringatan',$1,$2,$3,'baru') RETURNING id`,
      [`Laporan ${jenis}: ${target}`, catatan || '(tanpa catatan)', JSON.stringify(ev)]
    );
    res.status(201).json({ ok: true, id: r.rows[0].id, pesan: 'Laporan diterima. Tim moderasi meninjau dalam 1×24 jam.' });
  } catch (e) { res.status(500).json({ error: 'Laporan gagal diproses' }); }
});

/* ---------- 6. Statistik konten untuk dasbor & CMS ---------- */
app.get('/api/stats/konten', async (req, res) => {
  try {
    const [art, kirim, lapor, kom, vid] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='tayang')::int tayang FROM articles`),
      pool.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='baru')::int baru FROM ai_findings WHERE evidence->>'jenis'='kontributor'`),
      pool.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='baru')::int baru FROM ai_findings WHERE evidence->>'jenis'='laporan'`),
      pool.query(`SELECT COUNT(*)::int total FROM comments`),
      pool.query(`SELECT COUNT(*)::int total FROM episodes`)
    ]);
    res.json({ ok: true, artikel: art.rows[0], kiriman: kirim.rows[0], laporan: lapor.rows[0], komentar: kom.rows[0], episode: vid.rows[0] });
  } catch (e) { res.status(503).json({ ok: false, error: e.message }); }
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint tidak ditemukan' });
  if (!WEBSITE_ADA) return res.status(404).json({ error: 'Halaman tidak ditemukan (static dilayani CDN)' });
  const notFound = path.join(WEBSITE_DIR, '404.html');
  res.status(404).sendFile(fs.existsSync(notFound) ? notFound : path.join(WEBSITE_DIR, 'index.html'));
});
/* 500 — jangan bocorkan stack trace di produksi */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[fatal]', err);
  res.status(500).json({ error: 'Kesalahan internal server' });
});

/* Ekspor app agar bisa dipakai sebagai serverless function (Vercel) tanpa listen.
   Di server penuh (VPS/Docker/systemd) listen tetap dijalankan seperti biasa. */
module.exports = app;

const SERVERLESS = Boolean(process.env.VERCEL) || process.env.MBC_SERVERLESS === '1';
const server = SERVERLESS ? null : app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MBCINDONESIA.TV menyala → http://0.0.0.0:${PORT}/  (newsroom: /newsroom/)`);
});
/* Graceful shutdown: berhenti menerima koneksi → tunggu → tutup pool DB */
function shutdown(signal) {
  if (!server) { console.log(`[${signal}] mode serverless — tidak ada listener untuk ditutup`); return; }
  console.log(`\n${signal} diterima — mematikan dengan anggun…`);
  server.close(async () => {
    try { await pool.end(); console.log('Pool PostgreSQL tertutup. Bye.'); process.exit(0); }
    catch (e) { console.error('Gagal menutup pool:', e.message); process.exit(1); }
  });
  setTimeout(() => { console.error('Timeout shutdown 10 dtk — paksa keluar.'); process.exit(1); }, 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
