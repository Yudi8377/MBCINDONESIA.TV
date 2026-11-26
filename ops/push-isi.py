#!/usr/bin/env python3
"""Terbitkan / perbarui berkas langsung ke GitHub lewat Contents API — TANPA device flow.

Kenapa ada: kode device flow berumur 14 menit dan sering kedaluwarsa sebelum disetujui.
Token Personal Access Token (PAT) tidak punya batas waktu seperti itu.

Cara pakai:
    export GH_TOKEN=ghp_xxx          # PAT klasik dengan scope `repo`, ATAU fine-grained
                                     # dengan izin "Contents: Read and write" pada repo ini
    python3 ops/push-isi.py          # tampilkan apa yang AKAN diubah (dry-run)
    python3 ops/push-isi.py --kirim  # benar-benar kirim commit ke main

Yang dilakukan: setiap berkas mengubah isinya → satu commit per berkas ke branch main
lewat Contents API. Vercel membangun produksi dari commit terakhir.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request

REPO = os.environ.get('GH_REPO', 'Yudi8377/MBCINDONESIA.TV')
BRANCH = os.environ.get('GH_BRANCH', 'main')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN = os.environ.get('GH_TOKEN', '').strip()

# berkas yang perlu diterbitkan (jalur repo → jalur lokal)
# 1.6.4 — 24 berkas inti (7 berkas kode Editorial/tab + api + skema + dokumen bantu)
BERKAS = [
    # --- inti aplikasi ---
    ('api/index.js', 'api/index.js'),
    ('vercel.json', 'vercel.json'),
    ('package.json', 'package.json'),
    ('server/server.js', 'server/server.js'),
    ('server/db.js', 'server/db.js'),
    ('server/akun.js', 'server/akun.js'),
    ('server/peran.js', 'server/peran.js'),
    ('server/newsroom-api.js', 'server/newsroom-api.js'),
    ('server/newsroom-modul.js', 'server/newsroom-modul.js'),
    ('server/newsroom-pengguna.js', 'server/newsroom-pengguna.js'),
    ('server/newsroom-agen.js', 'server/newsroom-agen.js'),
    ('server/agents.js', 'server/agents.js'),
    ('server/agen-ai.js', 'server/agen-ai.js'),
    ('server/seed.js', 'server/seed.js'),
    ('server/cms-seed.js', 'server/cms-seed.js'),
    ('server/content-library.json', 'server/content-library.json'),
    # --- skema & CMS (menu Editorial ikut di sini) ---
    ('server/skema-modul.js', 'server/skema-modul.js'),
    ('server/skema-1.6.3.js', 'server/skema-1.6.3.js'),
    ('server/newsroom/index.html', 'server/newsroom/index.html'),
    ('server/newsroom/cms.js', 'server/newsroom/cms.js'),
    ('server/newsroom/cms-modul.js', 'server/newsroom/cms-modul.js'),
    # --- situs publik (halaman diagnosa + login) ---
    ('website/assets/js/akun.js', 'website/assets/js/akun.js'),
    ('website/diagnosa-masuk.html', 'website/diagnosa-masuk.html'),
    # --- SQL & perkakas pemeriksa ---
    ('docs/MIGRASI-1.6.2.sql', 'docs/MIGRASI-1.6.2.sql'),
    ('docs/MIGRASI-1.6.3.sql', 'docs/MIGRASI-1.6.3.sql'),
    ('docs/PATCH-1.6.4-nomor-unik.sql', 'docs/PATCH-1.6.4-nomor-unik.sql'),
    ('ops/cek-repo.js', 'ops/cek-repo.js'),
    ('ops/push-isi.py', 'ops/push-isi.py'),
    ('ops/sinkron-artikel.js', 'ops/sinkron-artikel.js'),
    ('ops/ganti-sandi.js', 'ops/ganti-sandi.js'),
]


def permintaan(url, metode='GET', isi=None):
    data = json.dumps(isi).encode() if isi is not None else None
    r = urllib.request.Request(url, data=data, method=metode, headers={
        'Authorization': 'Bearer ' + TOKEN,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'mbcindonesia-terbit/1.0',
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(r, timeout=40) as f:
        return json.loads(f.read().decode())


def ambil(jalur):
    """(sha, isi) berkas di branch, atau (None, None) bila belum ada."""
    try:
        d = permintaan(f'https://api.github.com/repos/{REPO}/contents/{jalur}?ref={BRANCH}')
        return d['sha'], base64.b64decode(d['content']).decode('utf-8')
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None, None
        raise


def main():
    kirim = '--kirim' in sys.argv
    if not TOKEN:
        print('❌ GH_TOKEN belum di-set.')
        print('   Buat PAT: https://github.com/settings/tokens/new  (scope: repo, kedaluwarsa bebas)')
        print('   lalu:  export GH_TOKEN=ghp_xxx ; python3 ops/push-isi.py')
        return 2
    try:
        siapa = permintaan('https://api.github.com/user')
        print(f'✅ Token sah sebagai @{siapa.get("login")}')
    except urllib.error.HTTPError as e:
        print(f'❌ Token ditolak GitHub ({e.code}). Periksa scope `repo`.')
        return 3

    berubah, sama, hilang = [], [], []
    for jalur, lokal in BERKAS:
        p = os.path.join(ROOT, lokal)
        if not os.path.exists(p):
            hilang.append(jalur)
            print(f'  ⚠️  {jalur} — tidak ada di workspace')
            continue
        isi_baru = open(p, encoding='utf-8').read()
        sha, isi_lama = ambil(jalur)
        if isi_lama == isi_baru:
            sama.append(jalur)
            print(f'  =  {jalur} — sudah sama di GitHub')
        else:
            berubah.append((jalur, isi_baru, sha))
            print(f'  ↑  {jalur} — {"berubah" if sha else "baru"} ({len(isi_baru)} byte)')

    print(f'\nRingkasan: {len(berubah)} berubah · {len(sama)} sama · {len(hilang)} hilang')
    if not kirim:
        print('Mode periksa (dry-run). Tambahkan --kirim untuk benar-benar menerbitkan.')
        return 0
    if not berubah:
        print('Tidak ada yang perlu dikirim.')
        return 0

    for jalur, isi, sha in berubah:
        muatan = {
            'message': f'chore(terbit): perbarui {jalur}',
            'content': base64.b64encode(isi.encode('utf-8')).decode(),
            'branch': BRANCH,
        }
        if sha:
            muatan['sha'] = sha
        try:
            d = permintaan(f'https://api.github.com/repos/{REPO}/contents/{jalur}', 'PUT', muatan)
            print(f'  ✅ {jalur} → commit {d["commit"]["sha"][:7]}')
        except urllib.error.HTTPError as e:
            pesan = e.read().decode()[:200]
            print(f'  ❌ {jalur} gagal ({e.code}): {pesan}')
            return 4
    print('\n✅ Selesai. Vercel akan membangun produksi dari commit terakhir pada main.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
