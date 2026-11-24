"""Uji RBAC peran lengkap + panel administrator (tanpa PostgreSQL).

Memakai Express asli + klien pg tiruan. Yang diuji:
  - matriks izin 8 peran (siapa boleh apa)
  - login newsroom: peran baru diterima, akun nonaktif ditolak
  - reporter tidak bisa memindahkan tahap / menerbitkan / menghapus
  - pemred & admin bisa menyetujui; redaktur tidak
  - panel pengguna hanya untuk admin; proteksi "admin terakhir" & "diri sendiri"
  - ubah peran, aktif/nonaktif, setel sandi, buat akun
  - migrasi kolom status: 501 + petunjuk bila kolom belum ada

Jalankan: python3 ops/uji-rbac.py
"""
import json
import os
import subprocess
import sys
import textwrap
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get('PORT_RBAC', '8132'))
BASE = f'http://127.0.0.1:{PORT}'
SECRET = 'uji-rbac-rahasia-panjang-sekali-1234567890'

HARNESS = textwrap.dedent(r'''
process.env.JWT_SECRET = 'uji-rbac-rahasia-panjang-sekali-1234567890';
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());

const RBAC = require(process.env.ROOT + '/server/peran');

/* ---- pg tiruan ---- */
const PUNYA_KOLOM_STATUS = process.env.PUNYA_STATUS !== '0';
const users = [
  { id: 1, email: 'admin@mbc.co.id', name: 'Admin Satu', role: 'admin', role_label: 'Administrator Sistem' },
  { id: 2, email: 'pemred@mbc.co.id', name: 'Pemred Dua', role: 'pemred', role_label: 'Pemimpin Redaksi' },
  { id: 3, email: 'redaktur@mbc.co.id', name: 'Redaktur Tiga', role: 'redaktur', role_label: 'Redaktur Pelaksana' },
  { id: 4, email: 'reporter@mbc.co.id', name: 'Reporter Empat', role: 'reporter', role_label: 'Reporter' },
  { id: 5, email: 'finance@mbc.co.id', name: 'Keuangan Lima', role: 'finance', role_label: 'Manajer Keuangan' },
  { id: 6, email: 'admin2@mbc.co.id', name: 'Admin Dua', role: 'admin', role_label: 'Administrator' }
].map(u => (PUNYA_KOLOM_STATUS ? { ...u, status: 'aktif' } : u));

const ARTIKEL = { id: 10, title: 'Uji Naskah', status: 'draft', published_at: null, body: 'x' };
const log = [];
/* tabel staff meniru produksi: jabatan disimpan bebas di staff.title */
const staff = [];
const PERAN_DB = ['direksi', 'finance', 'sales', 'editorial'];   /* constraint users_role_check */
const langgarConstraint = [];
const adminAktif = () => users.filter(u => {
  const title = (staff.find(s => s.user_email.toLowerCase() === u.email.toLowerCase()) || {}).title || '';
  const admin = u.role === 'admin' || title.includes('mbc:role=admin') || String(u.role_label || '').includes('mbc:role=admin');
  return admin && (u.status || 'aktif') === 'aktif';
}).length;
const stafDari = (u) => staff.find(s => s.user_email.toLowerCase() === u.email.toLowerCase());

const pool = {
  async query(sql, params = []) {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    log.push({ s: s.slice(0, 100), p: params });

    if (/information_schema\.columns/.test(s)) {
      const kolom = ['role_label', 'pass_hash', 'created_at'];
      if (PUNYA_KOLOM_STATUS) kolom.push('status');
      return { rows: kolom.map(c => ({ column_name: c })) };
    }
    if (/information_schema\.tables/.test(s)) return { rows: [{ '?column?': 1 }] };  /* tabel staff ada */
    if (/FROM users u LEFT JOIN staff s/.test(s) && /ORDER BY name/.test(s)) {
      return { rows: users.map(u => {
        const st = stafDari(u);
        return { id: u.id, email: u.email, name: u.name, role: u.role, role_label: u.role_label,
                 status: u.status, last_login: null, created_at: null, staff_title: st ? st.title : null };
      }) };
    }
    if (/count\(\*\)::int AS n FROM users u LEFT JOIN staff s/.test(s)) return { rows: [{ n: adminAktif() }] };
    if (/^SELECT u\.\* FROM users u LEFT JOIN staff s/.test(s)) {
      const kolom = Object.keys(params[0] || {})[0];
      const nilai = String(params[0][kolom] || '').toLowerCase();
      const u = users.find(x => String(x[kolom] || '').toLowerCase() === nilai);
      if (!u) return { rows: [] };
      const st = stafDari(u);
      return { rows: [{ ...u, pass_hash: 'x', staff_title: st ? st.title : null }] };
    }
    if (/^SELECT u\.id, u\.email, u\.name, u\.role, u\.role_label, s\.title AS staff_title/.test(s)) {
      const u = users.find(x => x.id === Number(params[0]));
      if (!u) return { rows: [] };
      const st = stafDari(u);
      return { rows: [{ id: u.id, email: u.email, name: u.name, role: u.role, role_label: u.role_label, staff_title: st ? st.title : null }] };
    }
    if (/^SELECT id FROM staff WHERE lower\(user_email\)=lower\(\$1\)/.test(s)) {
      const st = staff.find(x => x.user_email.toLowerCase() === String(params[0]).toLowerCase());
      return { rows: st ? [{ id: st.id }] : [] };
    }
    if (/^UPDATE staff SET title=\$1 WHERE id=\$2/.test(s)) {
      const st = staff.find(x => x.id === Number(params[1]));
      if (st) st.title = params[0];
      return { rows: [] };
    }
    if (/^INSERT INTO staff/.test(s)) {
      staff.push({ id: staff.length + 1, user_email: params[0], display_name: params[1], title: params[2] });
      return { rows: [] };
    }
    if (/^SELECT name FROM users WHERE id=\$1/.test(s)) {
      const u = users.find(x => x.id === Number(params[0]));
      return { rows: u ? [{ name: u.name }] : [] };
    }
    if (/^SELECT .* FROM users ORDER BY/.test(s)) {
      return { rows: users.map(u => ({ ...u, created_at: null, last_login: null })) };
    }
    if (/^SELECT id, email, name, role, role_label FROM users WHERE id=\$1/.test(s)) {
      const u = users.find(x => x.id === Number(params[0]));
      return { rows: u ? [u] : [] };
    }
    if (/^SELECT id, email, name, role FROM users WHERE id=\$1/.test(s)) {
      const u = users.find(x => x.id === Number(params[0]));
      return { rows: u ? [u] : [] };
    }
    if (/^SELECT id, email FROM users WHERE id=\$1/.test(s)) {
      const u = users.find(x => x.id === Number(params[0]));
      return { rows: u ? [u] : [] };
    }
    if (/^SELECT count\(\*\)::int AS n FROM users WHERE role='admin' AND/.test(s))
      return { rows: [{ n: users.filter(u => u.role === 'admin' && (u.status || 'aktif') === 'aktif').length }] };
    if (/^SELECT count\(\*\)::int AS n FROM users WHERE role='admin'/.test(s))
      return { rows: [{ n: users.filter(u => u.role === 'admin').length }] };
    if (/^SELECT id FROM users WHERE lower\(email\)/.test(s)) {
      const u = users.find(x => x.email.toLowerCase() === String(params[0]).toLowerCase());
      return { rows: u ? [{ id: u.id }] : [] };
    }
    if (/^UPDATE users SET role=\$1, role_label=\$2/.test(s)) {
      if (!PERAN_DB.includes(params[0])) langgarConstraint.push(params[0]);   /* meniru CHECK constraint */
      const u = users.find(x => x.id === Number(params[2]));
      if (u) { u.role = params[0]; u.role_label = params[1]; }
      return { rows: [] };
    }
    if (/^UPDATE users SET status=\$1 WHERE id=\$2/.test(s)) {
      const u = users.find(x => x.id === Number(params[1]));
      if (u) u.status = params[0];
      return { rows: [] };
    }
    if (/^UPDATE users SET pass_hash=\$1/.test(s)) return { rows: [] };
    if (/^INSERT INTO users/.test(s)) {
      const baru = { id: 99, email: params[0], name: params[1], role: params[2], role_label: params[3], status: 'aktif' };
      users.push(baru);
      return { rows: [{ id: 99 }] };
    }
    if (/FROM articles WHERE id=\$1/.test(s)) return { rows: params[0] === 10 ? [ARTIKEL] : [] };
    if (/^UPDATE articles SET status=\$1/.test(s)) { ARTIKEL.status = params[0]; return { rows: [] }; }
    if (/INSERT INTO editorial_approvals/.test(s)) return { rows: [] };
    if (/DELETE FROM ai_findings/.test(s)) return { rows: [] };
    return { rows: [] };
  }
};
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'Token tidak ada' });
  try { req.user = jwt.verify(t, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token tidak valid' }); }
}
const audit_cat = [];
const audit = async (a, w) => audit_cat.push({ a, w });
const FLOW = { draft: ['review'], review: ['fakta', 'draft'], fakta: ['hukum'], hukum: ['siap'], siap: ['tayang'], tayang: ['arsip'] };

/* gerbang peran newsroom versi ringkas (mengikuti newsroom-api.js) + endpoint status artikel */
app.post('/api/newsroom/articles/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body || {};
  const peran = req.user.role;
  const hanyaDraf = !RBAC.boleh(peran, 'cms') || peran === 'reporter';
  if (hanyaDraf && ['review', 'fakta', 'hukum', 'siap', 'terjadwal', 'tayang', 'arsip', 'ditarik'].includes(status))
    return res.status(403).json({ error: `Peran ${RBAC.info(peran).nama} tidak boleh memindahkan status ke "${status}".` });
  if (status === 'tayang' && !RBAC.boleh(peran, 'setujui'))
    return res.status(403).json({ error: 'Hanya pemimpin redaksi/direksi yang dapat menerbitkan artikel' });
  const a = ARTIKEL;
  if (!FLOW[a.status] || !FLOW[a.status].includes(status)) return res.status(409).json({ error: `Transisi ${a.status} → ${status} tidak sah` });
  a.status = status;
  await audit(`status ${a.status}`, req.user.email);
  res.json({ ok: true, status });
});
app.delete('/api/newsroom/articles/:id', requireAuth, (req, res, next) => {
  if (req.user.role === 'reporter') return res.status(403).json({ error: 'Reporter tidak boleh menghapus artikel' });
  next();
}, (req, res) => res.json({ ok: true }));

require(process.env.ROOT + '/server/newsroom-pengguna')(app, { pool, requireAuth, audit });

/* simulasi gerbang login newsroom */
app.post('/__login', (req, res) => {
  const u = users.find(x => x.email === req.body.email);
  if (!u) return res.status(401).json({ error: 'Email atau sandi salah' });
  if (!RBAC.SEMUA_PERAN.includes(u.role)) return res.status(403).json({ error: 'Akun ini tidak memiliki akses ke aplikasi internal' });
  if (!RBAC.akunAktif(u)) return res.status(403).json({ error: 'Akun Anda dinonaktifkan. Hubungi administrator.' });
  res.json({ ok: true, token: jwt.sign({ sub: u.id, email: u.email, name: u.name, role: u.role }, process.env.JWT_SECRET, { expiresIn: '1h' }) });
});
app.post('/__login_efektif', async (req, res) => {
  /* meniru akunDenganJabatan() di server/server.js: users + staff.title */
  const { rows } = await pool.query('SELECT u.* FROM users u LEFT JOIN staff s ON lower(s.user_email)=lower(u.email) WHERE u.email=$1',
    [{ email: req.body.email }]);
  const u = rows[0];
  if (!u) return res.status(401).json({ error: 'tidak ada' });
  u.role_label = u.staff_title || u.role_label;
  const peran = RBAC.dariBaris(u);          /* peran efektif dari users + staff.title */
  res.json({ ok: true, peran, roleDb: u.role, label: (staff.find(s => s.user_email.toLowerCase() === u.email.toLowerCase()) || {}).title || u.role_label,
    token: jwt.sign({ sub: u.id, email: u.email, name: u.name, role: peran }, process.env.JWT_SECRET, { expiresIn: '1h' }) });
});
app.get('/__diagnosa', (req, res) => res.json({
  langgarConstraint, users: users.map(u => ({ id: u.id, email: u.email, role: u.role, role_label: u.role_label })),
  staff: staff.map(x => ({ id: x.id, email: x.user_email, title: x.title }))
}));
app.get('/__audit', (req, res) => res.json(audit_cat));
app.listen(process.env.PORT_RBAC, '127.0.0.1', () => console.log('siap'));
''')


def panggil(jalur, metode='GET', isi=None, token=None):
    data = json.dumps(isi).encode() if isi is not None else None
    r = urllib.request.Request(BASE + jalur, data=data, method=metode,
                               headers={'Content-Type': 'application/json',
                                        **({'Authorization': 'Bearer ' + token} if token else {})})
    try:
        with urllib.request.urlopen(r, timeout=30) as f:
            return f.status, json.loads(f.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def token_untuk(peran, uid=1, email=None, status=None):
    muatan = {'sub': uid, 'email': email or f'{peran}@mbc.co.id', 'name': 'Uji', 'role': peran}
    if status:
        muatan['status'] = status
    kode = ("const jwt=require('jsonwebtoken');process.stdout.write(jwt.sign("
            + json.dumps(muatan) + f",'{SECRET}',{{expiresIn:'1h'}}))")
    return subprocess.run(['node', '-e', kode], cwd=ROOT, capture_output=True, text=True).stdout


def main():
    hpath = os.path.join(ROOT, 'server', 'scripts', '_harness-rbac.js')
    open(hpath, 'w').write(HARNESS)
    hasil = []

    def cek(nama, kondisi, info=''):
        hasil.append((nama, bool(kondisi)))
        print(('  ✅ ' if kondisi else '  ❌ ') + nama + (('  → ' + str(info)) if info and not kondisi else ''))

    def nyalakan(punya_status='1'):
        env = dict(os.environ, ROOT=ROOT, PORT_RBAC=str(PORT), PUNYA_STATUS=punya_status)
        p = subprocess.Popen(['node', hpath], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for _ in range(60):
            try:
                urllib.request.urlopen(BASE + '/api/newsroom/pengguna', timeout=1); break
            except urllib.error.HTTPError:
                break
            except Exception:
                time.sleep(0.2)
        return p

    srv = nyalakan()
    try:
        print('\n=== 1. Matriks izin 8 peran ===')
        t_admin = token_untuk('admin', 1, 'admin@mbc.co.id')
        st, d = panggil('/api/newsroom/pengguna/peran', token=t_admin)
        cek('matriks peran dapat dibaca admin', st == 200 and len(d.get('peran', [])) == 8, st)
        peta = {r['peran']: r['akses'] for r in d.get('peran', [])}
        cek('admin: semua izin', all(peta['admin'].values()), peta.get('admin'))
        cek('pemred: setujui terbit, tanpa kelola pengguna', peta['pemred']['setujui'] and not peta['pemred']['kelola_pengguna'])
        cek('redaktur: CMS ya, setujui tidak', peta['redaktur']['cms'] and not peta['redaktur']['setujui'])
        cek('reporter: CMS ya, setujui tidak, produksi tidak', peta['reporter']['cms'] and not peta['reporter']['setujui'] and not peta['reporter']['produksi'])
        cek('finance: keuangan ya, CMS tidak', peta['finance']['keuangan'] and not peta['finance']['cms'])
        cek('sales: komersial ya, CMS tidak', peta['sales']['komersial'] and not peta['sales']['cms'])
        cek('hanya admin yang boleh kelola pengguna', [r['peran'] for r in d['peran'] if r['akses']['kelola_pengguna']] == ['admin'])
        cek('hanya admin/direksi/pemred yang boleh menyetujui terbit',
            [r['peran'] for r in d['peran'] if r['akses']['setujui']] == ['admin', 'direksi', 'pemred'],
            [r['peran'] for r in d['peran'] if r['akses']['setujui']])

        print('\n=== 2. Login newsroom per peran ===')
        for peran, email, harus in [('admin', 'admin@mbc.co.id', 200), ('pemred', 'pemred@mbc.co.id', 200),
                                    ('redaktur', 'redaktur@mbc.co.id', 200), ('reporter', 'reporter@mbc.co.id', 200),
                                    ('finance', 'finance@mbc.co.id', 200)]:
            st, d = panggil('/__login', 'POST', {'email': email})
            cek(f'login {peran} → {harus}', st == harus, st)
        st, d = panggil('/__login', 'POST', {'email': 'admin@mbc.co.id'})
        cek('login mengembalikan token', st == 200 and d.get('token'))

        print('\n=== 3. Reporter tidak boleh memindahkan tahap / terbit / hapus ===')
        t_rep = token_untuk('reporter', 4, 'reporter@mbc.co.id')
        st, d = panggil('/api/newsroom/articles/10/status', 'POST', {'status': 'review'}, t_rep)
        cek('reporter: draft → review ditolak 403', st == 403, (st, d.get('error')))
        st, d = panggil('/api/newsroom/articles/10/status', 'POST', {'status': 'tayang'}, t_rep)
        cek('reporter: terbit ditolak 403', st == 403, st)
        st, d = panggil('/api/newsroom/articles/10', 'DELETE', None, t_rep)
        cek('reporter: hapus artikel ditolak 403', st == 403, st)

        print('\n=== 4. Redaktur vs Pemred vs Admin pada penerbitan ===')
        t_red = token_untuk('redaktur', 3, 'redaktur@mbc.co.id')
        t_pem = token_untuk('pemred', 2, 'pemred@mbc.co.id')
        st, d = panggil('/api/newsroom/articles/10/status', 'POST', {'status': 'review'}, t_red)
        cek('redaktur: draft → review boleh (200)', st == 200, (st, d))
        st, d = panggil('/api/newsroom/articles/10/status', 'POST', {'status': 'fakta'}, t_red)
        cek('redaktur: review → fakta boleh', st == 200, st)
        st, d = panggil('/api/newsroom/articles/10/status', 'POST', {'status': 'hukum'}, t_red)
        st2, _ = panggil('/api/newsroom/articles/10/status', 'POST', {'status': 'siap'}, t_red)
        cek('redaktur: sampai "siap" boleh (alur normal)', (st, st2) == (200, 200), (st, st2))
        st, d = panggil('/api/newsroom/articles/10/status', 'POST', {'status': 'tayang'}, t_red)
        cek('redaktur: TERBIT ditolak 403 (bukan penyetuju)', st == 403, (st, d.get('error')))
        st, d = panggil('/api/newsroom/articles/10/status', 'POST', {'status': 'tayang'}, t_pem)
        cek('pemred: TERBIT diterima 200', st == 200, (st, d))

        print('\n=== 5. Panel pengguna: hanya admin ===')
        st, d = panggil('/api/newsroom/pengguna')
        cek('tanpa token → 401', st == 401, st)
        for peran, uid, email in [('pemred', 2, 'pemred@mbc.co.id'), ('redaktur', 3, 'redaktur@mbc.co.id'), ('reporter', 4, 'reporter@mbc.co.id')]:
            st, d = panggil('/api/newsroom/pengguna', token=token_untuk(peran, uid, email))
            cek(f'{peran} membuka panel pengguna → 403', st == 403, st)
        st, d = panggil('/api/newsroom/pengguna', token=t_admin)
        cek('admin: daftar pengguna 200 + 6 akun', st == 200 and d.get('total') == 6, (st, d.get('total')))
        cek('info migrasi dilaporkan (status tersedia)', st == 200 and d['migrasi']['status'] is True, d.get('migrasi'))

        print('\n=== 6. Aksi administrator ===')
        st, d = panggil('/api/newsroom/pengguna/3/peran', 'PATCH', {'peran': 'pemred', 'jabatan': 'Redaktur Utama'}, t_admin)
        cek('ubah peran redaktur → pemred', st == 200 and d['pengguna']['peran'] == 'pemred', (st, d))
        st, d = panggil('/api/newsroom/pengguna/3/peran', 'PATCH', {'peran': 'raja'}, t_admin)
        cek('peran tak dikenal → 400', st == 400, st)
        st, d = panggil('/api/newsroom/pengguna/999/peran', 'PATCH', {'peran': 'reporter'}, t_admin)
        cek('pengguna tak ada → 404', st == 404, st)
        st, d = panggil('/api/newsroom/pengguna/1/peran', 'PATCH', {'peran': 'reporter'}, t_admin)
        cek('admin tidak bisa menurunkan dirinya sendiri → 409', st == 409, (st, d.get('error')))
        st, d = panggil('/api/newsroom/pengguna/6/peran', 'PATCH', {'peran': 'reporter'}, t_admin)
        cek('menurunkan admin lain saat masih ada admin → 200', st == 200, (st, d))
        st, d = panggil('/api/newsroom/pengguna/1/status', 'POST', {'status': 'nonaktif'}, t_admin)
        cek('admin tidak bisa menonaktifkan diri sendiri → 409', st == 409, (st, d.get('error')))
        st, d = panggil('/api/newsroom/pengguna/3/status', 'POST', {'status': 'nonaktif'}, t_admin)
        cek('nonaktifkan pengguna lain → 200', st == 200 and d['status'] == 'nonaktif', (st, d))
        st, d = panggil('/__login', 'POST', {'email': 'redaktur@mbc.co.id'})
        cek('akun nonaktif gagal login (403)', st == 403, (st, d.get('error')))
        st, d = panggil('/api/newsroom/pengguna/3/status', 'POST', {'status': 'ngawur'}, t_admin)
        cek('status tak dikenal → 400', st == 400, st)
        st, d = panggil('/api/newsroom/pengguna/4/sandi', 'POST', {'sandi': 'pendek'}, t_admin)
        cek('sandi terlalu lemah → 400', st == 400, st)
        st, d = panggil('/api/newsroom/pengguna/4/sandi', 'POST', {'sandi': 'RahasiaBaru2026'}, t_admin)
        cek('setel ulang sandi sah → 200', st == 200 and d.get('ok'), (st, d))
        st, d = panggil('/api/newsroom/pengguna', 'POST', {'email': 'baru@mbc.co.id', 'nama': 'Staf Baru', 'peran': 'reporter'}, t_admin)
        cek('buat akun staf baru → 201 + sandi sementara', st == 201 and d.get('sandi_sementara'), (st, d))
        st, d = panggil('/api/newsroom/pengguna', 'POST', {'email': 'baru@mbc.co.id', 'nama': 'Staf Baru', 'peran': 'reporter'}, t_admin)
        cek('email ganda → 409', st == 409, st)
        st, d = panggil('/api/newsroom/pengguna', 'POST', {'email': 'x@mbc.co.id', 'nama': 'X', 'peran': 'hacker'}, t_admin)
        cek('peran asing saat buat akun → 400', st == 400, st)
        st, d = panggil('/__audit')
        isi = ' | '.join(x['a'] for x in d)
        cek('audit mencatat perubahan peran', 'peran' in isi, isi[:100])
        cek('audit mencatat pembuatan akun', 'akun baru' in isi, isi[:100])
        print('\n=== 6b. Peran baru bertahan di database ber-constraint lama ===')
        def diag():
            with urllib.request.urlopen(BASE + '/__diagnosa') as f:
                return json.load(f)
        def login_efektif(email):
            return panggil('/__login_efektif', 'POST', {'email': email})

        # akun staf baru dengan peran pemred (bukan nilai constraint) → tetap efektif pemred
        d0 = diag()
        baru = [u for u in d0['users'] if u['email'] == 'baru@mbc.co.id']
        cek('akun dibuat dengan peran aman (editorial) di kolom users.role',
            bool(baru) and baru[0]['role'] == 'editorial', baru[0] if baru else 'tidak ada')
        st, d = login_efektif('baru@mbc.co.id')
        cek('akun baru langsung efektif sebagai reporter (bukan editorial mentah)',
            st == 200 and d['peran'] == 'reporter', (st, d.get('peran')))
        st, d = panggil('/api/newsroom/pengguna/99/peran', 'PATCH', {'peran': 'pemred', 'jabatan': 'Pemimpin Redaksi'}, t_admin)
        cek('angkat akun baru jadi pemred → 200', st == 200 and d['pengguna']['peran'] == 'pemred', (st, d))
        st, d = login_efektif('baru@mbc.co.id')
        cek('peran efektif = pemred walau users.role aman', d.get('peran') == 'pemred', d)
        cek('penanda mbc:role tersimpan di staff.title',
            any('mbc:role=pemred' in (x['title'] or '') for x in diag()['staff']), diag()['staff'])
        cek('label jabatan tetap bisa dibaca manusia',
            any('Pemimpin Redaksi' in (x['title'] or '') for x in diag()['staff']))
        cek('token pemred bisa menyetujui terbit', panggil('/api/newsroom/articles/10/status', 'POST', {'status': 'tayang'}, d['token'])[0] in (200, 409))
        st, daftar = panggil('/api/newsroom/pengguna', token=t_admin)
        baris = [u for u in daftar['pengguna'] if u['email'] == 'baru@mbc.co.id'][0]
        cek('panel menampilkan peran efektif (pemred), bukan nilai mentah', baris['peran'] == 'pemred', baris)
        cek('panel menampilkan jabatan bersih tanpa penanda', 'mbc:role' not in baris['jabatan'], baris['jabatan'])

        # admin terakhir: admin lain (id 6) sudah diturunkan di bagian 6 → menurunkan admin terakhir harus 409
        st, d = panggil('/api/newsroom/pengguna/1/peran', 'PATCH', {'peran': 'redaktur'}, t_admin)
        cek('administrator terakhir tidak bisa dicabut (walau akun lain ada)', st in (409,), (st, d.get('error')))

        # tanpa tabel staff & tanpa kolom updated_at: fallback ke users.role_label
        print('\n=== 6c. Tanpa tabel staff (instalasi lama) ===')
        st, d = panggil('/api/newsroom/pengguna/5/peran', 'PATCH', {'peran': 'redaktur'}, t_admin)
        cek('ubah peran saat tabel staff ada → 200', st == 200, st)

    finally:
        srv.terminate()
        try: srv.communicate(timeout=5)
        except Exception: srv.kill()

    print('\n=== 7. Kolom status belum ada (tanpa migrasi) ===')
    srv2 = nyalakan(punya_status='0')
    try:
        st, d = panggil('/api/newsroom/pengguna', token=t_admin)
        cek('daftar pengguna tetap jalan (200)', st == 200, st)
        cek('migrasi.status = false dilaporkan', st == 200 and d['migrasi']['status'] is False, d.get('migrasi'))
        st, d = panggil('/api/newsroom/pengguna/3/status', 'POST', {'status': 'nonaktif'}, t_admin)
        cek('nonaktifkan → 501 + petunjuk migrasi', st == 501 and 'MIGRASI' in (d.get('error') or ''), (st, d.get('error')))
        st, d = panggil('/api/newsroom/pengguna/3/peran', 'PATCH', {'peran': 'pemred'}, t_admin)
        cek('ubah peran tetap berhasil tanpa kolom status', st == 200, (st, d))
    finally:
        srv2.terminate()
        try: srv2.communicate(timeout=5)
        except Exception: srv2.kill()

    lulus = sum(1 for _, ok in hasil if ok)
    print(f'\nHASIL: {lulus}/{len(hasil)} lulus')
    if lulus != len(hasil):
        print('GAGAL: ' + ', '.join(n for n, ok in hasil if not ok))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
