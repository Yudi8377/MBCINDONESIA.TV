#!/usr/bin/env python3
"""Push repo ke GitHub lewat OAuth Device Flow — TANPA membuat Personal Access Token.

Cara pakai:
    python3 ops/push-device-flow.py --kode        # tampilkan kode 8 karakter
    # (setujui di https://github.com/login/device)
    python3 ops/push-device-flow.py --lanjutkan   # tukar kode -> token, lalu push
    python3 ops/push-device-flow.py --push-saja   # ulangi push dengan token tersimpan

Token hanya disimpan di memori proses (dan file sementara 0600 yang dihapus setelah push).
"""
import json, os, subprocess, sys, time, urllib.parse, urllib.request

CLIENT_ID = os.environ.get('GH_CLIENT_ID', '178c6fc778ccc68e1d6a')  # GitHub CLI (publik, PKCE)
SCOPE = 'repo'
REPO = 'Yudi8377/MBCINDONESIA.TV'
DIR_REPO = '/tmp/pushrepo'
BERKAS = '/tmp/gh_device.json'
BERKAS_TOKEN = '/tmp/gh_token.json'   # 0600, token OAuth terakhir (agar push bisa diulang tanpa kode baru)


def minta(url, data=None, header=None):
    h = {'Accept': 'application/json', 'Content-Type': 'application/json',
         'User-Agent': 'mbcindonesia-deploy/1.0'}
    h.update(header or {})
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=h, method='POST' if body else 'GET')
    with urllib.request.urlopen(r, timeout=40) as f:
        return json.loads(f.read().decode())


def kode():
    d = minta('https://github.com/login/device/code', {'client_id': CLIENT_ID, 'scope': SCOPE})
    d['dibuat'] = int(time.time())
    with open(BERKAS, 'w') as f:
        json.dump(d, f)
    os.chmod(BERKAS, 0o600)
    print('\n' + '=' * 58)
    print('  BUKA : https://github.com/login/device')
    print('  KODE : ' + d['user_code'])
    print('=' * 58)
    print(f'  Berlaku {d["expires_in"]//60} menit. Setelah disetujui, jalankan:')
    print('    python3 ops/push-device-flow.py --lanjutkan')
    print()


def cek_repo():
    if not os.path.isdir(os.path.join(DIR_REPO, '.git')):
        print('❌ Repo tujuan %s tidak ada / belum siap.' % DIR_REPO)
        print('   Siapkan dulu (salinan kerja + commit), lalu ulangi. Token tidak akan hilang:')
        print('   gunakan  python3 ops/push-device-flow.py --push-saja')
        return False
    return True


def lanjutkan():
    if not cek_repo():
        return 6
    if not os.path.exists(BERKAS):
        print('Belum ada kode aktif. Jalankan dulu: --kode')
        return 2
    d = json.load(open(BERKAS))
    token = None
    for i in range(60):
        try:
            r = minta('https://github.com/login/oauth/access_token',
                      {'client_id': CLIENT_ID, 'device_code': d['device_code'],
                       'grant_type': 'urn:ietf:params:oauth:grant-type:device_code'})
        except Exception as e:
            print(f'  [coba {i+1}] galat jaringan: {str(e)[:80]}')
            time.sleep(5); continue
        if r.get('access_token'):
            token = r['access_token']; break
        err = r.get('error')
        if err == 'authorization_pending':
            print(f'  [coba {i+1}] menunggu persetujuan…', flush=True)
        elif err == 'slow_down':
            time.sleep(2)
        elif err in ('expired_token', 'access_denied'):
            print('Kode kedaluwarsa/ditolak. Jalankan ulang: --kode')
            return 3
        else:
            print('respons:', r)
        time.sleep(d.get('interval', 5))
    if not token:
        print('Belum disetujui. Setujui di https://github.com/login/device lalu ulangi --lanjutkan')
        return 4

    try:
        with open(BERKAS_TOKEN, 'w') as f:
            json.dump({'token': token, 'dibuat': int(time.time())}, f)
        os.chmod(BERKAS_TOKEN, 0o600)
    except Exception as e:
        print('  (peringatan) token tidak bisa disimpan: %s' % e)
    print('✅ Token diterima (tidak ditampilkan). Mulai push…')
    url = f'https://x-access-token:{token}@github.com/{REPO}.git'
    hasil = subprocess.run(['git', '-C', DIR_REPO, 'push', '-u', url, 'main'], capture_output=True, text=True)
    keluaran = (hasil.stdout + hasil.stderr).replace(token, '***')
    print(keluaran.strip()[-800:])
    if hasil.returncode == 0:
        print('\n✅ Kode terkirim ke GitHub. Vercel akan otomatis membangun dari branch main.')
        os.remove(BERKAS)
        return 0
    print('\n❌ push gagal (kode %d).' % hasil.returncode)
    return 5


def push_saja():
    if not cek_repo():
        return 6
    if not os.path.exists(BERKAS_TOKEN):
        print('Belum ada token tersimpan. Jalankan --kode lalu --lanjutkan.')
        return 2
    token = json.load(open(BERKAS_TOKEN)).get('token')
    if not token:
        print('Berkas token rusak. Jalankan --kode lagi.'); return 2
    print('→ Push memakai token tersimpan…')
    url = f'https://x-access-token:{token}@github.com/{REPO}.git'
    hasil = subprocess.run(['git', '-C', DIR_REPO, 'push', '-u', url, 'main'], capture_output=True, text=True)
    print((hasil.stdout + hasil.stderr).replace(token, '***').strip()[-800:])
    if hasil.returncode == 0:
        print('\n✅ Push berhasil. Vercel membangun dari branch main.')
        for f in (BERKAS, BERKAS_TOKEN):
            if os.path.exists(f):
                os.remove(f)
        return 0
    print('\n❌ push gagal (kode %d).' % hasil.returncode)
    return 5


if __name__ == '__main__':
    if '--push-saja' in sys.argv:
        sys.exit(push_saja())
    if '--kode' in sys.argv:
        kode(); sys.exit(0)
    if '--lanjutkan' in sys.argv:
        sys.exit(lanjutkan())
    print(__doc__)
