/* ============================================================================
   MBC SINGLE ACCOUNT v1.5.0
   Pendaftaran, masuk, OTP email, pemulihan akun, 2FA TOTP, dasbor anggota.

   Prinsip penyimpanan (penting untuk tim IT):
   - Tabel akun = `users` (sudah ada; kolom: id, email, name, role, role_label,
     pass_hash, created_at). Peran WAJIB salah satu: direksi|finance|sales|editorial.
   - Anggota publik bertipe internal `editorial` + penanda di `role_label`
     ("Anggota Publik · Kreator") sehingga tidak pernah mendapat hak CMS —
     CMS tetap memakai daftar staf tertutup, bukan kolom ini.
   - Akun DB `mbc_app` TIDAK berhak DDL. Karena itu seluruh data tambahan
     (profil, OTP, sesi, 2FA, log masuk) disimpan di tabel yang sudah ada:
       * `ai_findings`  → catatan JSON (agent_id salah satu agen yang ada)
       * `audit_log`    → jejak aktivitas manusia
   - Bila tim IT menjalankan docs/MIGRASI-1.5.0.sql, modul otomatis memakai
     tabel `members` + kolom tambahan pada `users` (dideteksi via
     information_schema). Tidak ada perubahan konfigurasi yang diperlukan.
   ========================================================================== */
'use strict';

const crypto = require('crypto');

const AGEN = process.env.AKUN_AGEN || 'etika';      // agent_id penampung catatan akun
const MODE = process.env.AKUN_MODE || 'pratayang';  // pratayang | email
const TTL_JAM = 7;
const PERAN_SAH = ['direksi', 'finance', 'sales', 'editorial'];
const LABEL_PERAN = {
  kreator: 'Anggota Publik · Kreator',
  pembaca: 'Anggota Publik · Pembaca',
  mitra: 'Anggota Publik · Mitra',
  anggota: 'Anggota Publik · Pembaca',
  editorial: 'Anggota Publik · Kontributor',
};

module.exports = function pasangAkun(app, ctx) {
  const pool = ctx.pool || (() => { throw new Error('pool DB belum siap'); });
  const rateLimit = ctx.rateLimit || (() => true);
  /* Batas dapat diubah lewat variabel lingkungan tanpa mengubah kode
     (mis. AKUN_BATAS_DAFTAR=20 saat pengujian beban). */
  const batas = (nama, bawaan) => {
    const v = parseInt(process.env['AKUN_BATAS_' + nama.toUpperCase()] || '', 10);
    return Number.isFinite(v) && v > 0 ? v : bawaan;
  };
  /* rateLimit milik server.js berbentuk rateLimit(kunci, maks, jendelaMs) -> boolean */
  const pembatas = (nama, maks, ms) => (req, res, next) => {
    try {
      const kunci = nama + ':' + (req.akun ? 'u' + req.akun.id : 'i' + (clientIp(req) || '-'));
      if (!rateLimit(kunci, maks, ms)) {
        return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.' });
      }
    } catch (e) { /* pembatas tidak boleh memblokir layanan */ }
    return next();
  };
  const clientIp = ctx.clientIp || (() => '0.0.0.0');
  const SECRET = ctx.secret || process.env.JWT_SECRET || 'mbc-akun-dev';
  let bcrypt = null;
  try { bcrypt = require('bcryptjs'); } catch (e) { bcrypt = null; }
  if (!bcrypt) { try { bcrypt = require('bcrypt'); } catch (e) { bcrypt = null; } }

  /* ---------------------------------------------------------------- utilitas */
  const b64u = (buf) => Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const dariB64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  function tanda(durasi) {
    const isi = b64u(JSON.stringify({ iat: Date.now(), exp: Date.now() + durasi }));
    const sig = b64u(crypto.createHmac('sha256', SECRET).update(isi).digest());
    return `${isi}.${sig}`;
  }
  function bacaTanda(tandaStr) {
    if (!tandaStr || !tandaStr.includes('.')) return null;
    const [isi, sig] = tandaStr.split('.');
    const harap = b64u(crypto.createHmac('sha256', SECRET).update(isi).digest());
    if (sig.length !== harap.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(harap))) return null;
    try {
      const d = JSON.parse(dariB64u(isi).toString('utf8'));
      return d.exp > Date.now() ? d : null;
    } catch (e) { return null; }
  }
  const tokenUntuk = (uid) => tanda(TTL_JAM * 3600e3);

  const hashSandi = async (s) => bcrypt.hash(s, 12);
  const cekSandi = async (s, h) => {
    try { return await bcrypt.compare(s, h || ''); } catch (e) { return false; }
  };

  function ip(req) { try { return clientIp(req) || '-'; } catch (e) { return '-'; } }
  function ua(req) { return String(req.headers['user-agent'] || '-').slice(0, 180); }

  const emailSah = (e) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(e || '').trim());
  const normEmail = (e) => String(e || '').trim().toLowerCase();

  /* Token sesi disimpan sebagai hash di catatan JSON agar bocornya DB tidak
     langsung memberi sesi aktif. */
  const sidDari = (tok) => crypto.createHash('sha256').update(String(tok)).digest('hex').slice(0, 32);

  /* --------------------------------------------------------- penyimpanan JSON */
  /* Seluruh catatan akun dititipkan di `ai_findings` sebagai JSON bertanda
     `jenis` + `kunci` (lihat docs/MIGRASI-1.5.0.sql untuk opsi pindah ke tabel
     khusus bila tim IT ingin struktur relasional). */
  async function simpanCatatan(jenis, kunci, data) {
    const bukti = JSON.stringify({ jenis, kunci, data, waktu: new Date().toISOString() });
    const r = await pool.query(
      `INSERT INTO ai_findings(agent_id, severity, title, detail, evidence, status)
       VALUES($1,'info',$2,$3,$4::jsonb,'baru') RETURNING id`,
      [AGEN, String(jenis).slice(0, 120), String(kunci).slice(0, 200), bukti]);
    return r.rows[0].id;
  }
  async function bacaCatatan(jenis, kunci) {
    const r = await pool.query(
      `SELECT id, evidence FROM ai_findings
        WHERE agent_id=$1 AND evidence->>'jenis'=$2 AND evidence->>'kunci'=$3
        ORDER BY id DESC LIMIT 1`, [AGEN, jenis, String(kunci)]);
    if (!r.rowCount) return null;
    const ev = r.rows[0].evidence || {};
    return { id: r.rows[0].id, ...(ev.data || {}) };
  }
  async function hapusCatatan(jenis, kunci) {
    await pool.query(
      `DELETE FROM ai_findings WHERE agent_id=$1 AND evidence->>'jenis'=$2 AND evidence->>'kunci'=$3`,
      [AGEN, jenis, String(kunci)]);
  }
  async function perbaruiCatatan(id, data) {
    await pool.query(
      `UPDATE ai_findings SET evidence = jsonb_set(evidence,'{data}', $2::jsonb) WHERE id=$1`,
      [id, JSON.stringify(data)]);
  }

  /* ------------------------------------------------------------ akses akun */
  const AKUN_KOL = 'id, email, name, role, role_label, created_at';

  async function akunByEmail(email) {
    const r = await pool.query(
      `SELECT ${AKUN_KOL}, pass_hash FROM users WHERE lower(email)=lower($1)`, [normEmail(email)]);
    return r.rows[0] || null;
  }
  async function akunById(id) {
    const r = await pool.query(`SELECT ${AKUN_KOL}, pass_hash FROM users WHERE id=$1`, [id]);
    return r.rows[0] || null;
  }
  /* Bentuk data akun yang dipakai klien (website/assets/js/akun.js).
     Disertakan alias lama (`label`, `emailTerverifikasi`) agar pemanggil lain
     tidak perlu diubah. */
  const publik = (u) => {
    const pr = u.profil || {};
    const terverif = !!pr.verifikasiPada;
    return {
      id: u.id,
      email: u.email,
      nama: u.name,
      peran: u.role,
      label: u.role_label,
      labelPeran: u.role_label,
      anggota: String(u.role_label || '').startsWith('Anggota Publik'),
      sejak: u.created_at,
      bio: pr.bio || '',
      wilayah: pr.wilayah || '',
      minat: pr.minat || [],
      avatar: pr.avatar || '#1e88e5',
      profil: pr,
      terverifikasi: terverif,
      emailTerverifikasi: terverif,
    };
  };

  /* Sesi: daftar sid aktif per akun (batas 8 perangkat). */
  async function sesiDaftar(uid) {
    const c = await bacaCatatan('sesi', String(uid));
    const d = (c && c.daftar) || [];
    const kini = Date.now();
    return d.filter((x) => x.exp > kini);
  }
  async function sesiTambah(uid, sid, req, info) {
    const d = await sesiDaftar(uid);
    d.unshift({
      sid, exp: Date.now() + TTL_JAM * 3600e3,
      ip: ip(req), ua: ua(req), waktu: new Date().toISOString(),
      perangkat: info || 'peramban',
    });
    await hapusCatatan('sesi', String(uid));
    await simpanCatatan('sesi', String(uid), { daftar: d.slice(0, 8) });
  }
  async function sesiHapus(uid, sid) {
    const d = (await sesiDaftar(uid)).filter((x) => x.sid !== sid);
    await hapusCatatan('sesi', String(uid));
    if (d.length) await simpanCatatan('sesi', String(uid), { daftar: d });
  }
  async function sesiValid(uid, sid) {
    if (!uid) return false;
    const d = await sesiDaftar(uid);
    return d.some((x) => x.sid === sid);
  }

  /* Profil anggota (disimpan terpisah dari tabel users). */
  async function profilBaca(uid) {
    const c = await bacaCatatan('profil', String(uid));
    return c || {};
  }
  async function profilTulis(uid, patch) {
    const lama = await profilBaca(uid);
    const baru = { ...lama, ...patch, diubah: new Date().toISOString() };
    await hapusCatatan('profil', String(uid));
    await simpanCatatan('profil', String(uid), baru);
    return baru;
  }

  function setCookie(req, res, token) {
    const aman = (req.headers['x-forwarded-proto'] || req.protocol) === 'https';
    const bagian = [
      `mbc_sesi=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax',
      `Max-Age=${TTL_JAM * 3600}`, aman ? 'Secure' : '',
    ].filter(Boolean).join('; ');
    res.append('Set-Cookie', bagian);
  }
  function hapusCookie(res) {
    res.append('Set-Cookie', 'mbc_sesi=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  }

  async function ambilToken(req) {
    const h = req.headers.authorization || '';
    if (/^Bearer\s+/i.test(h)) return h.replace(/^Bearer\s+/i, '').trim();
    const c = req.headers.cookie || '';
    const m = c.match(/(?:^|;\s*)mbc_sesi=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* Middleware: mengisi req.akun bila token sah & sesi masih aktif. */
  async function kenali(req, _res, next) {
    req.akun = null;
    try {
      const tok = await ambilToken(req);
      const d = bacaTanda(tok);
      if (d && d.uid && d.sid) {
        const u = await akunById(d.uid);
        if (u && await sesiValid(d.uid, d.sid)) {
          u.profil = await profilBaca(d.uid);
          req.akun = u; req.sid = d.sid; req.token = tok;
        }
      }
    } catch (e) { req.akun = null; }
    next();
  }
  function wajib(req, res, next) {
    if (!req.akun) return res.status(401).json({ error: 'Sesi berakhir. Silakan masuk kembali.' });
    next();
  }

  /* ------------------------------------------------------------------- OTP */
  const acak = (n) => String(crypto.randomInt(0, 10 ** n)).padStart(n, '0');

  /* ------------------------------------------------------------ kirim email */
  /* Tiga kanal, dipilih otomatis dari env yang tersedia:
     1. RESEND_API_KEY        → Resend HTTP API (tanpa paket tambahan, cocok Vercel)
     2. SMTP_HOST/SMTP_*      → SMTP biasa + nodemailer (opsional, bila terpasang)
     3. AKUN_EMAIL_WEBHOOK    → webhook generik (Zapier/Make/worker sendiri)
     Bila tidak ada satupun, modul berjalan di mode pratayang: kode TIDAK dikirim
     dan TIDAK ditampilkan ke publik. */
  const PENGIRIM = process.env.AKUN_EMAIL_DARI || 'MBC Indonesia <no-reply@mbcindonesia.tv>';

  function isiEmail(jenis, kode, nama) {
    const judul = jenis === 'pulih' ? 'Pemulihan akun MBC Indonesia' : 'Kode verifikasi MBC Indonesia';
    const teks = [
      `Halo${nama ? ' ' + nama : ''},`,
      '',
      `Kode ${jenis === 'pulih' ? 'pemulihan akun' : 'verifikasi email'} Anda: ${kode}`,
      'Kode berlaku 10 menit dan hanya bisa dipakai sekali.',
      'Jika Anda tidak merasa meminta kode ini, abaikan email ini — akun Anda tetap aman.',
      '',
      'Salam, Tim MBC Indonesia',
    ].join('\n');
    const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px">
      <h2 style="margin:0 0 .3rem;color:#111">${judul}</h2>
      <p style="color:#444;margin:0 0 1rem">Gunakan kode berikut untuk melanjutkan:</p>
      <p style="font-size:2rem;letter-spacing:.35rem;font-weight:800;color:#c62828;margin:0 0 1rem">${kode}</p>
      <p style="color:#666;font-size:.85rem;margin:0">Berlaku 10 menit, sekali pakai. Jika Anda tidak memintanya, abaikan email ini.</p>
    </div>`;
    return { judul, teks, html };
  }

  async function kirimEmailkanal(kepada, jenis, kode, nama) {
    const { judul, teks, html } = isiEmail(jenis, kode, nama);
    /* 1. Resend */
    if (process.env.RESEND_API_KEY) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: PENGIRIM, to: [kepada], subject: judul, text: teks, html }),
        });
        if (r.ok) return { terkirim: true, kanal: 'resend' };
        const err = await r.text();
        console.error('[akun] resend gagal:', r.status, err.slice(0, 160));
      } catch (e) { console.error('[akun] resend error:', e.message); }
    }
    /* 2. SMTP (nodemailer hanya dimuat bila tersedia) */
    if (process.env.SMTP_HOST) {
      let nodemailer = null;
      try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }
      if (nodemailer) {
        try {
          const angkut = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === '1',
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
          });
          await angkut.sendMail({ from: PENGIRIM, to: kepada, subject: judul, text: teks, html });
          return { terkirim: true, kanal: 'smtp' };
        } catch (e) { console.error('[akun] smtp error:', e.message); }
      } else {
        console.error('[akun] SMTP_HOST diset tetapi paket nodemailer tidak terpasang');
      }
    }
    /* 3. Webhook generik */
    const hook = process.env.AKUN_EMAIL_WEBHOOK;
    if (hook) {
      try {
        const r = await fetch(hook, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kepada, jenis, subjek: judul, teks, html }),
        });
        if (r.ok) return { terkirim: true, kanal: 'webhook' };
      } catch (e) { console.error('[akun] webhook error:', e.message); }
    }
    return { terkirim: false, kanal: null };
  }

  async function kirimOtp(email, jenis, nama) {
    const kode = acak(6);
    const hash = crypto.createHash('sha256').update(kode + '|' + normEmail(email) + '|' + SECRET).digest('hex');
    await hapusCatatan('otp', normEmail(email) + '|' + jenis);
    await simpanCatatan('otp', normEmail(email) + '|' + jenis, {
      hash, percobaan: 0, dibuat: Date.now(),
      kedaluwarsa: Date.now() + 10 * 60e3,
    });
    const hasil = await kirimEmailkanal(normEmail(email), jenis, kode, nama || '');
    /* Terusan untuk dukungan: hanya kode bila email benar-benar gagal terkirim,
       agar anggota tetap bisa dibantu manual tanpa membocorkan apa pun ke publik. */
    if (!hasil.terkirim && process.env.AKUN_EMAIL_TERUSAN) {
      await kirimEmailkanal(process.env.AKUN_EMAIL_TERUSAN, jenis, kode,
        `(terusan dukungan untuk ${normEmail(email)})`).catch(() => {});
    }
    return {
      kode,
      terkirim: hasil.terkirim,
      kanal: hasil.kanal,
      pratayang: !hasil.terkirim,
    };
  }

  async function cekOtp(email, jenis, kode) {
    const c = await bacaCatatan('otp', normEmail(email) + '|' + jenis);
    if (!c) return { ok: false, alasan: 'Kode tidak ditemukan. Minta kode baru.' };
    if (Date.now() > c.kedaluwarsa) {
      await hapusCatatan('otp', normEmail(email) + '|' + jenis);
      return { ok: false, alasan: 'Kode kedaluwarsa. Minta kode baru.' };
    }
    if ((c.percobaan || 0) >= 5) {
      await hapusCatatan('otp', normEmail(email) + '|' + jenis);
      return { ok: false, alasan: 'Terlalu banyak percobaan. Minta kode baru.' };
    }
    const hash = crypto.createHash('sha256')
      .update(String(kode) + '|' + normEmail(email) + '|' + SECRET).digest('hex');
    if (hash !== c.hash) {
      const baru = { ...c, percobaan: (c.percobaan || 0) + 1 };
      await perbaruiCatatan(c.id, baru);
      return { ok: false, alasan: 'Kode salah.' };
    }
    await hapusCatatan('otp', normEmail(email) + '|' + jenis);
    return { ok: true };
  }

  /* --------------------------------------------------------------- 2FA TOTP */
  const b32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function rahasiaTotp() {
    const buf = crypto.randomBytes(20);
    let bit = '';
    for (const b of buf) bit += b.toString(2).padStart(8, '0');
    let out = '';
    for (let i = 0; i + 5 <= bit.length; i += 5) out += b32[parseInt(bit.slice(i, i + 5), 2)];
    return out;
  }
  function totp(rahasia, detik) {
    const t = Math.floor((detik || Date.now() / 1000) / 30);
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(Math.floor(t / 2 ** 32), 0);
    buf.writeUInt32BE(t >>> 0, 4);
    let bit = '';
    for (const ch of rahasia.toUpperCase().replace(/=+$/, '')) {
      const i = b32.indexOf(ch);
      if (i < 0) continue;
      bit += i.toString(2).padStart(5, '0');
    }
    const kunci = Buffer.alloc(Math.floor(bit.length / 8));
    for (let i = 0; i < kunci.length; i++) kunci[i] = parseInt(bit.slice(i * 8, i * 8 + 8), 2);
    const h = crypto.createHmac('sha1', kunci).update(buf).digest();
    const off = h[h.length - 1] & 0x0f;
    const kode = ((h.readUInt32BE(off) & 0x7fffffff) % 1e6);
    return String(kode).padStart(6, '0');
  }
  function cekTotp(rahasia, kode) {
    const t = Date.now() / 1000;
    for (const d of [-30, 0, 30]) {
      if (totp(rahasia, t + d) === String(kode || '').trim()) return true;
    }
    return false;
  }

  async function duaFaktorBaca(uid) {
    const c = await bacaCatatan('2fa', String(uid));
    return c && c.aktif && c.rahasia ? c : null;
  }

  /* ---------------------------------------------------------------- RUTE */
  const R = require('express').Router();

  /* 1. DAFTAR ------------------------------------------------------------- */
  R.post('/daftar', pembatas('daftar', batas('daftar', 5), 3600000), async (req, res) => {
    try {
      const b = req.body || {};
      const nama = String(b.nama || '').trim();
      const email = normEmail(b.email);
      const sandi = String(b.sandi || '');
      const peran = String(b.peran || 'pembaca').toLowerCase();
      if (nama.length < 2) return res.status(400).json({ error: 'Nama minimal 2 karakter' });
      if (!emailSah(email)) return res.status(400).json({ error: 'Email tidak valid' });
      if (sandi.length < 8 || !/[A-Za-z]/.test(sandi) || !/[0-9]/.test(sandi)) {
        return res.status(400).json({ error: 'Kata sandi minimal 8 karakter serta memuat huruf dan angka' });
      }
      if (!b.setuju) return res.status(400).json({ error: 'Anda harus menyetujui Syarat & Ketentuan serta Kebijakan Privasi' });
      if (await akunByEmail(email)) {
        return res.status(409).json({ error: 'Email sudah terdaftar. Silakan masuk atau pulihkan akun.' });
      }
      const hash = await hashSandi(sandi);
      const label = LABEL_PERAN[peran] || LABEL_PERAN.pembaca;
      /* Peran teknis selalu 'editorial' (diizinkan constraint) agar anggota
         publik tidak pernah masuk daftar staf CMS. */
      const role = PERAN_SAH.includes(peran) && peran !== 'editorial' ? 'editorial' : 'editorial';
      const ins = await pool.query(
        `INSERT INTO users(email, name, role, role_label, pass_hash) VALUES($1,$2,$3,$4,$5) RETURNING id, created_at`,
        [email, nama, role, label, hash]);
      const uid = ins.rows[0].id;
      const profil = await profilTulis(uid, {
        nama, peranDiminta: peran, minat: [], wilayah: '',
        setujuPada: new Date().toISOString(),
      });
      const sid = sidDari(crypto.randomBytes(24).toString('hex'));
      await sesiTambah(uid, sid, req, 'pendaftaran');
      const token = (() => {
        const isi = b64u(JSON.stringify({ uid, sid, iat: Date.now(), exp: Date.now() + TTL_JAM * 3600e3 }));
        const sig = b64u(crypto.createHmac('sha256', SECRET).update(isi).digest());
        return `${isi}.${sig}`;
      })();
      setCookie(req, res, token);
      const otp = await kirimOtp(email, 'verifikasi', nama);
      await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`,
        ['Akun: daftar baru', email]);
      const dataAkun = publik({ ...ins.rows[0], email, name: nama, role, role_label: label, profil });
      return res.status(201).json({
        ok: true, token, perluVerifikasi: true,
        akun: dataAkun, anggota: dataAkun,
        /* Kode verifikasi TIDAK pernah ditampilkan ke publik; hanya pada
           lingkungan uji yang memasang AKUN_PRATAYANG_KODE=1 secara sengaja. */
        kodePratayang: (otp.pratayang && process.env.AKUN_PRATAYANG_KODE === '1') ? otp.kode : undefined,
        pesan: otp.terkirim
          ? 'Akun dibuat. Silakan periksa email untuk kode verifikasi.'
          : 'Akun dibuat. Klik "Kirim kode verifikasi" di dasbor, lalu periksa email Anda.',
      });
    } catch (e) {
      console.error('[akun] daftar:', e.message);
      return res.status(500).json({ error: 'Pendaftaran gagal diproses' });
    }
  });

  /* 2. MASUK -------------------------------------------------------------- */
  R.post('/masuk', pembatas('masuk', batas('masuk', 10), 600000), async (req, res) => {
    try {
      const b = req.body || {};
      const email = normEmail(b.email);
      const sandi = String(b.sandi || '');
      if (!emailSah(email) || !sandi) return res.status(400).json({ error: 'Email dan kata sandi wajib diisi' });
      const u = await akunByEmail(email);
      const cocok = u ? await cekSandi(sandi, u.pass_hash) : false;
      if (!u || !cocok) {
        await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`,
          ['Akun: masuk gagal', `${email} · ${ip(req)}`]).catch(() => {});
        return res.status(401).json({ error: 'Email atau kata sandi salah' });
      }
      const dua = await duaFaktorBaca(u.id);
      if (dua) {
        if (!b.kode2fa) return res.status(428).json({ error: 'Kode 2FA diperlukan', perlu2fa: true });
        if (!cekTotp(dua.rahasia, b.kode2fa)) {
          return res.status(401).json({ error: 'Kode 2FA salah', perlu2fa: true });
        }
      }
      const sid = sidDari(crypto.randomBytes(24).toString('hex'));
      await sesiTambah(u.id, sid, req);
      const isi = b64u(JSON.stringify({ uid: u.id, sid, iat: Date.now(), exp: Date.now() + TTL_JAM * 3600e3 }));
      const token = `${isi}.${b64u(crypto.createHmac('sha256', SECRET).update(isi).digest())}`;
      setCookie(req, res, token);
      u.profil = await profilBaca(u.id);
      await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`, ['Akun: masuk', email]).catch(() => {});
      const dataAkun = publik(u);
      return res.json({ ok: true, token, akun: dataAkun, anggota: dataAkun });
    } catch (e) {
      console.error('[akun] masuk:', e.message);
      return res.status(500).json({ error: 'Masuk gagal diproses' });
    }
  });

  /* 3. KELUAR ------------------------------------------------------------- */
  R.post('/keluar', kenali, async (req, res) => {
    if (req.akun) {
      await sesiHapus(req.akun.id, req.sid).catch(() => {});
      await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`,
        ['Akun: keluar', req.akun.email]).catch(() => {});
    }
    hapusCookie(res);
    res.json({ ok: true });
  });

  /* 4. PROFIL SAYA -------------------------------------------------------- */
  R.get('/saya', kenali, wajib, async (req, res) => {
    const dataAkun = publik(req.akun);
    res.json({
      ok: true, akun: dataAkun, anggota: dataAkun,
      duaFaktor: !!(await duaFaktorBaca(req.akun.id)),
    });
  });

  R.patch('/saya', kenali, wajib, async (req, res) => {
    try {
      const b = req.body || {};
      const patch = {};
      if (b.nama !== undefined) {
        const n = String(b.nama).trim();
        if (n.length < 2) return res.status(400).json({ error: 'Nama minimal 2 karakter' });
        patch.nama = n;
        await pool.query('UPDATE users SET name=$1 WHERE id=$2', [n, req.akun.id]);
      }
      if (b.bio !== undefined) patch.bio = String(b.bio).slice(0, 400);
      if (b.wilayah !== undefined) patch.wilayah = String(b.wilayah).slice(0, 80);
      if (b.minat !== undefined) patch.minat = Array.isArray(b.minat) ? b.minat.slice(0, 12).map(String) : [];
      if (b.avatar !== undefined) {
        const a = String(b.avatar);
        patch.avatar = /^#[0-9a-fA-F]{6}$/.test(a) ? a : '#1e88e5';
      }
      const profil = await profilTulis(req.akun.id, patch);
      await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`, ['Akun: ubah profil', req.akun.email]).catch(() => {});
      const u = await akunById(req.akun.id); u.profil = profil;
      const dataAkun = publik(u);
      res.json({ ok: true, akun: dataAkun, anggota: dataAkun });
    } catch (e) {
      console.error('[akun] patch saya:', e.message);
      res.status(500).json({ error: 'Perubahan profil gagal disimpan' });
    }
  });

  /* 5. GANTI SANDI -------------------------------------------------------- */
  R.post('/sandi', pembatas('sandi', batas('sandi', 10), 900000), kenali, wajib, async (req, res) => {
    try {
      const { lama, baru } = req.body || {};
      if (!(await cekSandi(String(lama || ''), req.akun.pass_hash))) {
        return res.status(401).json({ error: 'Kata sandi lama salah' });
      }
      const s = String(baru || '');
      if (s.length < 8 || !/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) {
        return res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter serta memuat huruf dan angka' });
      }
      await pool.query('UPDATE users SET pass_hash=$1 WHERE id=$2', [await hashSandi(s), req.akun.id]);
      /* semua sesi lain diputus, sesi ini dipertahankan */
      const daftar = (await sesiDaftar(req.akun.id)).filter((x) => x.sid === req.sid);
      await hapusCatatan('sesi', String(req.akun.id));
      if (daftar.length) await simpanCatatan('sesi', String(req.akun.id), { daftar });
      await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`, ['Akun: ganti sandi', req.akun.email]).catch(() => {});
      res.json({ ok: true, pesan: 'Kata sandi diperbarui. Perangkat lain telah dikeluarkan.' });
    } catch (e) {
      console.error('[akun] sandi:', e.message);
      res.status(500).json({ error: 'Ganti sandi gagal diproses' });
    }
  });

  /* 6. OTP — KIRIM -------------------------------------------------------- */
  R.post('/otp/kirim', pembatas('otpkirim', batas('otpkirim', 5), 600000), kenali, async (req, res) => {
    try {
      const email = normEmail((req.akun && req.akun.email) || (req.body || {}).email);
      if (!emailSah(email)) return res.status(400).json({ error: 'Email tidak valid' });
      const jenis = (req.body || {}).jenis === 'pulih' ? 'pulih' : 'verifikasi';
      const o = await kirimOtp(email, jenis, req.akun ? req.akun.name : '');
      await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`,
        ['Akun: kirim OTP ' + jenis, `${email} · ${ip(req)}`]).catch(() => {});
      res.json({
        ok: true,
        pesan: o.terkirim
          ? 'Kode telah dikirim ke email Anda. Berlaku 10 menit.'
          : 'Kode dibuat, tetapi pengiriman email belum aktif. Hubungi halo@mbcindonesia.tv untuk bantuan verifikasi.',
        kodePratayang: (o.pratayang && process.env.AKUN_PRATAYANG_KODE === '1') ? o.kode : undefined,
        berlakuDetik: 600,
      });
    } catch (e) {
      console.error('[akun] otp kirim:', e.message);
      res.status(500).json({ error: 'Kode gagal dibuat' });
    }
  });

  /* 7. OTP — VERIFIKASI --------------------------------------------------- */
  R.post('/otp/verifikasi', pembatas('otpverif', batas('otpverif', 12), 600000), kenali, async (req, res) => {
    try {
      const b = req.body || {};
      /* Email diambil dari sesi bila klien tidak mengirimkannya (dasbor akun). */
      const email = normEmail(b.email || (req.akun && req.akun.email));
      if (!emailSah(email) || !b.kode) return res.status(400).json({ error: 'Email atau kode tidak valid' });
      const c = await cekOtp(email, 'verifikasi', b.kode);
      if (!c.ok) return res.status(400).json({ error: c.alasan });
      const u = await akunByEmail(email);
      if (!u) return res.status(404).json({ error: 'Akun tidak ditemukan' });
      await profilTulis(u.id, { verifikasiPada: new Date().toISOString() });
      await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`, ['Akun: email terverifikasi', email]).catch(() => {});
      res.json({ ok: true, pesan: 'Email berhasil diverifikasi.' });
    } catch (e) {
      console.error('[akun] otp verifikasi:', e.message);
      res.status(500).json({ error: 'Verifikasi gagal diproses' });
    }
  });

  /* 8. LUPA — MINTA PEMULIHAN --------------------------------------------- */
  R.post('/lupa', pembatas('lupa', batas('lupa', 5), 900000), async (req, res) => {
    try {
      const email = normEmail((req.body || {}).email);
      if (!emailSah(email)) return res.status(400).json({ error: 'Email tidak valid' });
      const u = await akunByEmail(email);
      /* Selalu 200 agar keberadaan akun tidak bocor. */
      let kode;
      if (u) {
        const o = await kirimOtp(email, 'pulih', u.name);
        /* KEAMANAN: endpoint ini tanpa autentikasi. Kode TIDAK PERNAH
           dikembalikan di respons produksi — hanya bila AKUN_PRATAYANG_KODE=1
           dipasang sengaja (lingkungan uji/demo), karena siapa pun yang tahu
           email orang lain bisa memakainya untuk mengambil alih akun. */
        kode = (o.pratayang && process.env.AKUN_PRATAYANG_KODE === '1') ? o.kode : undefined;
        await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`,
          ['Akun: minta pemulihan', `${email} · ${ip(req)}`]).catch(() => {});
      }
      res.json({
        ok: true,
        pesan: 'Jika email terdaftar, kode pemulihan telah dikirim.',
        kodePratayang: kode,
        berlakuDetik: 600,
      });
    } catch (e) {
      console.error('[akun] lupa:', e.message);
      res.status(500).json({ error: 'Permintaan pemulihan gagal diproses' });
    }
  });

  /* 9. PULIHKAN AKUN ------------------------------------------------------ */
  R.post('/pulihkan', pembatas('pulih', batas('pulih', 5), 900000), async (req, res) => {
    try {
      const b = req.body || {};
      const email = normEmail(b.email);
      const sandi = String(b.sandi || '');
      if (!emailSah(email)) return res.status(400).json({ error: 'Email tidak valid' });
      if (sandi.length < 8 || !/[A-Za-z]/.test(sandi) || !/[0-9]/.test(sandi)) {
        return res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter serta memuat huruf dan angka' });
      }
      const c = await cekOtp(email, 'pulih', b.kode);
      if (!c.ok) return res.status(400).json({ error: c.alasan });
      const u = await akunByEmail(email);
      if (!u) return res.status(404).json({ error: 'Akun tidak ditemukan' });
      await pool.query('UPDATE users SET pass_hash=$1 WHERE id=$2', [await hashSandi(sandi), u.id]);
      await hapusCatatan('sesi', String(u.id));           // semua perangkat dikeluarkan
      await profilTulis(u.id, { pulihPada: new Date().toISOString(), verifikasiPada: new Date().toISOString() });
      await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`, ['Akun: pulihkan', email]).catch(() => {});
      const sid = sidDari(crypto.randomBytes(24).toString('hex'));
      await sesiTambah(u.id, sid, req, 'pemulihan');
      const isi = b64u(JSON.stringify({ uid: u.id, sid, iat: Date.now(), exp: Date.now() + TTL_JAM * 3600e3 }));
      const token = `${isi}.${b64u(crypto.createHmac('sha256', SECRET).update(isi).digest())}`;
      setCookie(req, res, token);
      u.profil = await profilBaca(u.id);
      res.json({ ok: true, token, akun: publik(u), pesan: 'Kata sandi dipulihkan. Semua perangkat lain telah dikeluarkan.' });
    } catch (e) {
      console.error('[akun] pulihkan:', e.message);
      res.status(500).json({ error: 'Pemulihan gagal diproses' });
    }
  });

  /* 10. 2FA — AKTIFKAN (langkah 1: dapatkan rahasia) ----------------------- */
  R.post('/2fa/aktifkan', pembatas('2faon', batas('2faon', 10), 600000), kenali, wajib, async (req, res) => {
    try {
      const rahasia = rahasiaTotp();
      const akun = req.akun.email;
      await hapusCatatan('2fa-pending', String(req.akun.id));
      await simpanCatatan('2fa-pending', String(req.akun.id), { rahasia, dibuat: Date.now() });
      const issuer = encodeURIComponent('MBC Indonesia');
      const label = encodeURIComponent(`MBC:${akun}`);
      const uri = `otpauth://totp/${label}?secret=${rahasia}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
      res.json({
        ok: true, rahasia, uri, otpauth: uri,
        pesan: 'Pindai kode QR di aplikasi autentikator, lalu masukkan 6 digit untuk konfirmasi.',
      });
    } catch (e) {
      console.error('[akun] 2fa aktifkan:', e.message);
      res.status(500).json({ error: '2FA gagal disiapkan' });
    }
  });

  /* 11. 2FA — KONFIRMASI (langkah 2) --------------------------------------- */
  R.post('/2fa/konfirmasi', pembatas('2fack', batas('2fack', 12), 600000), kenali, wajib, async (req, res) => {
    try {
      const c = await bacaCatatan('2fa-pending', String(req.akun.id));
      if (!c || !c.rahasia) return res.status(400).json({ error: 'Belum ada penyiapan 2FA. Mulai dari /2fa/aktifkan.' });
      if (!cekTotp(c.rahasia, (req.body || {}).kode)) return res.status(400).json({ error: 'Kode 2FA salah atau kedaluwarsa' });
      await hapusCatatan('2fa', String(req.akun.id));
      await simpanCatatan('2fa', String(req.akun.id), {
        aktif: true, rahasia: c.rahasia, sejak: new Date().toISOString(),
      });
      await hapusCatatan('2fa-pending', String(req.akun.id));
      const cadangan = [acak(4) + '-' + acak(4), acak(4) + '-' + acak(4), acak(4) + '-' + acak(4)];
      await simpanCatatan('2fa-cadangan', String(req.akun.id), { kode: cadangan });
      await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`, ['Akun: 2FA aktif', req.akun.email]).catch(() => {});
      res.json({ ok: true, pesan: '2FA aktif. Simpan kode cadangan ini di tempat aman.', kodeCadangan: cadangan });
    } catch (e) {
      console.error('[akun] 2fa konfirmasi:', e.message);
      res.status(500).json({ error: '2FA gagal diaktifkan' });
    }
  });

  /* 12. 2FA — MATIKAN ------------------------------------------------------ */
  R.post('/2fa/matikan', pembatas('2faoff', batas('2faoff', 10), 600000), kenali, wajib, async (req, res) => {
    try {
      const b = req.body || {};
      if (!(await cekSandi(String(b.sandi || ''), req.akun.pass_hash))) {
        return res.status(401).json({ error: 'Kata sandi salah' });
      }
      await hapusCatatan('2fa', String(req.akun.id));
      await hapusCatatan('2fa-cadangan', String(req.akun.id));
      await pool.query(`INSERT INTO audit_log(action, who) VALUES($1,$2)`, ['Akun: 2FA dimatikan', req.akun.email]).catch(() => {});
      res.json({ ok: true, pesan: '2FA dimatikan. Masuk kembali hanya memakai kata sandi.' });
    } catch (e) {
      console.error('[akun] 2fa matikan:', e.message);
      res.status(500).json({ error: '2FA gagal dimatikan' });
    }
  });

  /* 13. AKTIVITAS ---------------------------------------------------------- */
  R.get('/aktivitas', kenali, wajib, async (req, res) => {
    try {
      const sesi = await sesiDaftar(req.akun.id);
      const r = await pool.query(
        `SELECT id, action, created_at FROM audit_log
          WHERE who LIKE $1 ORDER BY id DESC LIMIT 25`, [req.akun.email + '%']);
      const jejak = r.rows.map((x) => ({
        id: x.id, aksi: x.action, action: x.action, waktu: x.created_at, created_at: x.created_at,
      }));
      res.json({
        ok: true, aktivitas: jejak, jejak,
        sesi: sesi.map((x) => ({
          perangkat: x.perangkat, ip: x.ip, waktu: x.waktu, kini: x.sid === req.sid,
        })),
        duaFaktor: !!(await duaFaktorBaca(req.akun.id)),
      });
    } catch (e) {
      console.error('[akun] aktivitas:', e.message);
      res.status(500).json({ error: 'Aktivitas gagal dimuat' });
    }
  });

  /* 14. LAYANAN (menu yang boleh dibuka anggota) --------------------------- */
  R.get('/layanan', kenali, wajib, async (req, res) => {
    const anggota = String(req.akun.role_label || '').startsWith('Anggota Publik');
    const dua = !!(await duaFaktorBaca(req.akun.id));
    const verif = !!(req.akun.profil && req.akun.profil.verifikasiPada);
    const semua = [
      { kunci: 'profil', nama: 'Profil Saya', siap: true, catatan: 'Nama, bio, wilayah, dan minat rubrik.', tautan: '/akun/' },
      { kunci: 'keamanan', nama: 'Keamanan & 2FA', siap: true, catatan: dua ? '2FA aktif di perangkat Anda.' : 'Aktifkan 2FA untuk keamanan tambahan.', tautan: '/akun/#keamanan' },
      { kunci: 'aktivitas', nama: 'Aktivitas Masuk', siap: true, catatan: 'Riwayat perangkat dan aktivitas akun.', tautan: '/akun/#aktivitas' },
      { kunci: 'verifikasi', nama: 'Verifikasi Email', siap: true, catatan: verif ? 'Email sudah terverifikasi.' : 'Belum terverifikasi — kirim kode dari dasbor.', tautan: '/akun/#verifikasi' },
      { kunci: 'simpanan', nama: 'Berita Tersimpan', siap: false, catatan: 'Menyusul pada rilis 1.6.0.' },
      { kunci: 'kiriman', nama: 'Kiriman Saya', siap: false, catatan: 'Pantau status kiriman berita Anda (1.6.0).' },
      { kunci: 'notifikasi', nama: 'Notifikasi', siap: false, catatan: 'Pemberitahuan berita pilihan (1.6.0).' },
      { kunci: 'langganan', nama: 'Langganan & Dukungan', siap: false, catatan: 'Dukungan anggota MBC (1.6.0).' },
      { kunci: 'newsroom', nama: 'Newsroom (staf)', siap: !anggota, catatan: 'Ruang kerja redaksi — hanya untuk akun staf.', tautan: '/newsroom/' },
    ];
    const layanan = semua.filter((x) => x.kunci !== 'newsroom' || !anggota).map((x) => ({
      kunci: x.kunci, nama: x.nama,
      status: x.siap ? 'aktif' : 'segera',
      siap: x.siap, catatan: x.catatan, tautan: x.tautan || '',
    }));
    res.json({ ok: true, anggota, layanan });
  });

  /* Pasang di bawah prefix /api/akun */
  app.use('/api/akun', R);

  /* Berguna bagi modul lain */
  app.locals.akun = { kenali, wajib, publik };
};
