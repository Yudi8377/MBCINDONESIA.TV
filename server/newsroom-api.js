/* ============================================================
   newsroom-api.js — API CMS & editorial Newsroom MBC INDONESIA
   ------------------------------------------------------------
   Modul ini mendaftarkan seluruh endpoint /api/newsroom/* ke app
   Express yang sudah memiliki middleware auth (requireAuth/requireRole).

   Cakupan:
     • CMS artikel: list/filter, detail, buat, ubah, status, jadwal,
       duplikat, hapus, revisi, preview publik
     • Taksonomi: kanal, tag, staf
     • Editorial: catatan, alur persetujuan 4 tahap, kalender & tugas
     • Media library
     • Analitik & laporan
     • Multi-agent AI: registry, run, pipeline, sweep, temuan
     • Moderasi komentar publik
   Semua mutasi tercatat di audit_log (append-only).
   ============================================================ */
'use strict';
const { AGENTS, runAgent, runPipeline, SWEEP_ORDER } = require('./agents');
/* Satu sumber kebenaran peran & izin (lihat server/peran.js).
   Peran baru (admin, pemred, redaktur, reporter) dipetakan ke izin yang sama,
   tanpa perlu ALTER constraint `users_role_check` di database. */
const RBAC = require('./peran');

module.exports = function mountNewsroom(app, ctx) {
  const { pool, requireAuth, requireRole, audit, LIBRARY = [] } = ctx;

  /* peran yang boleh masuk newsroom (dari modul RBAC) */
  const NEWSROOM_ROLES = RBAC.PERAN_NEWSROOM;      // admin, direksi, pemred, redaktur, reporter, editorial
  const EDIT_ROLES = NEWSROOM_ROLES;
  const APPROVER_ROLES = RBAC.PERAN_SETUJU;        // admin, direksi, pemred (bukan redaktur/reporter)

  /* gerbang peran untuk modul EDITORIAL (artikel, kalender, AI, moderasi, media).
     Aplikasi internal dipakai semua peran, tetapi data redaksi hanya untuk
     editorial & direksi — ditegakkan di server, bukan hanya disembunyikan di UI. */
  app.use('/api/newsroom', (req, res, next) => {
    if (req.path === '/gate' || req.path.startsWith('/public/') || req.path === '/public-list') return next();
    /* Registri dokumen 19 modul: izinnya per modul (RBAC.boleh) di server/newsroom-modul.js,
       jadi peran finance/sales tetap bisa memakai modul keuangan/komersialnya sendiri. */
    if (req.path === '/modul' || req.path.startsWith('/modul/')) return next();
    return requireAuth(req, res, () => {
      if (req.user && req.user.status && String(req.user.status).toLowerCase() === 'nonaktif') {
        return res.status(403).json({ error: 'Akun Anda dinonaktifkan. Hubungi administrator.' });
      }
      if (NEWSROOM_ROLES.includes(req.user.role)) return next();
      /* endpoint yang aman dibaca peran lain: hanya info ringan untuk UI */
      const OPEN_FOR_ALL = ['/overview', '/analytics', '/findings', '/media', '/taxonomy'];
      if (OPEN_FOR_ALL.includes(req.path) && req.method === 'GET') return next();
      return res.status(403).json({ error: 'Peran Anda tidak memiliki akses ke modul editorial' });
    });
  });

  const q = (sql, params) => pool.query(sql, params);
  const staffOf = async (email) => {
    if (!email) return null;
    const r = await q('SELECT display_name AS name, title FROM staff WHERE user_email=$1', [email]);
    return r.rows[0] || null;
  };
  const nameOf = (req) => (req.user && (req.user.name || req.user.email)) || 'System';

  /* bisa dites: apakah artikel sudah boleh tayang */
  function publishability(a) {
    const block = [];
    const checks = Array.isArray(a.fact_checks) ? a.fact_checks : [];
    const pending = checks.filter(c => !c.status || c.status === 'menunggu');
    if (pending.length) block.push(`${pending.length} klaim fakta belum diverifikasi`);
    const src = Array.isArray(a.sources) ? a.sources : [];
    if (src.length === 0) block.push('belum ada sumber tercatat');
    if (!a.body || String(a.body).trim().split(/\s+/).length < 120) block.push('naskah kurang dari 120 kata');
    return { can_publish: block.length === 0, blockers: block };
  }

  /* ---------------- CMS: daftar artikel ---------------- */
  app.get('/api/newsroom/articles', requireAuth, async (req, res) => {
    try {
      const { status, channel, q: search, author, limit = 100 } = req.query;
      const where = [], params = [];
      if (status && status !== 'semua') { params.push(String(status).split(',')); where.push(`a.status = ANY($${params.length})`); }
      if (channel && channel !== 'semua') { params.push(channel); where.push(`a.channel_id = $${params.length}`); }
      if (author) { params.push(author); where.push(`a.author_email = $${params.length}`); }
      if (search) { params.push('%' + search + '%'); where.push(`(a.title ILIKE $${params.length} OR a.deck ILIKE $${params.length} OR a.body ILIKE $${params.length})`); }
      params.push(Math.min(300, Number(limit) || 100));
      const sql = `
        SELECT a.id, a.slug, a.title, a.deck, a.status, a.priority, a.is_breaking, a.tags, a.hero_image,
               a.channel_id, c.name AS channel_name, c.color AS channel_color,
               a.author_email, s.display_name AS author_name, a.editor_email,
               a.word_count, a.read_time_min, a.views, a.created_at, a.updated_at, a.scheduled_at, a.published_at,
               jsonb_array_length(a.fact_checks) AS fact_total,
               (SELECT count(*) FROM editorial_notes n WHERE n.article_id=a.id AND n.resolved=false) AS open_notes,
               (SELECT count(*) FROM ai_findings f WHERE f.article_id=a.id AND f.status='baru') AS new_findings,
               (SELECT a2.ai_summary FROM articles a2 WHERE a2.id=a.id) AS ai_summary
        FROM articles a
        LEFT JOIN channels c ON c.id=a.channel_id
        LEFT JOIN staff s ON s.user_email=a.author_email
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY CASE a.status WHEN 'review' THEN 1 WHEN 'fakta' THEN 2 WHEN 'hukum' THEN 3 WHEN 'siap' THEN 4 WHEN 'terjadwal' THEN 5 ELSE 6 END,
                 a.updated_at DESC
        LIMIT $${params.length}`;
      const { rows } = await q(sql, params);
      res.json({ articles: rows });
    } catch (e) { res.status(500).json({ error: 'Gagal memuat artikel: ' + e.message }); }
  });

  /* ---------------- CMS: detail artikel ---------------- */
  app.get('/api/newsroom/articles/:id', requireAuth, async (req, res) => {
    try {
      const { rows } = await q(`SELECT a.*, c.name AS channel_name, c.color AS channel_color,
          s.display_name AS author_name, s.title AS author_title,
          e.display_name AS editor_name
        FROM articles a LEFT JOIN channels c ON c.id=a.channel_id
        LEFT JOIN staff s ON s.user_email=a.author_email
        LEFT JOIN staff e ON e.user_email=a.editor_email
        WHERE a.id::text=$1 OR a.slug=$1`, [String(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
      const a = rows[0];
      const [revs, notes, apprs, runs, finds, analytics] = await Promise.all([
        q('SELECT version,title,edited_by,note,created_at FROM article_revisions WHERE article_id=$1 ORDER BY version DESC', [a.id]),
        q('SELECT id,author,body,kind,resolved,created_at FROM editorial_notes WHERE article_id=$1 ORDER BY created_at DESC', [a.id]),
        q('SELECT stage,status,actor,note,created_at,decided_at FROM editorial_approvals WHERE article_id=$1 ORDER BY created_at', [a.id]),
        q('SELECT id,agent_id,status,duration_ms,created_by,created_at,output FROM ai_runs WHERE article_id=$1 ORDER BY created_at DESC LIMIT 12', [a.id]),
        q('SELECT id,agent_id,severity,title,detail,evidence,status,created_at FROM ai_findings WHERE article_id=$1 ORDER BY created_at DESC LIMIT 40', [a.id]),
        q('SELECT day,views,read_complete,shares,avg_scroll FROM content_analytics WHERE article_id=$1 ORDER BY day', [a.id])
      ]);
      res.json({
        article: a, revisions: revs.rows, notes, approvals: apprs.rows,
        ai_runs: runs.rows, findings: finds.rows, analytics: analytics.rows,
        publishability: publishability(a)
      });
    } catch (e) { res.status(500).json({ error: 'Gagal memuat detail: ' + e.message }); }
  });

  /* ---------------- CMS: buat / ubah ---------------- */
  const slugify = s => String(s).toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 90);

  app.post('/api/newsroom/articles', requireAuth, async (req, res) => {
    const b = req.body || {};
    if (!String(b.title || '').trim()) return res.status(400).json({ error: 'Judul wajib diisi' });
    try {
      const slug = (b.slug && slugify(b.slug)) || slugify(b.title) + '-' + Date.now().toString(36).slice(-4);
      const wc = String(b.body || '').trim().split(/\s+/).filter(Boolean).length;
      const { rows } = await q(`INSERT INTO articles(slug,title,deck,body,channel_id,author_email,status,priority,is_breaking,tags,hero_image,word_count,read_time_min)
        VALUES($1,$2,$3,$4,$5,$6,COALESCE($7,'draft'),COALESCE($8,'normal'),COALESCE($9,false),COALESCE($10::text[],'{}'),$11,$12,$13) RETURNING id,slug,status`,
        [slug, b.title, b.deck || '', b.body || '', b.channel_id || null, req.user.email, b.status, b.priority, b.is_breaking,
         Array.isArray(b.tags) ? b.tags : [], b.hero_image || '', wc, Math.max(1, Math.round(wc / 220))]);
      await q('INSERT INTO article_revisions(article_id,version,title,deck,body,edited_by,note) VALUES($1,1,$2,$3,$4,$5,$6)',
        [rows[0].id, b.title, b.deck || '', b.body || '', req.user.email, 'Versi awal']);
      await audit(`Newsroom: artikel dibuat — ${b.title}`, nameOf(req));
      res.status(201).json({ ok: true, article: rows[0] });
    } catch (e) { res.status(500).json({ error: 'Gagal membuat artikel: ' + e.message }); }
  });

  app.patch('/api/newsroom/articles/:id', requireAuth, async (req, res) => {
    const b = req.body || {};
    try {
      const cur = (await q('SELECT * FROM articles WHERE id=$1', [req.params.id])).rows[0];
      if (!cur) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
      const next = {
        title: b.title !== undefined ? b.title : cur.title,
        deck: b.deck !== undefined ? b.deck : cur.deck,
        body: b.body !== undefined ? b.body : cur.body,
        channel_id: b.channel_id !== undefined ? b.channel_id : cur.channel_id,
        priority: b.priority !== undefined ? b.priority : cur.priority,
        is_breaking: b.is_breaking !== undefined ? b.is_breaking : cur.is_breaking,
        tags: b.tags !== undefined ? b.tags : cur.tags,
        hero_image: b.hero_image !== undefined ? b.hero_image : cur.hero_image,
        seo_title: b.seo_title !== undefined ? b.seo_title : cur.seo_title,
        seo_desc: b.seo_desc !== undefined ? b.seo_desc : cur.seo_desc,
        sources: b.sources !== undefined ? JSON.stringify(b.sources) : JSON.stringify(cur.sources),
        fact_checks: b.fact_checks !== undefined ? JSON.stringify(b.fact_checks) : JSON.stringify(cur.fact_checks),
        scheduled_at: b.scheduled_at !== undefined ? (b.scheduled_at || null) : cur.scheduled_at
      };
      const wc = String(next.body || '').trim().split(/\s+/).filter(Boolean).length;
      await q(`UPDATE articles SET title=$1,deck=$2,body=$3,channel_id=$4,priority=$5,is_breaking=$6,tags=$7::text[],hero_image=$8,
        seo_title=$9,seo_desc=$10,sources=$11::jsonb,fact_checks=$12::jsonb,scheduled_at=$13,word_count=$14,read_time_min=$15,updated_at=now()
        WHERE id=$16`,
        [next.title, next.deck, next.body, next.channel_id, next.priority, next.is_breaking, next.tags, next.hero_image,
         next.seo_title, next.seo_desc, next.sources, next.fact_checks, next.scheduled_at, wc, Math.max(1, Math.round(wc / 220)), cur.id]);
      // simpan revisi bila isi berubah
      if (b.title !== undefined || b.body !== undefined || b.deck !== undefined) {
        const v = (await q('SELECT COALESCE(MAX(version),0)+1 AS v FROM article_revisions WHERE article_id=$1', [cur.id])).rows[0].v;
        await q('INSERT INTO article_revisions(article_id,version,title,deck,body,edited_by,note) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [cur.id, v, next.title, next.deck, next.body, req.user.email, b.revision_note || 'Penyuntingan']);
      }
      await audit(`Newsroom: artikel disunting — ${next.title}`, nameOf(req));
      res.json({ ok: true, word_count: wc });
    } catch (e) { res.status(500).json({ error: 'Gagal menyimpan: ' + e.message }); }
  });

  /* ---------------- CMS: ubah status (alur kerja) ---------------- */
  const FLOW = { ide: ['draft'], draft: ['review', 'ide'], review: ['fakta', 'draft'], fakta: ['hukum', 'review', 'siap'], hukum: ['siap', 'fakta'], siap: ['terjadwal', 'tayang', 'hukum'], terjadwal: ['tayang', 'siap'], tayang: ['arsip', 'ditarik'], arsip: ['draft'], ditarik: ['draft'] };

  app.post('/api/newsroom/articles/:id/status', requireAuth, async (req, res) => {
    const { status, note } = req.body || {};
    try {
      const a = (await q('SELECT * FROM articles WHERE id=$1', [req.params.id])).rows[0];
      if (!a) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
      if (!FLOW[a.status] || !FLOW[a.status].includes(status)) return res.status(409).json({ error: `Transisi ${a.status} → ${status} tidak sah` });
      /* RBAC: reporter hanya boleh menulis draf; memindahkan tahap & menerbitkan milik redaktur ke atas. */
      const peran = (req.user && req.user.role) || '';
      const hanyaDraf = !RBAC.boleh(peran, 'cms') || peran === 'reporter';
      if (hanyaDraf && ['review', 'fakta', 'hukum', 'siap', 'terjadwal', 'tayang', 'arsip', 'ditarik'].includes(status)) {
        return res.status(403).json({ error: `Peran ${RBAC.info(peran).nama} tidak boleh memindahkan status ke "${status}". Simpan sebagai draf atau minta redaktur.` });
      }
      if (status === 'tayang' && !RBAC.boleh(peran, 'setujui')) {
        return res.status(403).json({ error: 'Hanya pemimpin redaksi/direksi yang dapat menerbitkan artikel' });
      }
      if (status === 'tayang') {
        const p = publishability(a);
        if (!p.can_publish) return res.status(409).json({ error: 'Belum memenuhi syarat tayang: ' + p.blockers.join('; '), blockers: p.blockers });
      }
      if (['review', 'fakta', 'hukum', 'siap'].includes(status)) {
        // setiap perpindahan tahap membuat baris persetujuan "menunggu" pada tahap yang sesuai
        const STAGE = { review: 'redaktur', fakta: 'fakta', hukum: 'hukum', siap: 'pemimpin' };
        await q('INSERT INTO editorial_approvals(article_id,stage,status,actor,note) VALUES($1,$2,$3,$4,$5)',
          [a.id, STAGE[status], 'menunggu', null, '']);
      }
      const publishedAt = status === 'tayang' ? new Date() : a.published_at;
      await q('UPDATE articles SET status=$1, published_at=$2, updated_at=now() WHERE id=$3', [status, publishedAt, a.id]);
      await audit(`Newsroom: status "${a.title}" → ${status}${note ? ' — ' + note : ''}`, nameOf(req));
      res.json({ ok: true, status });
    } catch (e) { res.status(500).json({ error: 'Gagal mengubah status: ' + e.message }); }
  });

  app.post('/api/newsroom/articles/:id/duplicate', requireAuth, async (req, res) => {
    try {
      const a = (await q('SELECT * FROM articles WHERE id=$1', [req.params.id])).rows[0];
      if (!a) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
      const { rows } = await q(`INSERT INTO articles(slug,title,deck,body,channel_id,author_email,status,priority,tags,hero_image,word_count,read_time_min)
        VALUES($1,$2,$3,$4,$5,$6,'draft','normal',$7::text[],$8,$9,$10) RETURNING id`,
        [a.slug + '-salinan-' + Date.now().toString(36).slice(-4), '(Salinan) ' + a.title, a.deck, a.body, a.channel_id, req.user.email, a.tags, a.hero_image, a.word_count, a.read_time_min]);
      await audit(`Newsroom: artikel diduplikasi — ${a.title}`, nameOf(req));
      res.status(201).json({ ok: true, id: rows[0].id });
    } catch (e) { res.status(500).json({ error: 'Gagal menduplikasi: ' + e.message }); }
  });

  app.delete('/api/newsroom/articles/:id', requireAuth, (req, res, next) => {
    if (req.user.role === 'reporter') return res.status(403).json({ error: 'Reporter tidak boleh menghapus artikel' });
    next();
  }, async (req, res) => {
    try {
      const a = (await q('SELECT title,status FROM articles WHERE id=$1', [req.params.id])).rows[0];
      if (!a) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
      if (a.status === 'tayang') return res.status(409).json({ error: 'Artikel tayang tidak boleh dihapus — ubah ke "ditarik" atau "arsip" agar jejak editorial terjaga' });
      await q('DELETE FROM articles WHERE id=$1', [req.params.id]);
      await audit(`Newsroom: artikel dihapus — ${a.title}`, nameOf(req));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Gagal menghapus: ' + e.message }); }
  });

  /* ---------------- Daftar artikel tayang (untuk situs publik) ---------------- */
  app.get('/api/newsroom/public-list', async (req, res) => {
    try {
      const { rows } = await q(`SELECT a.slug, a.title, a.deck, a.body, a.tags, a.hero_image, a.published_at,
          a.ai_summary, a.read_time_min, c.name AS channel, c.color AS channel_color, s.display_name AS author,
          to_jsonb(a)->>'wilayah' AS wilayah
        FROM articles a LEFT JOIN channels c ON c.id=a.channel_id LEFT JOIN staff s ON s.user_email=a.author_email
        WHERE a.status='tayang' ORDER BY a.published_at DESC NULLS LAST LIMIT 24`);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json({ articles: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- CMS: preview publik ---------------- */
  app.get('/api/newsroom/public/:slug', async (req, res) => {
    try {
      const { rows } = await q(`SELECT a.slug,a.title,a.deck,a.body,a.tags,a.hero_image,a.published_at,a.ai_summary,
          c.name AS channel, s.display_name AS author
        FROM articles a LEFT JOIN channels c ON c.id=a.channel_id LEFT JOIN staff s ON s.user_email=a.author_email
        WHERE a.slug=$1 AND a.status='tayang'`, [req.params.slug]);
      if (!rows.length) return res.status(404).json({ error: 'Artikel belum tayang' });
      res.json({ article: rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Taksonomi & staf ---------------- */
  app.get('/api/newsroom/taxonomy', requireAuth, async (req, res) => {
    try {
      const [ch, tg, st] = await Promise.all([
        q('SELECT id,name,slug,description,color,sort_order FROM channels ORDER BY sort_order'),
        q('SELECT name,slug,usage_count FROM tags ORDER BY usage_count DESC, name LIMIT 60'),
        q('SELECT user_email,display_name,title,avatar_color,is_active FROM staff ORDER BY display_name')
      ]);
      res.json({ channels: ch.rows, tags: tg.rows, staff: st.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Editorial: catatan ---------------- */
  app.post('/api/newsroom/articles/:id/notes', requireAuth, async (req, res) => {
    const { body, kind = 'catatan' } = req.body || {};
    if (!String(body || '').trim()) return res.status(400).json({ error: 'Isi catatan wajib' });
    try {
      const { rows } = await q('INSERT INTO editorial_notes(article_id,author,body,kind) VALUES($1,$2,$3,$4) RETURNING id,created_at',
        [req.params.id, nameOf(req), body, kind]);
      await audit(`Newsroom: catatan editorial ditambahkan (${kind})`, nameOf(req));
      res.status(201).json({ ok: true, note: rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/newsroom/notes/:id', requireAuth, async (req, res) => {
    try {
      await q('UPDATE editorial_notes SET resolved=COALESCE($1,resolved) WHERE id=$2', [req.body.resolved, req.params.id]);
      await audit(`Newsroom: catatan editorial #${req.params.id} ${req.body.resolved ? 'diselesaikan' : 'dibuka kembali'}`, nameOf(req));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Editorial: alur persetujuan ---------------- */
  app.post('/api/newsroom/articles/:id/approvals', requireAuth, requireRole(...APPROVER_ROLES), async (req, res) => {
    const { stage, decision, note } = req.body || {};
    if (!['redaktur', 'fakta', 'hukum', 'pemimpin'].includes(stage)) return res.status(400).json({ error: 'Tahap tidak dikenal' });
    if (!['disetujui', 'ditolak', 'revisi'].includes(decision)) return res.status(400).json({ error: 'Keputusan tidak dikenal' });
    try {
      const a = (await q('SELECT * FROM articles WHERE id=$1', [req.params.id])).rows[0];
      if (!a) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
      await q(`INSERT INTO editorial_approvals(article_id,stage,status,actor,note,decided_at) VALUES($1,$2,$3,$4,$5,now())`,
        [a.id, stage, decision, nameOf(req), note || '']);
      // efek keputusan pada status artikel
      let next = a.status;
      if (decision === 'disetujui') {
        if (stage === 'redaktur' && a.status === 'review') next = 'fakta';
        else if (stage === 'fakta' && a.status === 'fakta') next = 'hukum';
        else if (stage === 'hukum' && a.status === 'hukum') next = 'siap';
      } else if (decision === 'revisi' || decision === 'ditolak') {
        next = 'draft';
      }
      if (next !== a.status) await q('UPDATE articles SET status=$1, updated_at=now() WHERE id=$2', [next, a.id]);
      await audit(`Newsroom: ${stage} ${decision} untuk "${a.title}"`, nameOf(req));
      res.json({ ok: true, status: next, stage, decision });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Editorial: papan kerja ---------------- */
  app.get('/api/newsroom/desk', requireAuth, async (req, res) => {
    try {
      const [byStatus, tasks, pending, notes, findings] = await Promise.all([
        q(`SELECT status, count(*)::int AS n FROM articles GROUP BY status`),
        q(`SELECT id,title,assignee,plan_date,slot,channel_id,status,angle FROM editorial_tasks
           WHERE plan_date >= CURRENT_DATE - 1 ORDER BY plan_date, CASE slot WHEN 'pagi' THEN 1 WHEN 'siang' THEN 2 WHEN 'sore' THEN 3 ELSE 4 END`),
        q(`SELECT ap.id, ap.stage, ap.status, ap.created_at, a.id AS article_id, a.title, a.status AS article_status
           FROM editorial_approvals ap JOIN articles a ON a.id=ap.article_id
           WHERE ap.status='menunggu' ORDER BY ap.created_at`),
        q(`SELECT n.id, n.author, n.body, n.kind, n.created_at, a.title FROM editorial_notes n JOIN articles a ON a.id=n.article_id
           WHERE n.resolved=false ORDER BY n.created_at DESC LIMIT 20`),
        q(`SELECT f.id, f.severity, f.title, f.agent_id, f.created_at, a.title AS article_title, a.id AS article_id
           FROM ai_findings f JOIN articles a ON a.id=f.article_id WHERE f.status='baru' ORDER BY
           CASE f.severity WHEN 'kritis' THEN 1 WHEN 'peringatan' THEN 2 WHEN 'saran' THEN 3 ELSE 4 END, f.created_at DESC LIMIT 30`)
      ]);
      const statusMap = Object.fromEntries(byStatus.rows.map(r => [r.status, r.n]));
      res.json({ status_counts: statusMap, tasks: tasks.rows, pending_approvals: pending.rows, open_notes: notes.rows, new_findings: findings.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Editorial: tugas & kalender ---------------- */
  app.post('/api/newsroom/tasks', requireAuth, async (req, res) => {
    const { title, assignee, plan_date, slot = 'pagi', channel_id, angle } = req.body || {};
    if (!title || !plan_date) return res.status(400).json({ error: 'Judul dan tanggal wajib' });
    try {
      const { rows } = await q(`INSERT INTO editorial_tasks(title,assignee,plan_date,slot,channel_id,angle) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [title, assignee || req.user.email, plan_date, slot, channel_id || null, angle || '']);
      await audit(`Newsroom: tugas editorial ditambahkan — ${title}`, nameOf(req));
      res.status(201).json({ ok: true, id: rows[0].id });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/newsroom/tasks/:id', requireAuth, async (req, res) => {
    const { status, assignee, plan_date, slot } = req.body || {};
    try {
      await q(`UPDATE editorial_tasks SET status=COALESCE($1,status), assignee=COALESCE($2,assignee),
        plan_date=COALESCE($3,plan_date), slot=COALESCE($4,slot) WHERE id=$5`, [status, assignee, plan_date, slot, req.params.id]);
      await audit(`Newsroom: tugas editorial #${req.params.id} diperbarui`, nameOf(req));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Media library ---------------- */
  app.get('/api/newsroom/media', requireAuth, async (req, res) => {
    try {
      const { kind, q: s } = req.query;
      const r = await q(`SELECT id,name,kind,path,size_kb,tags,credit,uploaded_by,created_at FROM media_assets
        WHERE ($1::text IS NULL OR kind=$1) AND ($2::text IS NULL OR name ILIKE '%'||$2||'%')
        ORDER BY created_at DESC LIMIT 200`, [kind || null, s || null]);
      res.json({ media: r.rows, total_kb: r.rows.reduce((a, x) => a + (x.size_kb || 0), 0) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/newsroom/media', requireAuth, async (req, res) => {
    const { name, kind = 'gambar', path: p, tags = [], credit = '' } = req.body || {};
    if (!name || !p) return res.status(400).json({ error: 'Nama dan path wajib' });
    try {
      const { rows } = await q('INSERT INTO media_assets(name,kind,path,tags,credit,uploaded_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
        [name, kind, p, tags, credit, req.user.email]);
      await audit(`Newsroom: aset media ditambahkan — ${name}`, nameOf(req));
      res.status(201).json({ ok: true, id: rows[0].id });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/newsroom/media/:id', requireAuth, async (req, res) => {
    try {
      const m = (await q('SELECT name FROM media_assets WHERE id=$1', [req.params.id])).rows[0];
      if (!m) return res.status(404).json({ error: 'Aset tidak ditemukan' });
      await q('DELETE FROM media_assets WHERE id=$1', [req.params.id]);
      await audit(`Newsroom: aset media dihapus — ${m.name}`, nameOf(req));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Analitik ---------------- */
  app.get('/api/newsroom/analytics', requireAuth, async (req, res) => {
    try {
      const [daily, top, byChannel, sum] = await Promise.all([
        q(`SELECT day, SUM(views)::int AS views, SUM(read_complete)::int AS read_complete, SUM(shares)::int AS shares
           FROM content_analytics GROUP BY day ORDER BY day`),
        q(`SELECT a.title, a.slug, SUM(ca.views)::int AS views, ROUND(AVG(ca.avg_scroll))::int AS avg_scroll,
                  ROUND(AVG(ca.read_complete::numeric / NULLIF(ca.views,0) * 100))::int AS completion
           FROM content_analytics ca JOIN articles a ON a.id=ca.article_id
           GROUP BY a.id, a.title, a.slug ORDER BY views DESC LIMIT 8`),
        q(`SELECT c.name AS channel, c.color, SUM(ca.views)::int AS views
           FROM content_analytics ca JOIN articles a ON a.id=ca.article_id JOIN channels c ON c.id=a.channel_id
           GROUP BY c.name, c.color ORDER BY views DESC`),
        q(`SELECT (SELECT count(*) FROM articles WHERE status='tayang')::int AS tayang,
                  (SELECT count(*) FROM articles WHERE status IN ('review','fakta','hukum','siap'))::int AS pipeline,
                  (SELECT count(*) FROM editorial_tasks WHERE status<>'selesai')::int AS tugas_aktif,
                  (SELECT count(*) FROM ai_findings WHERE status='baru')::int AS temuan_baru,
                  (SELECT count(*) FROM comments)::int AS komentar`)
      ]);
      res.json({ daily: daily.rows, top_articles: top.rows, by_channel: byChannel.rows, summary: sum.rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Antrean publik: kiriman kontributor & laporan konten (1.4.16) ---------------- */
  app.get('/api/newsroom/antrean', requireAuth, async (req, res) => {
    try {
      const rows = await q(`SELECT id, severity, title, detail, evidence, status, created_at
        FROM ai_findings WHERE evidence->>'jenis' IN ('kontributor','laporan')
        ORDER BY (status='baru') DESC, created_at DESC LIMIT 100`);
      const kiriman = rows.rows.filter(r => r.evidence && r.evidence.jenis === 'kontributor');
      const laporan = rows.rows.filter(r => r.evidence && r.evidence.jenis === 'laporan');
      res.json({ kiriman, laporan });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/newsroom/antrean/:id', requireAuth, async (req, res) => {
    try {
      const status = ['baru', 'dibaca', 'diterapkan', 'diabaikan'].includes((req.body || {}).status) ? req.body.status : 'dibaca';
      const r = await q('UPDATE ai_findings SET status=$1 WHERE id=$2 AND evidence->>\'jenis\' IN (\'kontributor\',\'laporan\') RETURNING id', [status, Number(req.params.id)]);
      if (!r.rowCount) return res.status(404).json({ error: 'Antrean tidak ditemukan' });
      await q('INSERT INTO audit_log(action, who) VALUES($1,$2)', ['antrean:' + status, (req.user && req.user.email) || 'operator']);
      res.json({ ok: true, status });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Multi-agent AI ---------------- */
  app.get('/api/newsroom/ai/agents', requireAuth, async (req, res) => {
    try {
      const reg = await q(`SELECT g.id,g.name,g.role,g.description,g.icon,g.color,g.is_enabled,g.run_count,g.last_run_at,
        (SELECT count(*) FROM ai_findings f WHERE f.agent_id=g.id AND f.status='baru')::int AS open_findings
        FROM ai_agents g ORDER BY g.name`);
      res.json({ agents: reg.rows, library_size: LIBRARY.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/newsroom/ai/findings', requireAuth, async (req, res) => {
    try {
      const { status = 'baru', severity, agent } = req.query;
      const r = await q(`SELECT f.id,f.article_id,f.agent_id,f.severity,f.title,f.detail,f.evidence,f.status,f.created_at,
          a.title AS article_title, a.status AS article_status, g.name AS agent_name, g.icon AS agent_icon, g.color AS agent_color
        FROM ai_findings f JOIN articles a ON a.id=f.article_id JOIN ai_agents g ON g.id=f.agent_id
        WHERE ($1::text IS NULL OR f.status=$1) AND ($2::text IS NULL OR f.severity=$2) AND ($3::text IS NULL OR f.agent_id=$3)
        ORDER BY CASE f.severity WHEN 'kritis' THEN 1 WHEN 'peringatan' THEN 2 WHEN 'saran' THEN 3 ELSE 4 END, f.created_at DESC
        LIMIT 80`, [status === 'semua' ? null : status, severity || null, agent || null]);
      res.json({ findings: r.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.patch('/api/newsroom/ai/findings/:id', requireAuth, async (req, res) => {
    const { status } = req.body || {};
    if (!['baru', 'dibaca', 'diterapkan', 'diabaikan'].includes(status)) return res.status(400).json({ error: 'Status tidak dikenal' });
    try {
      await q('UPDATE ai_findings SET status=$1 WHERE id=$2', [status, req.params.id]);
      await audit(`Newsroom: temuan AI #${req.params.id} → ${status}`, nameOf(req));
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* jalankan satu agen / pipeline penuh pada satu artikel */
  async function executeAgents(articleId, agentIds, trigger, actor) {
    const a = (await q('SELECT * FROM articles WHERE id=$1', [articleId])).rows[0];
    if (!a) throw new Error('Artikel tidak ditemukan');
    const results = runPipeline(a, LIBRARY, agentIds);
    const saved = { runs: [], findings: 0 };
    for (const r of results) {
      const { rows } = await q(`INSERT INTO ai_runs(agent_id,article_id,trigger,status,input,output,duration_ms,created_by)
        VALUES($1,$2,$3,'selesai',$4::jsonb,$5::jsonb,$6,$7) RETURNING id`,
        [r.agent, a.id, trigger, JSON.stringify({ title: a.title, words: a.word_count || 0 }), JSON.stringify(r.output), r.duration_ms, actor]);
      for (const f of r.findings) {
        await q(`INSERT INTO ai_findings(article_id,agent_id,severity,title,detail,evidence) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
          [a.id, r.agent, f.severity, f.title, f.detail || '', JSON.stringify(f.evidence || [])]);
        saved.findings++;
      }
      await q('UPDATE ai_agents SET run_count=run_count+1, last_run_at=now() WHERE id=$1', [r.agent]);
      saved.runs.push({ run_id: rows[0].id, agent: r.agent, duration_ms: r.duration_ms, output: r.output, findings: r.findings });
    }
    // sinkronkan ringkasan AI ke artikel bila agen ringkas ikut jalan
    const ringkas = results.find(r => r.agent === 'ringkas');
    if (ringkas) {
      await q(`UPDATE articles SET ai_summary=$1, ai_sentiment=$2, ai_keywords=$3::text[], updated_at=now() WHERE id=$4`,
        [ringkas.output.summary, (results.find(r => r.agent === 'sentimen') || {}).output?.sentiment || '', ringkas.output.keywords || [], a.id]);
    }
    await audit(`Newsroom AI: ${agentIds ? agentIds.join('+') : 'pipeline penuh'} dijalankan untuk "${a.title}" (${saved.findings} temuan)`, actor);
    return saved;
  }

  app.post('/api/newsroom/ai/run', requireAuth, async (req, res) => {
    const { article_id, agent } = req.body || {};
    if (!article_id || !agent) return res.status(400).json({ error: 'article_id dan agent wajib' });
    if (!AGENTS[agent]) return res.status(400).json({ error: 'Agen tidak dikenal' });
    try {
      const out = await executeAgents(article_id, [agent], 'manual', nameOf(req));
      res.json({ ok: true, ...out });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/newsroom/ai/pipeline', requireAuth, async (req, res) => {
    const { article_id, agents } = req.body || {};
    if (!article_id) return res.status(400).json({ error: 'article_id wajib' });
    try {
      const ids = Array.isArray(agents) && agents.length ? agents.filter(a => AGENTS[a]) : null;
      const out = await executeAgents(article_id, ids, 'manual', nameOf(req));
      res.json({ ok: true, ...out });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* sweep: jalankan agen prioritas pada semua artikel yang belum tayang */
  app.post('/api/newsroom/ai/sweep', requireAuth, async (req, res) => {
    try {
      const arts = await q(`SELECT id,title FROM articles WHERE status IN ('draft','review','fakta','hukum','siap','terjadwal') ORDER BY updated_at DESC LIMIT 25`);
      let findings = 0; const processed = [];
      for (const a of arts.rows) {
        const out = await executeAgents(a.id, SWEEP_ORDER, 'sweep', nameOf(req));
        findings += out.findings; processed.push({ id: a.id, title: a.title, findings: out.findings });
      }
      res.json({ ok: true, articles: processed.length, findings, detail: processed });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Orkestrasi: antrean tugas agen ---------------- */
  app.post('/api/newsroom/ai/jobs', requireAuth, async (req, res) => {
    const { agent, article_id } = req.body || {};
    if (!AGENTS[agent]) return res.status(400).json({ error: 'Agen tidak dikenal' });
    try {
      const { rows } = await q(`INSERT INTO agent_jobs(agent_id,article_id,created_by) VALUES($1,$2,$3) RETURNING id`,
        [agent, article_id || null, nameOf(req)]);
      res.status(201).json({ ok: true, job_id: rows[0].id, note: 'Tugas masuk antrean; jalankan POST /api/newsroom/ai/jobs/process untuk memproses.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/newsroom/ai/jobs/process', requireAuth, async (req, res) => {
    try {
      const jobs = await q(`SELECT id,agent_id,article_id FROM agent_jobs WHERE status='antre' ORDER BY priority, created_at LIMIT 10`);
      const done = [];
      for (const j of jobs.rows) {
        try {
          if (!j.article_id) { await q(`UPDATE agent_jobs SET status='gagal', finished_at=now() WHERE id=$1`, [j.id]); continue; }
          await executeAgents(j.article_id, [j.agent_id], 'otomatis', nameOf(req));
          await q(`UPDATE agent_jobs SET status='selesai', finished_at=now() WHERE id=$1`, [j.id]);
          done.push(j.id);
        } catch (_) { await q(`UPDATE agent_jobs SET status='gagal', finished_at=now() WHERE id=$1`, [j.id]); }
      }
      res.json({ ok: true, processed: done.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Moderasi komentar publik ---------------- */
  app.get('/api/newsroom/moderation', requireAuth, async (req, res) => {
    try {
      const r = await q(`SELECT c.id, c.author, c.body, c.created_at, c.program_id,
          COALESCE(m.status,'menunggu') AS status, m.reason, m.moderated_by, m.moderated_at
        FROM comments c LEFT JOIN comment_moderation m ON m.comment_id=c.id
        ORDER BY CASE COALESCE(m.status,'menunggu') WHEN 'menunggu' THEN 1 WHEN 'tayang' THEN 2 ELSE 3 END, c.created_at DESC
        LIMIT 100`);
      res.json({ comments: r.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/newsroom/moderation/:id', requireAuth, async (req, res) => {
    const { status, reason = '' } = req.body || {};
    if (!['tayang', 'sembunyi', 'spam', 'menunggu'].includes(status)) return res.status(400).json({ error: 'Status tidak dikenal' });
    try {
      await q(`INSERT INTO comment_moderation(comment_id,status,reason,moderated_by,moderated_at) VALUES($1,$2,$3,$4,now())
        ON CONFLICT (comment_id) DO UPDATE SET status=EXCLUDED.status, reason=EXCLUDED.reason, moderated_by=EXCLUDED.moderated_by, moderated_at=now()`,
        [req.params.id, status, reason, nameOf(req)]);
      await audit(`Newsroom: komentar #${req.params.id} → ${status}${reason ? ' (' + reason + ')' : ''}`, nameOf(req));
      res.json({ ok: true, status });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------------- Ringkasan dashboard newsroom ---------------- */
  app.get('/api/newsroom/overview', requireAuth, async (req, res) => {
    try {
      const [counts, today, agents, topFind] = await Promise.all([
        q(`SELECT
            (SELECT count(*) FROM articles)::int AS total,
            (SELECT count(*) FROM articles WHERE status='tayang')::int AS tayang,
            (SELECT count(*) FROM articles WHERE status IN ('draft','ide'))::int AS draf,
            (SELECT count(*) FROM articles WHERE status IN ('review','fakta','hukum','siap'))::int AS menunggu,
            (SELECT count(*) FROM editorial_tasks WHERE plan_date=CURRENT_DATE)::int AS tugas_hari_ini,
            (SELECT count(*) FROM editorial_notes WHERE resolved=false)::int AS catatan_terbuka,
            (SELECT count(*) FROM comments)::int AS komentar,
            (SELECT count(*) FROM media_assets)::int AS aset`),
        q(`SELECT SUM(views)::int AS views FROM content_analytics WHERE day=CURRENT_DATE`),
        q(`SELECT g.id,g.name,g.icon,g.color,g.run_count,g.last_run_at,
             (SELECT count(*) FROM ai_findings f WHERE f.agent_id=g.id AND f.status='baru')::int AS open_findings
           FROM ai_agents g ORDER BY open_findings DESC, g.name`),
        q(`SELECT f.severity, count(*)::int AS n FROM ai_findings f WHERE f.status='baru' GROUP BY f.severity`)
      ]);
      res.json({
        counts: counts.rows[0], views_today: today.rows[0].views || 0,
        agents: agents.rows, findings_by_severity: Object.fromEntries(topFind.rows.map(r => [r.severity, r.n]))
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return { NEWSROOM_ROLES, RBAC };
};
