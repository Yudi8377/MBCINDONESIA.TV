"""Uji API multi-agen AI (server/newsroom-agen.js) tanpa PostgreSQL.

Memakai Express asli + klien pg tiruan (pool.query dipetakan ke data contoh),
sehingga rute, middleware peran, validasi, dan bentuk respons benar-benar diuji.

Jalankan: python3 ops/uji-agen-ai.py
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
PORT = int(os.environ.get('PORT_UJI', '8123'))
BASE = f'http://127.0.0.1:{PORT}'

HARNESS = textwrap.dedent(r'''
process.env.JWT_SECRET = 'uji-rahasia-lokal-panjang-sekali-1234567890';
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json({ limit: '1mb' }));

/* ---------- pg tiruan: query dipetakan ke data contoh ---------- */
const ARTIKEL = {
  1: { id: 1, slug: 'n-bmkg-kediri-banjir', title: 'BMKG Peringatkan Hujan Ekstrem Sepekan ke Depan di Jawa Timur',
       deck: 'Curah hujan 40 persen di atas normal.', channel_name: 'Lingkungan', status: 'draft', tags: ['banjir', 'kediri'],
       sources: [], fact_checks: [], body: 'BMKG mengeluarkan peringatan dini cuaca ekstrem untuk Jawa Timur.\n\nCurah hujan di Kediri diprediksi 40 persen di atas normal. Menurut Kepala Stasiun Klimatologi, warga diminta bersiap menghadapi genangan.\n\nDilaporkan sebanyak 1.200 rumah terdampak pada kejadian tahun lalu. Pemerintah kota menyiapkan posko dan jalur evakuasi.' },
  2: { id: 2, slug: 'n-kopi-kediri', title: 'Kopi Robusta Kediri Tembus Pasar Eropa', deck: 'Koperasi petani mengekspor 12 ton.',
       channel_name: 'Ekonomi', status: 'tayang', tags: ['kopi', 'ekspor'], sources: [{ title: 'Rilis Koperasi' }], fact_checks: [], body: 'Koperasi petani Kediri mengekspor kopi robusta ke Eropa.\n\nMenurut ketua koperasi, volume ekspor mencapai 12 ton per bulan.' }
};
const log = [];
const pool = {
  async query(sql, params) {
    log.push({ sql: String(sql).replace(/\s+/g, ' ').slice(0, 90), params });
    const s = String(sql);
    if (/FROM articles a LEFT JOIN channels/.test(s)) return { rows: ARTIKEL[params[0]] ? [ARTIKEL[params[0]]] : [] };
    if (/SELECT id, slug, title, status/.test(s)) return { rows: Object.values(ARTIKEL).map(a => ({ id: a.id, slug: a.slug, title: a.title, status: a.status, deck: a.deck })) };
    if (/^\s*SELECT r.id/.test(s.trim())) return { rows: [{ id: 1, agent_id: 'klarifikasi', article_id: 1, duration_ms: 3, created_by: 'uji@mbc', created_at: new Date().toISOString(), article_title: ARTIKEL[1].title, ringkas: 'contoh', sumber: 'lokal' }] };
    if (/INSERT INTO ai_findings/.test(s)) return { rows: [] };
    if (/INSERT INTO ai_agents/.test(s)) return { rows: [] };
    if (/INSERT INTO ai_runs/.test(s)) return { rows: [{ id: log.length }] };
    return { rows: [] };
  }
};
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'Token tidak ada' });
  try { req.user = jwt.verify(t, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token tidak valid / kedaluwarsa' }); }
}
const audit_cat = [];
const audit = async (a, w) => { audit_cat.push({ a, w }); };

require(process.env.ROOT + '/server/newsroom-agen')(app, { pool, requireAuth, audit });
app.get('/__audit', (req, res) => res.json(audit_cat));
app.get('/__sql', (req, res) => res.json(log));
app.listen(process.env.PORT_UJI, '127.0.0.1', () => console.log('siap'));
''')


def panggil(jalur, metode='GET', isi=None, token=None):
    data = json.dumps(isi).encode() if isi is not None else None
    r = urllib.request.Request(BASE + jalur, data=data, method=metode,
                               headers={'Content-Type': 'application/json',
                                        **({'Authorization': 'Bearer ' + token} if token else {})})
    try:
        with urllib.request.urlopen(r, timeout=40) as f:
            return f.status, json.loads(f.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def main():
    # harness ditulis ke /tmp agar tidak mengotori repo
    path = os.path.join(ROOT, 'server', 'scripts', '_harness-agen.js')
    open(path, 'w').write(HARNESS)
    env = dict(os.environ, PORT_UJI=str(PORT), ROOT=ROOT)
    env.pop('LLM_API_KEY', None)
    env['LLM_PROVIDER'] = ''
    srv = subprocess.Popen(['node', path], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    token = subprocess.run(['node', '-e',
        "const jwt=require('jsonwebtoken');process.stdout.write(jwt.sign({email:'uji.editorial@mbc.co.id',role:'editorial',name:'Uji Editorial'},'uji-rahasia-lokal-panjang-sekali-1234567890',{expiresIn:'1h'}))"],
        cwd=ROOT, capture_output=True, text=True).stdout
    token_salah_peran = subprocess.run(['node', '-e',
        "const jwt=require('jsonwebtoken');process.stdout.write(jwt.sign({email:'sales@mbc.co.id',role:'sales',name:'Sales'},'uji-rahasia-lokal-panjang-sekali-1234567890',{expiresIn:'1h'}))"],
        cwd=ROOT, capture_output=True, text=True).stdout

    for _ in range(60):
        try:
            urllib.request.urlopen(BASE + '/api/newsroom/agen/daftar', timeout=1)
            break
        except urllib.error.HTTPError:
            break
        except Exception:
            time.sleep(0.25)

    hasil = []

    def cek(nama, kondisi, info=''):
        hasil.append((nama, bool(kondisi), info))
        print(('  ✅ ' if kondisi else '  ❌ ') + nama + (('  → ' + str(info)) if info and not kondisi else ''))

    print('\n=== 1. Keamanan akses ===')
    st, _ = panggil('/api/newsroom/agen/daftar')
    cek('tanpa token → 401', st == 401, st)
    st, _ = panggil('/api/newsroom/agen/daftar', token=token_salah_peran)
    cek('peran sales → 403', st == 403, st)
    st, d = panggil('/api/newsroom/agen/daftar', token=token)
    cek('peran editorial → 200', st == 200, st)
    cek('daftar berisi 6 agen', st == 200 and len(d.get('agen', [])) == 6, len(d.get('agen', [])))
    id_agen = [a['id'] for a in d.get('agen', [])]
    cek('id agen sesuai rancangan', id_agen == ['riset', 'klarifikasi', 'penyunting', 'seo', 'etika', 'data'], id_agen)
    cek('status LLM dilaporkan (mesin lokal)', d.get('llm', {}).get('aktif') is False, d.get('llm'))

    print('\n=== 2. Jalankan agen atas artikel CMS ===')
    st, d = panggil('/api/newsroom/agen/jalankan', 'POST', {'artikel_id': 1}, token)
    cek('200 + asal artikel', st == 200 and d.get('asal') == 'artikel', (st, d.get('asal')))
    h = {x['agent']: x for x in d.get('hasil', [])}
    cek('keenam agen mengembalikan hasil', len(h) == 6, list(h))
    cek('semua sumber = lokal (tanpa kunci API)', all(x['sumber'] == 'lokal' for x in h.values()), [x['sumber'] for x in h.values()])
    cek('klarifikasi menemukan klaim angka', any(k['jenis'] == 'angka' for k in h['klarifikasi']['data']['klaim']), h['klarifikasi']['data']['klaim'][:2])
    cek('klarifikasi menandai sumber kosong = belum layak', h['klarifikasi']['data']['status'] in ('belum layak tayang', 'perlu perbaikan'), h['klarifikasi']['data']['status'])
    cek('etika menandai atribusi kabur / PDP', len(h['etika']['temuan']) >= 1, h['etika']['temuan'])
    cek('seo memberi kata kunci & judul', h['seo']['data']['kata_kunci_utama'], h['seo']['data']['kata_kunci_utama'])
    cek('penyunting menghitung kata/paragraf', h['penyunting']['data']['kata'] > 20, h['penyunting']['data']['kata'])
    cek('data memberi sumber pembanding resmi', len(h['data']['data']['sumber_pembanding']) >= 1, h['data']['data']['sumber_pembanding'][:1])
    cek('riset memberi sudut & pemantauan', len(h['riset']['data']['sudut_belum_digarap']) >= 1, h['riset']['data']['sudut_belum_digarap'][:1])
    cek('tiap hasil punya durasi_ms', all('durasi_ms' in x for x in h.values()))

    print('\n=== 3. Pilih sebagian agen + draf teks ===')
    st, d = panggil('/api/newsroom/agen/jalankan', 'POST', {'artikel_id': 1, 'agen': ['klarifikasi', 'etika']}, token)
    cek('hanya 2 agen diminta → 2 hasil', st == 200 and len(d['hasil']) == 2, [x['agent'] for x in d.get('hasil', [])])
    st, d = panggil('/api/newsroom/agen/jalankan', 'POST', {'teks': 'Draf pendek saja.'}, token)
    cek('teks < 40 karakter → 400', st == 400, st)
    st, d = panggil('/api/newsroom/agen/jalankan', 'POST', {'teks': 'Pemerintah kota mengumumkan program baru untuk UMKM. Menurut kepala dinas, 500 pelaku usaha akan menerima pelatihan digital pada 2027. Program ini diklaim paling berhasil di Jawa Timur.'}, token)
    cek('draf teks bebas → 200 (asal teks)', st == 200 and d.get('asal') == 'teks', (st, d.get('asal')))
    cek('draf teks tidak ditulis ke tabel artikel', st == 200 and len(d.get('hasil', [])) == 6)
    st, d = panggil('/api/newsroom/agen/jalankan', 'POST', {'artikel_id': 1, 'agen': ['tidak-ada']}, token)
    cek('agen tak dikenal → 400', st == 400, st)
    st, d = panggil('/api/newsroom/agen/jalankan', 'POST', {'artikel_id': 999}, token)
    cek('artikel tak ada → 404', st == 404, st)

    print('\n=== 4. Pencarian & simpan temuan ===')
    st, d = panggil('/api/newsroom/agen/cari', 'POST', {'q': 'kopi'}, token)
    cek('cari "kopi" → artikel kopi di peringkat 1', st == 200 and d['hasil'] and 'kopi' in d['hasil'][0]['judul'].lower(), d.get('hasil', [])[:1])
    st, d = panggil('/api/newsroom/agen/cari', 'POST', {'q': 'ab'}, token)
    cek('kueri < 3 karakter → 400', st == 400, st)
    st, d = panggil('/api/newsroom/agen/simpan', 'POST', {'artikel_id': 1, 'temuan': [
        {'agent': 'klarifikasi', 'tingkat': 'kritis', 'judul': 'Belum ada sumber', 'rincian': 'Tambahkan 2 sumber', 'bukti': ['x']},
        {'agent': 'penyunting', 'tingkat': 'saran', 'judul': 'Lead panjang'},
        {'agent': 'bukan-agen', 'judul': 'diabaikan'}]}, token)
    cek('simpan 2 temuan sah (agen asing diabaikan)', st == 200 and d.get('disimpan') == 2, d)
    st, d = panggil('/api/newsroom/agen/simpan', 'POST', {'artikel_id': 1, 'temuan': []}, token)
    cek('temuan kosong → 400', st == 400, st)

    print('\n=== 5. Riwayat & audit ===')
    st, d = panggil('/api/newsroom/agen/riwayat', token=token)
    cek('riwayat 200 dan berisi baris', st == 200 and len(d.get('riwayat', [])) >= 1, st)
    st, d = panggil('/__audit')
    isi_audit = ' | '.join(x['a'] for x in d)
    cek('audit mencatat jalan agen', 'Agen AI' in isi_audit, isi_audit[:120])
    cek('audit mencatat simpan temuan', 'temuan disimpan' in isi_audit, isi_audit[:120])

    srv.terminate()
    try:
        out = srv.communicate(timeout=5)[0]
    except Exception:
        srv.kill(); out = ''
    if 'Error' in out:
        print('\nLOG SERVER:\n' + out[-1500:])

    lulus = sum(1 for _, ok, _ in hasil if ok)
    print(f'\nHASIL: {lulus}/{len(hasil)} lulus')
    gagal = [n for n, ok, _ in hasil if not ok]
    if gagal:
        print('GAGAL: ' + ', '.join(gagal))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
