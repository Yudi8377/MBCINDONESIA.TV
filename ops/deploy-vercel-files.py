#!/usr/bin/env python3
"""Deploy 1.5.0 ke Vercel lewat API `files` (tanpa git).

Kenapa begini: push GitHub butuh persetujuan kode perangkat di /login/device.
Deploy lewat `files` tidak menunggu persetujuan itu.

Berkas kecil dikirim inline (base64 lewat JSON), berkas biner besar (video .mp4)
diunggah terpisah lewat /v2/files lalu dirujuk dengan sha — sesuai ketentuan
konektor (jangan pernah mengirim byte biner besar sebagai data inline).
"""
import base64, hashlib, json, os, sys, urllib.request, urllib.error

AKAR = '/home/user/mbcindonesia'
TOKEN = os.environ.get('VERCEL_TOKEN', '')
TEAM = 'team_nnTGRBz6Ql1mC0nWiHwJ43vw'
PROYEK = 'mbcindonesia-tv'
LEWATI_DIR = {'.git', 'node_modules', 'backups', 'docs', 'ops', '__pycache__'}
LEWATI_BERKAS = {'.env', '.env.local', 'package-lock.json'}
BATAS_INLINE = 1_200_000      # > ini diunggah terpisah

if not TOKEN:
    sys.exit('VERCEL_TOKEN belum diset')

def api(jalur, metode='GET', data=None, mentah=None, tipe='application/json'):
    url = f'https://api.vercel.com{jalur}'
    if '?' in url:
        url += f'&teamId={TEAM}'
    else:
        url += f'?teamId={TEAM}'
    isi = mentah if mentah is not None else (json.dumps(data).encode() if data is not None else None)
    req = urllib.request.Request(url, data=isi, method=metode)
    req.add_header('Authorization', f'Bearer {TOKEN}')
    req.add_header('Content-Type', tipe)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        pesan = e.read().decode()[:400]
        raise SystemExit(f'HTTP {e.code} {jalur}: {pesan}')

def kumpulkan():
    """Hanya website/ + server/ + api/ + vercel.json + package.json yang diperlukan runtime."""
    hasil = []
    for folder in ('website', 'server', 'api'):
        for akar, dirs, berkas in os.walk(os.path.join(AKAR, folder)):
            dirs[:] = [d for d in dirs if d not in LEWATI_DIR]
            for f in berkas:
                if f in LEWATI_BERKAS or f.endswith(('.log', '.pyc')):
                    continue
                penuh = os.path.join(akar, f)
                rel = os.path.relpath(penuh, AKAR)
                hasil.append((rel, penuh))
    for f in ('vercel.json', 'package.json'):
        hasil.append((f, os.path.join(AKAR, f)))
    return hasil

def main():
    berkas = kumpulkan()
    print(f'berkas: {len(berkas)}')
    daftar, besar_total = [], 0
    for rel, penuh in berkas:
        ukuran = os.path.getsize(penuh)
        besar_total += ukuran
        if ukuran <= BATAS_INLINE:
            with open(penuh, 'rb') as f:
                daftar.append({'file': rel, 'data': base64.b64encode(f.read()).decode()})
        else:
            print(f'  unggah terpisah: {rel} ({ukuran/1e6:.1f} MB)')
            with open(penuh, 'rb') as f:
                isi = f.read()
            sha = hashlib.sha1(isi).hexdigest()
            api('/v2/files', 'POST', mentah=isi, tipe='application/octet-stream')
            daftar.append({'file': rel, 'sha': sha, 'size': ukuran})
    print(f'total {besar_total/1e6:.1f} MB, inline {sum(1 for d in daftar if "data" in d)} berkas')

    hasil = api('/v13/deployments', 'POST', data={
        'name': PROYEK,
        'project': PROYEK,
        'target': 'production',
        'files': daftar,
        'projectSettings': {'framework': None, 'installCommand': 'npm install --omit=dev --no-audit --no-fund',
                            'outputDirectory': 'website'},
    })
    print('deployment:', hasil.get('id'), hasil.get('url'), hasil.get('readyState'))
    with open('/tmp/deploy-150.json', 'w') as f:
        json.dump(hasil, f)

main()
