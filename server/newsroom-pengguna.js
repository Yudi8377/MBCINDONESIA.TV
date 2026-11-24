/* ============================================================
   newsroom-pengguna.js — Panel Administrator: pengguna & peran
   ------------------------------------------------------------
   Semua endpoint WAJIB token staf DAN peran `admin`
   (RBAC dari server/peran.js, ditegakkan di server).

     GET   /api/newsroom/pengguna            daftar akun staf + peran
     GET   /api/newsroom/pengguna/peran      matriks izin (untuk UI/dokumentasi)
     PATCH /api/newsroom/pengguna/:id/peran  ubah peran & label jabatan
     POST  /api/newsroom/pengguna/:id/status aktif/nonaktifkan akun
     POST  /api/newsroom/pengguna/:id/sandi  setel ulang kata sandi

   Keselamatan:
     - tidak bisa menurunkan/menonaktifkan diri sendiri (mencegah terkunci)
     - administrator terakhir tidak bisa dicabut
     - sandi minimum 8 karakter (huruf + angka), disimpan bcrypt
     - setiap perubahan dicatat di audit_log
     - peran baru disimpan lewat penanda `mbc:role=` pada label jabatan
       (kolom `staff.title`, cadangan `users.role_label`) supaya tidak
       melanggar constraint `users_role_check` milik database
     - kolom opsional (`status`, `updated_at`) dideteksi lebih dulu:
       bila belum ada, endpoint yang membutuhkannya menjawab 501 dengan
       petunjuk migrasi — bukan error 500 yang membingungkan.
   ============================================================ */
'use strict';

const crypto = require('crypto');
const RBAC = require('./peran');

let bcrypt = null;
try { bcrypt = require('bcryptjs'); } catch (_) { bcrypt = null; }

module.exports = function mountPengguna(app, ctx) {
  const { pool, requireAuth, audit } = ctx;
  const q = (sql, params) => pool.query(sql, params);
  const nama = req => (req.user && (req.user.name || req.user.email)) || 'operator';
  const COST = 12;

  /* gerbang: hanya admin */
  app.use('/api/newsroom/pengguna', requireAuth, (req, res, next) => {
    if (!RBAC.boleh(req.user && req.user.role, 'kelola_pengguna')) {
      return res.status(403).json({ error: 'Hanya administrator yang boleh mengelola pengguna & peran' });
    }
    next();
  });

  /* deteksi kolom yang tersedia (tanpa menebak) */
  let kolomCache = null;
  async function kolom() {
    if (kolomCache) return kolomCache;
    const { rows } = await q(`SELECT column_name FROM information_schema.columns
      WHERE table_name='users' AND column_name IN ('status','updated_at','role_label','pass_hash','last_login','created_at')`);
    kolomCache = new Set(rows.map(r => r.column_name));
    return kolomCache;
  }

  /* ---------- simpan jabatan/peran efektif ----------
     Prioritas: tabel `staff.title` (bebas, tanpa constraint).
     Cadangan: `users.role_label` + `users.role` = nilai aman constraint.     */
  let adaStaff = null;
  async function simpanLabel(id, email, peran, teksJabatan) {
    const info = RBAC.jabatan(peran, teksJabatan);
    if (adaStaff === null) {
      const { rows } = await q(`SELECT 1 FROM information_schema.tables WHERE table_name='staff'`);
      adaStaff = rows.length > 0;
    }
    if (!adaStaff) {
      /* Tanpa tabel staff (mis. instalasi lama) — semua disimpan di users.
         Bila database menolak nilai peran (constraint users_role_check),
         label tetap disimpan dengan penanda agar peran efektif masih benar. */
      const k = await kolom();
      const sql = (role, label) => k.has('updated_at')
        ? q('UPDATE users SET role=$1, role_label=$2, updated_at=now() WHERE id=$3', [role, label, id])
        : q('UPDATE users SET role=$1, role_label=$2 WHERE id=$3', [role, label, id]);
      try {
        await sql(info.peranDb, info.label);
      } catch (e) {
        await sql('editorial', info.label);
        info.peranDb = 'editorial';
      }
    } else {
      const ada = await q('SELECT id FROM staff WHERE lower(user_email)=lower($1)', [email]);
      if (ada.rows.length) {
        await q('UPDATE staff SET title=$1 WHERE id=$2', [info.label, ada.rows[0].id]);
      } else {
        const u = await q('SELECT name FROM users WHERE id=$1', [id]);
        await q('INSERT INTO staff(user_email, display_name, title, is_active) VALUES($1,$2,$3,true)',
          [email, (u.rows[0] && u.rows[0].name) || email, info.label]);
      }
      /* users.role di nilai aman; users.role_label = jabatan bersih */
      await q('UPDATE users SET role=$1, role_label=$2 WHERE id=$3', [info.peranDb, info.jabatan, id]);
    }
    return info;
  }

  const adaMigrasi = async () => {
    const k = await kolom();
    return { status: k.has('status'), updated_at: k.has('updated_at'), last_login: k.has('last_login') };
  };

  /* ---------- daftar akun ---------- */
  app.get('/api/newsroom/pengguna', async (req, res) => {
    try {
      const k = await kolom();
      const pilih = ['id', 'email', 'name', 'role', 'role_label'];
      if (k.has('status')) pilih.push('status');
      if (k.has('last_login')) pilih.push('last_login');
      if (k.has('created_at')) pilih.push('created_at');
      const { rows } = await q(`SELECT ${pilih.map(k => 'u.' + k).join(', ')}, s.title AS staff_title
        FROM users u LEFT JOIN staff s ON lower(s.user_email) = lower(u.email) ORDER BY name`);
      const staf = rows.map(u => {
        const peran = RBAC.dariBaris({ role: u.role, role_label: u.staff_title || u.role_label });
        return {
        id: u.id, email: u.email, nama: u.name,
        peran, peran_nama: RBAC.info(peran).nama,
        jabatan: RBAC.labelBersih(u.staff_title || u.role_label) || RBAC.info(peran).nama,
        status: u.status || 'aktif',
        anggota_publik: String(u.role_label || '').startsWith('Anggota Publik'),
        terakhir_masuk: u.last_login || null,
        dibuat: u.created_at || null
      };
      });
      res.json({
        pengguna: staf,
        total: staf.length,
        peran: RBAC.matriks(),
        kolom: RBAC.KOLOM_MATRIKS,
        migrasi: await adaMigrasi(),
        saya: { email: req.user.email, peran: req.user.role }
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- matriks peran (tanpa data pribadi) ---------- */
  app.get('/api/newsroom/pengguna/peran', (req, res) => {
    res.json({ peran: RBAC.matriks(), kolom: RBAC.KOLOM_MATRIKS });
  });

  /* ---------- ubah peran ---------- */
  app.patch('/api/newsroom/pengguna/:id/peran', async (req, res) => {
    const id = Number(req.params.id);
    const { peran, jabatan } = req.body || {};
    if (!RBAC.SEMUA_PERAN.includes(peran)) return res.status(400).json({ error: 'Peran tidak dikenal: ' + peran });
    try {
      const { rows } = await q(`SELECT u.id, u.email, u.name, u.role, u.role_label, s.title AS staff_title
        FROM users u LEFT JOIN staff s ON lower(s.user_email)=lower(u.email) WHERE u.id=$1`, [id]);
      const u = rows[0];
      if (u) u.role_label = u.staff_title || u.role_label;
      if (!u) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      if (Number(req.user.sub) === id && !RBAC.boleh(peran, 'kelola_pengguna')) {
        return res.status(409).json({ error: 'Anda tidak bisa menurunkan peran Anda sendiri — minta administrator lain.' });
      }
      /* administrator terakhir tidak boleh hilang */
      const peranLama = RBAC.dariBaris(u);
      if (RBAC.boleh(peranLama, 'kelola_pengguna') && !RBAC.boleh(peran, 'kelola_pengguna')) {
        const { rows: adm } = await q(`SELECT count(*)::int AS n FROM users u LEFT JOIN staff s ON lower(s.user_email)=lower(u.email)
          WHERE (u.role='admin' OR coalesce(s.title,'') LIKE '%mbc:role=admin%' OR coalesce(u.role_label,'') LIKE '%mbc:role=admin%')
            AND (u.status IS NULL OR u.status='aktif')`);
        if (adm[0].n <= 1) return res.status(409).json({ error: 'Ini administrator terakhir. Angkat administrator lain dulu sebelum mengubah peran ini.' });
      }
      const info = await simpanLabel(id, u.email, peran, String(jabatan || '').trim().slice(0, 80));
      const lamaPeran = RBAC.dariBaris(u);
      await audit(`Pengguna: ${u.email} — peran ${lamaPeran} → ${peran} (${info.jabatan}) oleh ${nama(req)}`, nama(req));
      res.json({ ok: true, pengguna: { id, email: u.email, nama: u.name, peran, peran_nama: RBAC.info(peran).nama, jabatan: info.jabatan } });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- aktif / nonaktifkan ---------- */
  app.post('/api/newsroom/pengguna/:id/status', async (req, res) => {
    const id = Number(req.params.id);
    const status = String((req.body || {}).status || '').toLowerCase();
    if (!['aktif', 'nonaktif'].includes(status)) return res.status(400).json({ error: 'Status harus "aktif" atau "nonaktif"' });
    try {
      const k = await kolom();
      if (!k.has('status')) {
        return res.status(501).json({
          error: 'Kolom users.status belum ada. Jalankan migrasi docs/MIGRASI-1.6.1.sql lalu coba lagi.',
          migrasi: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT \'aktif\';'
        });
      }
      const { rows } = await q(`SELECT u.id, u.email, u.name, u.role, u.role_label, s.title AS staff_title
        FROM users u LEFT JOIN staff s ON lower(s.user_email)=lower(u.email) WHERE u.id=$1`, [id]);
      const u = rows[0];
      if (u) u.role_label = u.staff_title || u.role_label;
      if (!u) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      if (Number(req.user.sub) === id) return res.status(409).json({ error: 'Anda tidak bisa menonaktifkan akun Anda sendiri.' });
      if (RBAC.boleh(RBAC.dariBaris(u), 'kelola_pengguna') && status === 'nonaktif') {
        const { rows: adm } = await q(`SELECT count(*)::int AS n FROM users u LEFT JOIN staff s ON lower(s.user_email)=lower(u.email)
          WHERE (u.role='admin' OR coalesce(s.title,'') LIKE '%mbc:role=admin%' OR coalesce(u.role_label,'') LIKE '%mbc:role=admin%')
            AND (u.status IS NULL OR u.status='aktif')`);
        if (adm[0].n <= 1) return res.status(409).json({ error: 'Ini administrator aktif terakhir — tidak bisa dinonaktifkan.' });
      }
      await q('UPDATE users SET status=$1 WHERE id=$2', [status, id]);
      await audit(`Pengguna: ${u.email} → ${status} oleh ${nama(req)}`, nama(req));
      res.json({ ok: true, id, status });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- setel ulang kata sandi ---------- */
  app.post('/api/newsroom/pengguna/:id/sandi', async (req, res) => {
    const id = Number(req.params.id);
    const sandiBaru = String((req.body || {}).sandi || '');
    if (sandiBaru.length < 8 || !/[A-Za-z]/.test(sandiBaru) || !/[0-9]/.test(sandiBaru)) {
      return res.status(400).json({ error: 'Kata sandi minimal 8 karakter serta memuat huruf dan angka' });
    }
    if (!bcrypt) return res.status(501).json({ error: 'Modul bcryptjs tidak tersedia di server ini' });
    try {
      const { rows } = await q('SELECT id, email FROM users WHERE id=$1', [id]);
      const u = rows[0];
      if (!u) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      const hash = await bcrypt.hash(sandiBaru, COST);
      await q('UPDATE users SET pass_hash=$1 WHERE id=$2', [hash, id]);
      /* putuskan sesi lama bila tabel/kolom tersedia (best-effort) */
      let sesiDibersihkan = false;
      try {
        await q(`DELETE FROM ai_findings WHERE jenis='sesi' AND kunci=$1`, [String(id)]);
        sesiDibersihkan = true;
      } catch (_) { /* bukan skema akun publik */ }
      await audit(`Pengguna: kata sandi ${u.email} disetel ulang oleh ${nama(req)}`, nama(req));
      res.json({ ok: true, id, sesi_dibersihkan: sesiDibersihkan, catatan: 'Sampaikan kata sandi baru lewat kanal aman, lalu minta pengguna segera menggantinya.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /* ---------- buat akun staf baru ---------- */
  app.post('/api/newsroom/pengguna', async (req, res) => {
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const namaBaru = String(b.nama || '').trim().slice(0, 80);
    const peran = String(b.peran || '').trim();
    const jabatan = String(b.jabatan || '').trim().slice(0, 80);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return res.status(400).json({ error: 'Email tidak valid' });
    if (namaBaru.length < 2) return res.status(400).json({ error: 'Nama minimal 2 karakter' });
    if (!RBAC.SEMUA_PERAN.includes(peran)) return res.status(400).json({ error: 'Peran tidak dikenal: ' + peran });
    if (!bcrypt) return res.status(501).json({ error: 'Modul bcryptjs tidak tersedia di server ini' });
    try {
      const ada = await q('SELECT id FROM users WHERE lower(email)=$1', [email]);
      if (ada.rows.length) return res.status(409).json({ error: 'Email sudah terdaftar' });
      /* kata sandi sementara acak bila tidak diisi administrator */
      const sementara = String(b.sandi || '') || (() => {
        const huruf = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
        const angka = '23456789';
        const pilih = (s) => s[crypto.randomInt(s.length)];
        return pilih(huruf) + pilih(huruf.toUpperCase()) + pilih(angka) + pilih(angka) +
          Array.from({ length: 8 }, () => pilih(huruf + angka)).join('');
      })();
      const hash = await bcrypt.hash(sementara, COST);
      const aman = RBAC.jabatan(peran, jabatan);
      const { rows } = await q('INSERT INTO users(email,name,role,role_label,pass_hash) VALUES($1,$2,$3,$4,$5) RETURNING id',
        [email, namaBaru, aman.peranDb, aman.label, hash]);
      const info = await simpanLabel(rows[0].id, email, peran, jabatan);
      await audit(`Pengguna: akun baru ${email} (${peran}) dibuat oleh ${nama(req)}`, nama(req));
      res.status(201).json({
        ok: true,
        pengguna: { id: rows[0].id, email, nama: namaBaru, peran, peran_nama: RBAC.info(peran).nama, jabatan: info.jabatan },
        sandi_sementara: sementara,
        catatan: 'Sandi sementara hanya ditampilkan sekali. Sampaikan lewat kanal aman; pengguna wajib menggantinya saat masuk pertama.'
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
};
