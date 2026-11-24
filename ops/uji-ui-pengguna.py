"""Uji UI panel Pengguna & Peran (khusus administrator) di browser.

Menguji viewPengguna() dari server/newsroom/cms.js terhadap backend tiruan
yang bentuk responsnya disalin dari server/newsroom-pengguna.js (matriks
peran diambil dari server/peran.js yang sebenarnya).

Ditambah pemeriksaan statis: menu admin, pendaratan per peran, dan pintu
internal di website/masuk.html.

Jalankan: python3 ops/uji-ui-pengguna.py
"""
import json
import os
import re
import subprocess
import sys
import textwrap
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get('PORT_UI_PENGGUNA', '8125'))
BASE = f'http://127.0.0.1:{PORT}'

PAGE = textwrap.dedent('''<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Uji Pengguna & Peran</title>
<style>:root{--red:#e63329;--red2:#ff5245;--line:#22304a;--muted:#94a0b8;--text:#dbe2f0;--card:#0e1626;--panel:#111c2e}
body{background:#070d18;color:var(--text);font-family:system-ui,sans-serif;margin:0;padding:1rem}
.cms-panel{max-width:1150px;margin-bottom:1rem}</style></head>
<body><div id="root"></div>
<script src="/uji-global.js"></script>
<script src="/cms.js"></script>
<script>
  setTimeout(() => { window.viewPengguna(document.getElementById('root')); }, 60);
</script></body></html>''')

GLOBAL = textwrap.dedent('''/* util global tiruan yang biasanya disediakan newsroom/index.html */
const $ = s => (s.startsWith('#') ? document.getElementById(s.slice(1)) : document.querySelector(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast = m => { (window.__toast = window.__toast || []).push(String(m)); };
const navTo = v => { window.__nav = v; };
const fmtRp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const session = () => ({ name: 'Admin Uji', email: 'admin@mbcindonesia.tv', role: 'admin', roleLabel: 'Administrator' });
const api = { async req(path, opt) {
  const r = await fetch(path, { method: (opt && opt.method) || 'GET', headers: { 'Content-Type': 'application/json' }, body: opt && opt.body ? JSON.stringify(opt.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
  return d;
} };
/* prompt/confirm/alert dapat dikendalikan dari uji */
window.__jawab = [];
window.__alert = [];
window.prompt = () => (window.__jawab.length ? window.__jawab.shift() : null);
window.confirm = () => true;
window.alert = m => { window.__alert.push(String(m)); };
''')

SERVER = textwrap.dedent(r'''
process.env.JWT_SECRET = 'uji-ui-pengguna-rahasia-panjang-123456789';
const express = require('express');
const path = require('path');
const app = express();
app.use(express.json({ limit: '2mb' }));
const RBAC = require(process.env.ROOT + '/server/peran');

const TOLAK = process.env.MODE_TOLAK === '1';
const MIGRASI = process.env.MODE_MIGRASI !== '0';

let PENGGUNA = [
  { id: 1, email: 'admin@mbcindonesia.tv',   nama: 'Admin Uji',        peran: 'admin',    jabatan: 'Administrator Sistem', status: 'aktif' },
  { id: 2, email: 'pimpinan@mbcindonesia.tv', nama: 'Budi Santoso',    peran: 'pemred',   jabatan: 'Pemimpin Redaksi',     status: 'aktif' },
  { id: 3, email: 'redaktur@mbcindonesia.tv', nama: 'Sari Dewi',       peran: 'redaktur', jabatan: 'Redaktur Pelaksana',   status: 'aktif' },
  { id: 4, email: 'reporter@mbcindonesia.tv', nama: 'Andi Pratama',    peran: 'reporter', jabatan: 'Reporter Lapangan',    status: 'aktif' },
  { id: 5, email: 'keuangan@mbcindonesia.tv', nama: 'Rina Wulandari',  peran: 'finance',  jabatan: 'Manajer Keuangan',     status: 'aktif' },
  { id: 6, email: 'sales@mbcindonesia.tv',    nama: 'Doni Saputra',    peran: 'sales',    jabatan: 'Manajer Pemasaran',    status: 'aktif' }
];
const CATATAN = [];

const lengkapi = u => Object.assign({}, u, { peran_nama: RBAC.info(u.peran).nama });

app.get('/cms.js', (req, res) => res.type('application/javascript').sendFile(path.join(process.env.ROOT, 'server/newsroom/cms.js')));
app.get('/uji-global.js', (req, res) => res.type('application/javascript').send(process.env.GLOBAL_JS));
app.get('/', (req, res) => res.type('html').send(process.env.PAGE_HTML));
app.get('/__catatan', (req, res) => res.json({ catatan: CATATAN }));

function gerbang(req, res, next) {
  if (TOLAK) return res.status(403).json({ error: 'Hanya administrator yang boleh mengelola pengguna & peran' });
  next();
}

app.get('/api/newsroom/pengguna', gerbang, (req, res) => {
  res.json({
    pengguna: PENGGUNA.map(lengkapi), total: PENGGUNA.length,
    peran: RBAC.matriks(), kolom: RBAC.KOLOM_MATRIKS,
    migrasi: { status: MIGRASI, updated_at: MIGRASI, last_login: MIGRASI },
    saya: { email: 'admin@mbcindonesia.tv', peran: 'admin' }
  });
});

app.patch('/api/newsroom/pengguna/:id/peran', gerbang, (req, res) => {
  const id = Number(req.params.id);
  const { peran, jabatan } = req.body || {};
  CATATAN.push({ aksi: 'peran', id, peran, jabatan });
  const u = PENGGUNA.find(x => x.id === id);
  if (!u) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
  u.peran = peran; u.jabatan = jabatan || RBAC.info(peran).nama;
  res.json({ ok: true, pengguna: lengkapi(u) });
});

app.post('/api/newsroom/pengguna/:id/sandi', gerbang, (req, res) => {
  const id = Number(req.params.id);
  CATATAN.push({ aksi: 'sandi', id, sandi: (req.body || {}).sandi });
  if (String((req.body || {}).sandi || '').length < 8) return res.status(400).json({ error: 'Kata sandi minimal 8 karakter' });
  res.json({ ok: true, catatan: 'Kata sandi disetel ulang. Sampaikan lewat kanal aman.' });
});

app.post('/api/newsroom/pengguna/:id/status', gerbang, (req, res) => {
  const id = Number(req.params.id);
  const status = (req.body || {}).status;
  CATATAN.push({ aksi: 'status', id, status });
  const u = PENGGUNA.find(x => x.id === id);
  if (!u) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
  u.status = status;
  res.json({ ok: true, pengguna: lengkapi(u) });
});

app.post('/api/newsroom/pengguna', gerbang, (req, res) => {
  const { email, nama, peran, jabatan } = req.body || {};
  CATATAN.push({ aksi: 'buat', email, nama, peran, jabatan });
  if (PENGGUNA.some(u => u.email === email)) return res.status(409).json({ error: 'Email sudah terdaftar' });
  const baru = { id: PENGGUNA.length + 1, email, nama, peran, jabatan: jabatan || '', status: 'aktif' };
  PENGGUNA.push(baru);
  res.status(201).json({ ok: true, pengguna: lengkapi(baru), sandi_sementara: 'MbC-7f3k9q' });
});

app.listen(process.env.PORT_UI, '127.0.0.1', () => console.log('siap'));
''')


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Playwright tidak tersedia'); return 2

    hpath = os.path.join(ROOT, 'server', 'scripts', '_harness-ui-pengguna.js')
    os.makedirs(os.path.dirname(hpath), exist_ok=True)
    open(hpath, 'w').write(SERVER)
    hasil = []

    def cek(nama, kondisi, info=''):
        hasil.append((nama, bool(kondisi)))
        print(('  ✅ ' if kondisi else '  ❌ ') + nama + (('  → ' + str(info)) if info and not kondisi else ''))

    # ---------- 0. pemeriksaan statis berkas ----------
    print('\n=== 0. Berkas menu & pintu akses ===')
    idx = open(os.path.join(ROOT, 'server/newsroom/index.html'), encoding='utf-8').read()
    cek("menu 'Pengguna & Peran' hanya untuk admin",
        bool(re.search(r"id:'pengguna'[^}]*roles:\['admin'\]", idx)))
    cek('viewPengguna terdaftar di router', 'pengguna:viewPengguna' in idx)
    cek('judul view pengguna ada', "'Pengguna & Peran'" in idx)
    cek('pendaratan per peran (reporter→artikel, finance→keuangan, sales→crm)',
        "reporter:'articles'" in idx and "finance:'keuangan'" in idx and "sales:'crm'" in idx)
    cek('menu keuangan tidak lagi memuat editorial',
        bool(re.search(r"id:'keuangan'[^}]*roles:\['admin','direksi','finance'\]", idx)))
    masuk = open(os.path.join(ROOT, 'website/masuk.html'), encoding='utf-8').read()
    cek('masuk.html menautkan pintu internal', 'href="newsroom/"' in masuk)
    cek('masuk.html menyebut akun staf dibuat administrator', 'Akun staf dibuat oleh' in masuk)

    def jalankan(mode_tolak='0', migrasi='1'):
        env = dict(os.environ, ROOT=ROOT, PORT_UI=str(PORT), PAGE_HTML=PAGE, GLOBAL_JS=GLOBAL,
                   MODE_TOLAK=mode_tolak, MODE_MIGRASI=migrasi)
        p = subprocess.Popen(['node', hpath], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for _ in range(60):
            try:
                urllib.request.urlopen(BASE + '/', timeout=1); break
            except urllib.error.HTTPError:
                break
            except Exception:
                time.sleep(0.25)
        return p

    srv = jalankan()
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_context(viewport={'width': 1360, 'height': 1100}).new_page()
            galat = []
            pg.on('pageerror', lambda e: galat.append(str(e)))
            pg.goto(BASE + '/', wait_until='networkidle')
            pg.wait_for_selector('.pg-tabel', timeout=15000)

            print('\n=== 1. Tampilan awal ===')
            cek('6 akun staf tampil', pg.locator('.pg-tabel tbody tr').count() == 6, pg.locator('.pg-tabel tbody tr').count())
            cek('judul menyebut jumlah akun', '6 akun staf' in pg.inner_text('#root'), pg.inner_text('#root')[:80])
            cek('baris sendiri ditandai (Anda)', '(Anda)' in pg.inner_text('.pg-tabel'))
            cek('8 peran pada matriks', pg.locator('.pg-matriks tbody tr').count() == 8, pg.locator('.pg-matriks tbody tr').count())
            cek('7 kolom izin pada matriks', pg.locator('.pg-matriks thead th').count() == 8, pg.locator('.pg-matriks thead th').count())
            cek('matriks menandai izin admin penuh', pg.locator('.pg-matriks tbody tr').first.locator('.pg-ya').count() == 7,
                pg.locator('.pg-matriks tbody tr').first.locator('.pg-ya').count())
            cek('tidak ada peringatan migrasi saat kolom ada', 'belum ada' not in pg.inner_text('#root'))
            cek('tanpa galat JS', not galat, galat)

            print('\n=== 2. Pencarian akun ===')
            pg.fill('#pgCari', 'budi')
            pg.wait_for_timeout(250)
            cek('cari "budi" → 1 baris', pg.locator('.pg-tabel tbody tr').count() == 1, pg.locator('.pg-tabel tbody tr').count())
            cek('baris benar: Budi Santoso', 'Budi Santoso' in pg.inner_text('.pg-tabel'))
            pg.fill('#pgCari', 'zzzz')
            pg.wait_for_timeout(250)
            cek('tanpa hasil → pesan jujur', 'Tidak ada akun yang cocok' in pg.inner_text('#root'))
            pg.fill('#pgCari', '')
            pg.wait_for_timeout(250)
            cek('kosongkan pencarian → 6 baris lagi', pg.locator('.pg-tabel tbody tr').count() == 6)

            print('\n=== 3. Ubah peran lewat pilihan di kolom ===')
            pilih4 = pg.locator('[data-pilih="4"]')
            cek('kolom peran berupa pilihan (8 opsi)', pilih4.locator('option').count() == 8, pilih4.locator('option').count())
            cek('peran saat ini terpilih otomatis', pilih4.input_value() == 'reporter', pilih4.input_value())
            pilih4.select_option('pemred')
            pg.wait_for_timeout(800)
            baris4 = pg.inner_text('.pg-tabel tbody tr:nth-child(4)').lower()
            pilih4 = pg.locator('[data-pilih="4"]')
            cek('pilihan berubah ke pemred', pilih4.input_value() == 'pemred', pilih4.input_value())
            cek('jabatan ikut jadi nama peran', 'pemimpin redaksi' in baris4, baris4)
            catatan = json.load(urllib.request.urlopen(BASE + '/__catatan'))['catatan']
            kirim = [c for c in catatan if c['aksi'] == 'peran']
            cek('PATCH peran terkirim dengan data benar',
                bool(kirim) and kirim[-1]['id'] == 4 and kirim[-1]['peran'] == 'pemred', kirim[-1:] if kirim else 'kosong')
            cek('toast perubahan peran muncul',
                any('pemred' in t.lower() or 'pemimpin' in t.lower() for t in pg.evaluate('window.__toast || []')),
                pg.evaluate('window.__toast || []')[-1:])
            cek('badge peran di matriks tetap terbaca',
                pg.locator('.pg-matriks .pg-peran').first.inner_text().lower() == 'administrator')

            print('\n=== 3b. Ubah label jabatan saja ===')
            pg.evaluate("window.__jawab = ['Wakil Pemimpin Redaksi']")
            pg.locator('[data-ubah="4"]').click()
            pg.wait_for_timeout(700)
            catatan = json.load(urllib.request.urlopen(BASE + '/__catatan'))['catatan']
            kj = [c for c in catatan if c['aksi'] == 'peran']
            cek('label jabatan terkirim dengan peran tetap pemred',
                kj[-1]['peran'] == 'pemred' and kj[-1]['jabatan'] == 'Wakil Pemimpin Redaksi', kj[-1])
            cek('jabatan baru tampil di baris',
                'wakil pemimpin redaksi' in pg.inner_text('.pg-tabel tbody tr:nth-child(4)').lower())

            print('\n=== 4. Batal ubah peran tidak mengirim apa pun ===')
            sebelum = len([c for c in json.load(urllib.request.urlopen(BASE + '/__catatan'))['catatan'] if c['aksi'] == 'peran'])
            pg.evaluate("window.__jawab = [null]")
            pg.locator('[data-ubah="6"]').click()
            pg.wait_for_timeout(500)
            sesudah = len([c for c in json.load(urllib.request.urlopen(BASE + '/__catatan'))['catatan'] if c['aksi'] == 'peran'])
            cek('prompt dibatalkan → tidak ada permintaan', sebelum == sesudah, f'{sebelum} → {sesudah}')

            print('\n=== 5. Setel sandi ===')
            pg.evaluate("window.__jawab = ['rahasia123']")
            pg.locator('[data-sandi="5"]').click()
            pg.wait_for_timeout(600)
            catatan = json.load(urllib.request.urlopen(BASE + '/__catatan'))['catatan']
            sandi = [c for c in catatan if c['aksi'] == 'sandi']
            cek('POST sandi terkirim', bool(sandi) and sandi[-1]['id'] == 5 and sandi[-1]['sandi'] == 'rahasia123', sandi[-1:] if sandi else 'kosong')
            cek('sandi tidak pernah ditampilkan di UI', 'rahasia123' not in pg.inner_text('#root'))

            print('\n=== 6. Nonaktifkan akun ===')
            pg.locator('[data-status="6"]').click()
            pg.wait_for_timeout(700)
            baris6 = pg.locator('.pg-tabel tbody tr:nth-child(6)')
            cek('baris jadi nonaktif (dicoret)', 'pg-nonaktif' in (baris6.get_attribute('class') or ''), baris6.get_attribute('class'))
            cek('label status = nonaktif', 'nonaktif' in baris6.inner_text().lower())
            cek('tombol berubah jadi Aktifkan', 'Aktifkan' in baris6.inner_text(), baris6.inner_text())
            catatan = json.load(urllib.request.urlopen(BASE + '/__catatan'))['catatan']
            st = [c for c in catatan if c['aksi'] == 'status']
            cek('POST status = nonaktif', bool(st) and st[-1]['status'] == 'nonaktif', st[-1:] if st else 'kosong')
            pg.locator('[data-status="6"]').click()
            pg.wait_for_timeout(600)
            cek('klik lagi → aktif kembali', 'pg-nonaktif' not in (pg.locator('.pg-tabel tbody tr:nth-child(6)').get_attribute('class') or ''))

            print('\n=== 7. Buat akun staf baru ===')
            pg.evaluate("window.__jawab = ['baru@mbcindonesia.tv', 'Nia Kurnia', '4', 'Redaktur Desk Ekonomi']")
            pg.click('#pgBaru')
            pg.wait_for_timeout(800)
            cek('daftar bertambah jadi 7 baris', pg.locator('.pg-tabel tbody tr').count() == 7, pg.locator('.pg-tabel tbody tr').count())
            cek('akun baru tampil di tabel', 'nia kurnia' in pg.inner_text('.pg-tabel').lower())
            alerts = pg.evaluate('window.__alert || []')
            cek('sandi sementara ditampilkan sekali lewat alert',
                bool(alerts) and 'MbC-7f3k9q' in alerts[-1], alerts[-1:] if alerts else 'kosong')
            catatan = json.load(urllib.request.urlopen(BASE + '/__catatan'))['catatan']
            buat = [c for c in catatan if c['aksi'] == 'buat']
            cek('POST akun baru dengan peran & jabatan benar',
                bool(buat) and buat[-1]['peran'] == 'redaktur' and buat[-1]['jabatan'] == 'Redaktur Desk Ekonomi',
                buat[-1:] if buat else 'kosong')

            print('\n=== 8. Galat server ditampilkan, bukan ditelan ===')
            pg.evaluate("window.__jawab = ['admin@mbcindonesia.tv', 'Admin Kedua', 'admin', '']")
            pg.click('#pgBaru')
            pg.wait_for_timeout(700)
            cek('email ganda → pesan galat dari server muncul di toast',
                any('sudah terdaftar' in t for t in pg.evaluate('window.__toast || []')),
                pg.evaluate('window.__toast || []')[-1:])
            cek('daftar tidak bertambah saat gagal', pg.locator('.pg-tabel tbody tr').count() == 7, pg.locator('.pg-tabel tbody tr').count())
            cek('tetap tanpa galat JS', not galat, galat)
            br.close()
    finally:
        srv.terminate(); srv.wait(timeout=10)

    print('\n=== 9. Server menolak peran non-admin ===')
    srv = jalankan(mode_tolak='1')
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_page()
            pg.goto(BASE + '/', wait_until='networkidle')
            pg.wait_for_timeout(600)
            teks = pg.inner_text('#root')
            cek('pesan 403 ditampilkan', 'Hanya administrator' in teks, teks[:120])
            cek('tabel pengguna tidak dirender', pg.locator('.pg-tabel').count() == 0)
            cek('tidak ada data staf yang bocor', 'Budi Santoso' not in teks)
            br.close()
    finally:
        srv.terminate(); srv.wait(timeout=10)

    print('\n=== 10. Sebelum migrasi (kolom status belum ada) ===')
    srv = jalankan(migrasi='0')
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_page()
            pg.goto(BASE + '/', wait_until='networkidle')
            pg.wait_for_selector('.pg-tabel', timeout=15000)
            teks = pg.inner_text('#root')
            cek('peringatan migrasi tampil', 'belum ada' in teks and 'MIGRASI-1.6.1.sql' in teks)
            cek('tombol status disembunyikan', pg.locator('[data-status]').count() == 0, pg.locator('[data-status]').count())
            cek('ubah peran tetap tersedia', pg.locator('[data-ubah]').count() == 6, pg.locator('[data-ubah]').count())
            cek('daftar pengguna tetap tampil', pg.locator('.pg-tabel tbody tr').count() == 6)
            br.close()
    finally:
        srv.terminate(); srv.wait(timeout=10)

    lulus = sum(1 for _, ok in hasil if ok)
    print(f'\nHASIL: {lulus}/{len(hasil)} lulus')
    return 0 if lulus == len(hasil) else 1


if __name__ == '__main__':
    sys.exit(main())
