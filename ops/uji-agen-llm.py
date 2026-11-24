"""Uji jalur LLM opsional (hibrida) pada multi-agen AI.

Tiga skenario:
  A. LLM tiruan MENJAWAB valid   → hasil agen berstatus "hibrida" (data LLM digabung).
  B. LLM tiruan GAGAL (HTTP 500) → otomatis jatuh ke mesin lokal, tanpa error ke pengguna.
  C. LLM LAMBAT (melebihi timeout) → tetap lokal, tercatat "timeout".

Jalankan: python3 ops/uji-agen-llm.py
"""
import json
import os
import subprocess
import sys
import textwrap
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ARTIKEL = {
    'id': 1, 'title': 'BMKG Peringatkan Hujan Ekstrem di Jawa Timur', 'deck': 'Curah hujan 40 persen di atas normal.',
    'channel': 'Lingkungan', 'tags': ['banjir'], 'sources': [],
    'body': 'BMKG mengeluarkan peringatan dini cuaca ekstrem.\n\nCurah hujan di Kediri diprediksi 40 persen di atas normal.'
}

HARNESS = textwrap.dedent('''
const A = require(process.env.ROOT + '/server/agen-ai');
(async () => {
  const hasil = await A.jalankanBanyak(null, JSON.parse(process.env.ARTIKEL_JSON));
  process.stdout.write(JSON.stringify(hasil));
})();
''')


class LLMTiruan(BaseHTTPRequestHandler):
    mode = 'ok'

    def do_POST(self):
        panjang = int(self.headers.get('Content-Length') or 0)
        body = json.loads(self.rfile.read(panjang) or b'{}')
        sistem = (body.get('messages') or [{}])[0].get('content', '')
        if LLMTiruan.mode == 'gagal':
            self.send_response(500); self.end_headers(); self.wfile.write(b'{"error":"uji gagal"}'); return
        if LLMTiruan.mode == 'lambat':
            time.sleep(3)
        # balasan JSON valid yang meniru keluaran model
        isi = {
            'ringkas': 'Ringkasan dari LLM tiruan.',
            'sudut_belum_digarap': ['Sudut dari LLM: uji kesiapan posko 48 jam.'],
            'kata_kunci': ['hujan ekstrem', 'kediri'],
            'pertanyaan_riset': ['Pertanyaan dari LLM?'],
            'klaim': [{'klaim': 'Klaim dari LLM: 40 persen di atas normal', 'jenis': 'angka', 'bukti_diminta': 'Rilis BMKG'}],
            'langkah_klarifikasi': ['Langkah dari LLM: minta rilis resmi.'],
            'status': 'perlu perbaikan',
            'suntingan': ['Suntingan dari LLM.'],
            'judul_usulan': ['Judul Usulan LLM'],
            'meta_description': 'Meta dari LLM.',
            'risiko': [{'judul': 'Risiko dari LLM', 'tingkat': 'peringatan', 'rincian': 'uji'}],
            'rekomendasi': ['Rekomendasi dari LLM'],
            'skor_kepatuhan': 71,
            'angka_penting': ['40 persen'],
            'pembanding_disarankan': ['Bandingkan dengan rilis BPS'],
            'catatan_data': ['Catatan data dari LLM'],
            'catatan_seo': ['Catatan SEO dari LLM']
        }
        balasan = {'choices': [{'message': {'content': json.dumps(isi)}}]}
        data = json.dumps(balasan).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


def jalankan_agen(mode, base_url, timeout_ms='20000'):
    env = dict(os.environ, ROOT=ROOT, ARTIKEL_JSON=json.dumps(ARTIKEL))
    env.update({'LLM_PROVIDER': 'ollama', 'LLM_BASE_URL': base_url, 'LLM_TIMEOUT_MS': timeout_ms})
    env.pop('LLM_API_KEY', None)
    r = subprocess.run(['node', '-e', HARNESS], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-800:])
    return json.loads(r.stdout)


def main():
    port = 8144
    srv = HTTPServer(('127.0.0.1', port), LLMTiruan)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    base = f'http://127.0.0.1:{port}/v1'
    hasil = []

    def cek(nama, kondisi, info=''):
        hasil.append((nama, bool(kondisi)))
        print(('  ✅ ' if kondisi else '  ❌ ') + nama + (('  → ' + str(info)) if info and not kondisi else ''))

    print('\n=== A. LLM menjawab valid → hibrida ===')
    LLMTiruan.mode = 'ok'
    h = jalankan_agen('ok', base)
    peta = {x['agent']: x for x in h}
    cek('semua agen berstatus "hibrida"', all(x['sumber'] == 'hibrida' for x in h), [x['sumber'] for x in h])
    cek('ringkasan dari LLM dipakai', 'LLM' in peta['riset']['ringkas'], peta['riset']['ringkas'])
    cek('sudut dari LLM masuk ke data', any('LLM' in s for s in peta['riset']['data']['sudut_belum_digarap']), peta['riset']['data']['sudut_belum_digarap'])
    cek('klaim lokal TETAP ada saat digabung LLM', any('40 persen' in k['klaim'] for k in peta['klarifikasi']['data']['klaim']), [k['klaim'] for k in peta['klarifikasi']['data']['klaim']])
    cek('status klarifikasi dari LLM dipakai', peta['klarifikasi']['data']['status'] == 'perlu perbaikan', peta['klarifikasi']['data']['status'])
    cek('skor kepatuhan LLM dipakai', peta['etika']['data']['skor_kepatuhan'] == 71, peta['etika']['data']['skor_kepatuhan'])
    cek('temuan lokal etika tidak hilang', any(t.get('oleh') != 'llm' for t in peta['etika']['temuan']) or peta['etika']['temuan'], len(peta['etika']['temuan']))
    cek('semua agen tetap mengembalikan data', all(x.get('data') for x in h))

    print('\n=== B. LLM gagal (HTTP 500) → otomatis lokal ===')
    LLMTiruan.mode = 'gagal'
    h = jalankan_agen('gagal', base)
    peta = {x['agent']: x for x in h}
    cek('semua agen berstatus "lokal"', all(x['sumber'] == 'lokal' for x in h), [x['sumber'] for x in h])
    cek('alasan kegagalan dicatat (http_500)', all(x['catatan_llm'] == 'http_500' for x in h), [x['catatan_llm'] for x in h])
    cek('hasil lokal tetap lengkap', all(x.get('data') and x.get('ringkas') for x in h))

    print('\n=== C. LLM lambat → timeout, tetap lokal ===')
    LLMTiruan.mode = 'lambat'
    h = jalankan_agen('lambat', base, timeout_ms='800')
    cek('semua agen berstatus "lokal"', all(x['sumber'] == 'lokal' for x in h), [x['sumber'] for x in h])
    cek('alasan "timeout" tercatat', all(x['catatan_llm'] == 'timeout' for x in h), [x['catatan_llm'] for x in h])

    srv.shutdown()
    lulus = sum(1 for _, ok in hasil if ok)
    print(f'\nHASIL: {lulus}/{len(hasil)} lulus')
    if lulus != len(hasil):
        print('GAGAL: ' + ', '.join(n for n, ok in hasil if not ok))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
