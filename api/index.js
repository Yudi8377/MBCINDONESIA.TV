/* Entry serverless Vercel — memakai ulang seluruh aplikasi Express di server/server.js.
   PENTING (keamanan): newsroom adalah dapur produksi. Di Vercel, rute statis dilayani CDN
   sehingga middleware Express bisa terlewati. Karena itu di sini dibuat gerbang eksplisit:
   siapa pun tanpa cookie/token sah TIDAK akan pernah menerima HTML CMS. */
'use strict';
process.env.VERCEL = '1';

const NEWSROOM_REGEX = /^\/newsroom(\/(index\.html)?)?\/?$/i;

function punyaTokenSah(req) {
  try {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET;
    if (!secret) return false;
    const cookie = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('mbc_gate='));
    const auth = req.headers.authorization || '';
    const q = (req.url || '').includes('?t=') ? new URL(req.url, 'http://x').searchParams.get('t') : null;
    const token = auth.startsWith('Bearer ') ? auth.slice(7)
      : cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : q;
    if (!token) return false;
    const p = jwt.verify(token, secret);
    return ['editorial', 'direksi', 'finance', 'sales'].includes(p.role);
  } catch (_) { return false; }
}

function kirimGerbang(req, res) {
  const fs = require('fs');
  const path = require('path');
  res.statusCode = 401;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const berkas = path.join(__dirname, '..', 'website', 'newsroom', 'gerbang.html');
  try {
    fs.readFile(berkas, (err, isi) => {
      if (err) { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end('Newsroom internal — akses ditolak. Silakan masuk lebih dulu.'); }
      res.end(isi);
    });
  } catch (_) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Newsroom internal — akses ditolak.');
  }
}

let app;
try {
  app = require('../server/server.js');
} catch (e) {
  console.error('[api] gagal memuat server:', e && e.stack || e);
  module.exports = (req, res) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Server gagal dimuat', detail: String(e && e.message || e).slice(0, 200) }));
  };
}

if (app) {
  module.exports = (req, res) => {
    const jalur = (req.url || '').split('?')[0];
    if (NEWSROOM_REGEX.test(jalur) && !punyaTokenSah(req)) return kirimGerbang(req, res);
    return app(req, res);
  };
}
