/* ============================================================
   newsroom-agen.js — Endpoint Multi-Agen AI untuk staf editorial
   ------------------------------------------------------------
   Semua endpoint WAJIB token staf CMS (requireAuth) dan hanya
   untuk peran editorial/direksi — ditegakkan di server.

     GET  /api/newsroom/agen/daftar        daftar 6 agen + status LLM
     POST /api/newsroom/agen/jalankan      { artikel_id } atau { teks, judul }
     POST /api/newsroom/agen/cari          { q } → artikel terkait di CMS
     POST /api/newsroom/agen/simpan        temuan terpilih → ai_findings
     GET  /api/newsroom/agen/riwayat       jejak 30 jalannya terakhir

   Prinsip keselamatan:
     - agen TIDAK PERNAH menerbitkan artikel atau mengubah naskah;
       ia hanya memberi bahan untuk diputuskan manusia.
     - setiap jalan tercatat di audit_log (siapa, agen apa, artikel mana).
     - naskah tidak dikirim ke pihak ketiga bila LLM tidak dikonfigurasi.
   ============================================================ */
'use strict';
const { DAFTAR_AGEN, AGEN, jalankanBanyak, jalankanAgen, statusLLM, cariArtikel } = require('./agen-ai');

module.exports = function mountAgen(app, ctx) {
  const { pool, requireAuth, audit } = ctx;
  const q = (sql, params) => pool.query(sql, params);
  const PERAN = ['editorial', 'direksi'];
  const nama = req => (req.user && (req.user.name || req.user.email)) || 'operator';

  /* gerbang peran: satu tempat, tidak bisa dilewati dari UI */
  app.use('/api/newsroom/agen', requireAuth, (req, res, next) => {
    if (!PERAN.includes(req.user && req.user.role)) {
      return res.status(403).json({ error: 'Multi-agen AI hanya untuk staf editorial/direksi' });
    }
    next();
  });

  app.get('/api/newsroom/agen/daftar', (req, res) => {
    res.json({ agen: DAFTAR_AGEN, llm: statusLLM() });
  });

  /* Jalankan agen atas satu artikel CMS, atau atas teks bebas (draf) */
  app.post('/api/newsroom/agen/jalankan', async (req, res) => {
    const { artikel_id, agen, teks, judul, dek, pakai_llm } = req.body || {};
    const ids = Array.isArray(agen) && agen.length ? agen.filter(a => AGEN[a]) : null;
    if (Array.isArray(agen) && agen.length && !ids.length) return res.status(400).json({ error: 'Tidak ada agen yang dikenal pada permintaan' });
    try {
      let artikel = null, asal = 'teks';
      if (artikel_id) {
        const { rows } = await q(`SELECT a.*, c.name AS channel_name FROM articles a LEFT JOIN channels c ON c.id=a.channel_id WHERE a.id=$1`, [artikel_id]);
        if (!rows[0]) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
        artikel = { ...rows[0], channel: rows[0].channel_name || rows[0].channel };
        asal = 'artikel';
      } else {
        if (!teks || String(teks).trim().length < 40) return res.status(400).json({ error: 'Kirim artikel_id atau teks minimal 40 karakter' });
        artikel = { title: String(judul || 'Draf tanpa judul').slice(0, 200), deck: String(dek || '').slice(0, 400), body: String(teks).slice(0, 40000), tags: [], sources: [] };
      }
      const hasil = await jalankanBanyak(ids, artikel, { pakaiLLM: pakai_llm !== false });
      const jumlahTemuan = hasil.reduce((n, h) => n + (h.temuan ? h.temuan.length : 0), 0);
      await audit(`Agen AI (${hasil.map(h => h.agent).join('+')}) memeriksa ${asal === 'artikel' ? 'artikel #' + artikel_id : 'draf teks'}: ${jumlahTemuan} temuan`, nama(req));

      /* simpan jejak bila ini artikel CMS; draf teks tidak disimpan agar tidak mengotori data */
      if (asal === 'artikel') {
        for (const h of hasil) {
          if (h.error) continue;
          try {
            await q(`INSERT INTO ai_runs(agent_id,article_id,trigger,status,input,output,duration_ms,created_by)
              VALUES($1,$2,'manual','selesai',$3::jsonb,$4::jsonb,$5,$6)`,
              [h.agent, artikel_id, JSON.stringify({ title: artikel.title }), JSON.stringify({ ringkas: h.ringkas, data: h.data, sumber: h.sumber }), h.durasi_ms || 0, nama(req)]);
            await q('UPDATE ai_agents SET run_count=run_count+1, last_run_at=now() WHERE id=$1', [h.agent]);
          } catch (_) { /* tabel agen lama boleh tidak ada — hasil tetap dikembalikan */ }
        }
      }
      res.json({ ok: true, asal, artikel: { id: artikel.id || null, judul: artikel.title }, llm: statusLLM(), hasil });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* Cari artikel CMS terkait (bahan "Pencari Berita") */
  app.post('/api/newsroom/agen/cari', async (req, res) => {
    const { q: kueri, batas } = req.body || {};
    if (!kueri || String(kueri).trim().length < 3) return res.status(400).json({ error: 'Kata kunci minimal 3 karakter' });
    try {
      const { rows } = await q(`SELECT id, slug, title, status, (left(coalesce(deck,''),180)) AS deck, published_at
        FROM articles ORDER BY id DESC LIMIT 400`);
      const hasil = cariArtikel(rows, kueri, Math.min(20, Number(batas) || 8));
      res.json({ ok: true, kueri, hasil });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* Simpan temuan pilihan ke ai_findings (agar masuk kotak temuan & bisa ditindaklanjuti) */
  app.post('/api/newsroom/agen/simpan', async (req, res) => {
    const { artikel_id, temuan } = req.body || {};
    if (!artikel_id || !Array.isArray(temuan) || !temuan.length) return res.status(400).json({ error: 'artikel_id dan temuan wajib' });
    const SAH_TINGKAT = ['info', 'saran', 'peringatan', 'kritis'];
    let disimpan = 0;
    try {
      for (const t of temuan.slice(0, 40)) {
        const agen = String(t.agent || '').trim();
        if (!AGEN[agen]) continue;
        const tingkat = SAH_TINGKAT.includes(t.tingkat) ? t.tingkat : 'saran';
        const judul = String(t.judul || 'Temuan agen').slice(0, 200);
        const rincian = String(t.rincian || '').slice(0, 2000);
        const bukti = JSON.stringify(Array.isArray(t.bukti) ? t.bukti.slice(0, 20) : []);
        try {
          await q(`INSERT INTO ai_findings(article_id,agent_id,severity,title,detail,evidence) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
            [artikel_id, agen, tingkat, judul, rincian, bukti]);
          disimpan++;
        } catch (e) {
          /* agen baru (mis. "klarifikasi") mungkin belum ada di tabel ai_agents → daftarkan dulu */
          if (/ai_agents|foreign key/i.test(e.message)) {
            const a = AGEN[agen];
            await q(`INSERT INTO ai_agents(id,name,role,description,icon,color) VALUES($1,$2,$3,$4,$5,$6)
              ON CONFLICT (id) DO NOTHING`, [a.id, a.nama, a.peran, a.deskripsi, a.ikon, a.warna]);
            await q(`INSERT INTO ai_findings(article_id,agent_id,severity,title,detail,evidence) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
              [artikel_id, agen, tingkat, judul, rincian, bukti]);
            disimpan++;
          } else throw e;
        }
      }
      await audit(`Agen AI: ${disimpan} temuan disimpan untuk artikel #${artikel_id}`, nama(req));
      res.json({ ok: true, disimpan });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* Riwayat jalan agen (30 terakhir) */
  app.get('/api/newsroom/agen/riwayat', async (req, res) => {
    try {
      const { rows } = await q(`SELECT r.id, r.agent_id, r.article_id, r.duration_ms, r.created_by, r.created_at,
          a.title AS article_title, (r.output->>'ringkas') AS ringkas, (r.output->>'sumber') AS sumber
        FROM ai_runs r LEFT JOIN articles a ON a.id=r.article_id
        ORDER BY r.id DESC LIMIT 30`);
      res.json({ riwayat: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
};
