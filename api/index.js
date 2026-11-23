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


/* Sajikan berkas CMS (index.html & cms.js) HANYA setelah token sah.
   Berkas ini tinggal di server/newsroom/ sehingga tidak pernah bisa diambil dari CDN. */
function sajikanCms(jalur, req, res) {
  const fs = require('fs');
  const path = require('path');
  const peta = {
    '': 'index.html', '/': 'index.html', '/index.html': 'index.html',
    '/cms.js': 'cms.js'
  };
  const nama = peta[jalur];
  if (!nama) return false;
  const berkas = path.join(__dirname, '..', 'server', 'newsroom', nama);
  if (!fs.existsSync(berkas)) { res.statusCode = 404; res.end('tidak ada'); return true; }
  res.statusCode = 200;
  res.setHeader('Content-Type', nama.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  fs.createReadStream(berkas).pipe(res);
  return true;
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
    if (NEWSROOM_REGEX.test(jalur) || jalur === '/newsroom/cms.js') {
      if (!punyaTokenSah(req)) return kirimGerbang(req, res);
      const sub = jalur.replace(/^\/newsroom/, '').replace(/^\/$/, '/');
      if (sajikanCms(sub, req, res)) return;
    }
    return app(req, res);
  };
}
