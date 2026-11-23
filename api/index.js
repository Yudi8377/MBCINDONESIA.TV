/**
 * api/index.js — titik masuk serverless Vercel.
 *
 * Express app (server/server.js) dipakai ulang apa adanya; Vercel hanya memanggilnya
 * sebagai handler. Semua request /api/* dan halaman statis diteruskan ke app yang sama,
 * sehingga perilaku di Vercel identik dengan di server penuh (VPS/Docker).
 *
 * Catatan penting untuk serverless:
 * - Pool PostgreSQL dibuat sekali (module scope) lalu dipakai ulang antar-invocation.
 * - Pooler Supabase (Supavisor, port 5432 session / 6543 transaction) wajib dipakai karena
 *   alamat direct hanya IPv6 dan koneksi per-request akan cepat menghabiskan slot.
 */
'use strict';

process.env.VERCEL = '1';

let app;
try {
  // eslint-disable-next-line global-require
  app = require('../server/server.js');
} catch (e) {
  console.error('[vercel] gagal memuat server/server.js:', e);
  app = (req, res) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'Aplikasi gagal dimuat', detail: String(e.message || e) }));
  };
}

module.exports = app;
