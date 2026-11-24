"""Uji UI Studio Multi-Agen AI di browser (Playwright) dengan backend tiruan.

Yang diuji: kartu 6 agen, pilih/batal agen, jalankan atas artikel, render hasil,
simpan temuan, pencarian arsip, draf teks bebas, badge lokal/hibrida, dan
perilaku saat server menolak (bukan editorial).

Jalankan: python3 ops/uji-ui-agen.py
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
PORT = int(os.environ.get('PORT_UI', '8124'))
BASE = f'http://127.0.0.1:{PORT}'

PAGE = textwrap.dedent('''<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>Uji Studio Agen</title>
<style>:root{--red:#e63329;--red2:#ff5245;--line:#22304a;--muted:#94a0b8;--text:#dbe2f0;--card:#0e1626;--panel:#111c2e}
body{background:#070d18;color:var(--text);font-family:system-ui,sans-serif;margin:0;padding:1rem}
.cms-panel,.cms-cols{max-width:1100px}</style></head>
<body><div id="root"></div>
<script src="/uji-global.js"></script>
<script src="/cms.js"></script>
<script>
  /* router tiruan: cukup memanggil viewAIStudio */
  document.addEventListener('DOMContentLoaded', () => {});
  setTimeout(() => { window.viewAIStudio(document.getElementById('root')); }, 60);
</script></body></html>''')

GLOBAL = textwrap.dedent('''/* util global tiruan yang biasanya disediakan newsroom/index.html */
const $ = s => (s.startsWith('#') ? document.getElementById(s.slice(1)) : document.querySelector(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast = m => { (window.__toast = window.__toast || []).push(String(m)); };
const navTo = v => { window.__nav = v; };
const fmtRp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const api = { async req(path, opt) {
  const r = await fetch(path, { method: (opt && opt.method) || 'GET', headers: { 'Content-Type': 'application/json' }, body: opt && opt.body ? JSON.stringify(opt.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
  return d;
} };
''')

SERVER = textwrap.dedent(r'''
process.env.JWT_SECRET = 'uji-ui-rahasia-panjang-sekali-123456789';
const express = require('express');
const path = require('path');
const app = express();
app.use(express.json({ limit: '2mb' }));
const ARTIKEL = [{ id: 1, title: 'BMKG Peringatkan Hujan Ekstrem di Jawa Timur', deck: 'Curah hujan 40 persen di atas normal.', status: 'draft', tags: ['banjir'] }];

/* agen sungguhan (mesin lokal), supaya UI diuji terhadap bentuk respons nyata */
const A = require(process.env.ROOT + '/server/agen-ai');

app.get('/cms.js', (req, res) => res.type('application/javascript').sendFile(path.join(process.env.ROOT, 'server/newsroom/cms.js')));
app.get('/uji-global.js', (req, res) => res.type('application/javascript').send(process.env.GLOBAL_JS));
app.get('/', (req, res) => res.type('html').send(process.env.PAGE_HTML));
app.get('/__toast', (req, res) => res.json({}));

app.get('/api/newsroom/agen/daftar', async (req, res) => {
  if (process.env.MODE_TOLAK === '1') return res.status(403).json({ error: 'Multi-agen AI hanya untuk staf editorial/direksi' });
  res.json({ agen: A.DAFTAR_AGEN, llm: A.statusLLM() });
});
app.get('/api/newsroom/articles', (req, res) => res.json({ articles: ARTIKEL }));
app.post('/api/newsroom/agen/jalankan', async (req, res) => {
  const { artikel_id, agen, teks, judul } = req.body || {};
  const artikel = artikel_id ? ARTIKEL.find(a => a.id === Number(artikel_id)) : { title: judul || 'Draf', deck: '', body: teks, tags: [], sources: [] };
  if (!artikel) return res.status(404).json({ error: 'Artikel tidak ditemukan' });
  const isi = artikel_id ? Object.assign({}, artikel, { body: 'BMKG mengeluarkan peringatan dini cuaca ekstrem.\n\nCurah hujan di Kediri diprediksi 40 persen di atas normal. Menurut Kepala Stasiun Klimatologi, warga diminta bersiap.\n\nDilaporkan 1.200 rumah terdampak tahun lalu.', sources: [] }) : artikel;
  const hasil = await A.jalankanBanyak(agen, isi);
  res.json({ ok: true, asal: artikel_id ? 'artikel' : 'teks', artikel: { id: artikel.id || null, judul: artikel.title }, llm: A.statusLLM(), hasil });
});
app.post('/api/newsroom/agen/cari', (req, res) => {
  const q = String((req.body || {}).q || '').toLowerCase();
  const hasil = A.cariArtikel(ARTIKEL, q, 5);
  res.json({ ok: true, kueri: q, hasil });
});
app.post('/api/newsroom/agen/simpan', (req, res) => res.json({ ok: true, disimpan: ((req.body || {}).temuan || []).length }));
app.listen(process.env.PORT_UI, '127.0.0.1', () => console.log('siap'));
''')


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Playwright tidak tersedia'); return 2

    hpath = os.path.join(ROOT, 'server', 'scripts', '_harness-ui-agen.js')
    open(hpath, 'w').write(SERVER)
    hasil = []

    def cek(nama, kondisi, info=''):
        hasil.append((nama, bool(kondisi)))
        print(('  ✅ ' if kondisi else '  ❌ ') + nama + (('  → ' + str(info)) if info and not kondisi else ''))

    def jalankan_server(mode_tolak='0'):
        env = dict(os.environ, ROOT=ROOT, PORT_UI=str(PORT), PAGE_HTML=PAGE, GLOBAL_JS=GLOBAL, MODE_TOLAK=mode_tolak)
        env.pop('LLM_API_KEY', None); env['LLM_PROVIDER'] = ''
        p = subprocess.Popen(['node', hpath], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for _ in range(60):
            try:
                urllib.request.urlopen(BASE + '/', timeout=1); break
            except urllib.error.HTTPError:
                break
            except Exception:
                time.sleep(0.25)
        return p

    srv = jalankan_server()
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_context(viewport={'width': 1280, 'height': 1000}).new_page()
            galat = []
            pg.on('pageerror', lambda e: galat.append(str(e)))
            pg.goto(BASE + '/', wait_until='networkidle')
            pg.wait_for_selector('.ag-card', timeout=15000)

            print('\n=== 1. Tampilan awal ===')
            cek('6 kartu agen tampil', pg.locator('.ag-card').count() == 6, pg.locator('.ag-card').count())
            cek('semua agen terpilih secara default', pg.locator('.ag-card.on').count() == 6, pg.locator('.ag-card.on').count())
            cek('badge mesin lokal (tanpa API key)', pg.locator('.ag-badge.lokal').count() >= 1, pg.locator('.ag-badge.lokal').count())
            cek('artikel CMS tersedia di pemilih', pg.locator('#agArtikel option').count() >= 1, pg.locator('#agArtikel option').count())
            cek('tanpa galat JS saat memuat', not galat, galat)

            print('\n=== 2. Pilih / batal agen ===')
            pg.locator('.ag-card[data-agen=seo]').click()
            cek('klik kartu → status nonaktif', 'on' not in (pg.locator('.ag-card[data-agen=seo]').get_attribute('class') or ''), pg.locator('.ag-card[data-agen=seo]').get_attribute('class'))
            cek('aria-pressed ikut berubah', pg.locator('.ag-card[data-agen=seo]').get_attribute('aria-pressed') == 'false')
            pg.locator('.ag-card[data-agen=seo]').press('Enter')
            cek('Enter mengaktifkan kembali', 'on' in (pg.locator('.ag-card[data-agen=seo]').get_attribute('class') or ''))
            pg.click('#agSemua')
            cek('tombol "pilih semua" mematikan semua (toggle)', pg.locator('.ag-card.on').count() == 0, pg.locator('.ag-card.on').count())
            pg.click('#agSemua')
            cek('klik lagi menyalakan semua', pg.locator('.ag-card.on').count() == 6, pg.locator('.ag-card.on').count())

            print('\n=== 3. Jalankan 6 agen atas artikel CMS ===')
            pg.click('#agJalan')
            pg.wait_for_selector('#agHasil .ag-out', timeout=20000)
            cek('6 blok hasil tampil', pg.locator('#agHasil .ag-out').count() == 6, pg.locator('#agHasil .ag-out').count())
            cek('progres menunjukkan 6 agen', '6 agen' in pg.inner_text('#agProgres'), pg.inner_text('#agProgres'))
            cek('badge hasil = mesin lokal', 'mesin lokal' in pg.inner_text('#agHasil .cms-bar').lower(), pg.inner_text('#agHasil .cms-bar')[:80])
            teks_hasil = pg.inner_text('#agHasil')
            cek('klarifikasi menyebut klaim angka', 'persen' in teks_hasil.lower(), 'persen tidak ditemukan')
            cek('etika/hukum menampilkan rekomendasi', 'rekomendasi' in teks_hasil.lower())
            cek('data menampilkan sumber pembanding', 'bmkg' in teks_hasil.lower() or 'bps' in teks_hasil.lower())
            import re as _re
            durasi = _re.findall(r'\d+\s*ms', teks_hasil, _re.I)   # CSS text-transform membuat "MS" kapital
            cek('setiap blok menyebut durasi ms', len(durasi) >= 6, 'ditemukan ' + str(len(durasi)) + ' dari 6 · contoh: ' + str(durasi[:6]))
            cek('tetap tanpa galat JS', not galat, galat)

            print('\n=== 4. Simpan temuan ===')
            klik = pg.locator('#agSimpan')
            cek('tombol simpan tersedia', klik.count() == 1)
            klik.click()
            pg.wait_for_timeout(800)
            cek('tombol berubah jadi tersimpan', 'Tersimpan' in pg.inner_text('#agSimpan'), pg.inner_text('#agSimpan'))
            cek('toast simpan muncul', any('temuan disimpan' in t for t in pg.evaluate('window.__toast || []')), pg.evaluate('window.__toast || []')[-1:])

            print('\n=== 5. Jalankan sebagian agen ===')
            for id_ in ['riset', 'klarifikasi', 'penyunting', 'seo', 'data']:
                pg.locator(f'.ag-card[data-agen={id_}]').click()
            pg.click('#agJalan')
            pg.wait_for_timeout(1200)
            cek('hanya 1 agen → 1 blok hasil', pg.locator('#agHasil .ag-out').count() == 1, pg.locator('#agHasil .ag-out').count())
            cek('blok yang tampil = etika', 'Hukum & Etika' in pg.inner_text('#agHasil'), pg.inner_text('#agHasil')[:60])

            print('\n=== 6. Pencarian arsip ===')
            pg.fill('#agCari', 'banjir')
            pg.click('#agCariBtn')
            pg.wait_for_timeout(800)
            cek('hasil cari muncul', '#1' in pg.inner_text('#agHasilCari'), pg.inner_text('#agHasilCari')[:80])
            pg.fill('#agCari', 'zzzz')
            pg.click('#agCariBtn')
            pg.wait_for_timeout(800)
            cek('kata kunci tanpa hasil → pesan jujur', 'Tidak ada artikel' in pg.inner_text('#agHasilCari'), pg.inner_text('#agHasilCari')[:60])

            print('\n=== 7. Draf teks bebas ===')
            if pg.locator('.ag-card.on').count() < 6:
                pg.click('#agSemua')
                pg.wait_for_timeout(200)
            cek('semua agen dipilih kembali sebelum uji draf', pg.locator('.ag-card.on').count() == 6, pg.locator('.ag-card.on').count())
            pg.evaluate("document.querySelector('details').open = true")
            pg.wait_for_timeout(300)
            pg.fill('#agTeks', 'terlalu pendek')
            pg.click('#agJalanTeks')
            pg.wait_for_timeout(400)
            toast_list = pg.evaluate('window.__toast || []')
            cek('teks < 40 karakter ditolak dengan pesan', any('minimal 40' in t for t in toast_list), toast_list[-1:])
            pg.fill('#agTeks', 'Koperasi petani Kediri mengekspor kopi robusta ke Eropa. Menurut ketua koperasi, volume ekspor mencapai 12 ton per bulan sejak 2026. Program ini diklaim paling berhasil di Jawa Timur.')
            pg.fill('#agJudul', 'Draf uji kopi')
            pg.click('#agJalanTeks')
            pg.wait_for_timeout(1500)
            cek('draf teks diperiksa (6 blok)', pg.locator('#agHasil .ag-out').count() == 6, pg.locator('#agHasil .ag-out').count())
            cek('ditandai sebagai draf, bukan artikel CMS', 'Draf teks' in pg.inner_text('#agHasil'), pg.inner_text('#agHasil .cms-bar')[:90])
            pg.click('#agSimpan')
            pg.wait_for_timeout(500)
            tl = pg.evaluate('window.__toast || []')
            cek('draf teks: tombol simpan menolak dengan pesan', any('Draf teks tidak disimpan' in t for t in tl), tl[-1:])
            cek('tetap tanpa galat JS', not galat, galat)
            br.close()
    finally:
        srv.terminate()
        try: srv.communicate(timeout=5)
        except Exception: srv.kill()

    print('\n=== 8. Server menolak peran non-editorial ===')
    srv2 = jalankan_server(mode_tolak='1')
    try:
        with sync_playwright() as pw:
            br = pw.chromium.launch(); pg = br.new_context().new_page()
            pg.goto(BASE + '/', wait_until='networkidle'); pg.wait_for_timeout(1200)
            isi = pg.inner_text('body')
            cek('pesan penolakan ditampilkan (bukan studio)', 'hanya untuk staf editorial' in isi, isi[:120])
            cek('tidak ada kartu agen yang dirender', pg.locator('.ag-card').count() == 0, pg.locator('.ag-card').count())
            br.close()
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
