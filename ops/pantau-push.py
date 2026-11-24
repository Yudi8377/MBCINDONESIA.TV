#!/usr/bin/env python3
"""Pemantau persetujuan OAuth: begitu kode disetujui, langsung push ke GitHub.

Dijalankan di latar belakang (start_process). Berhenti sendiri setelah push sukses
atau setelah kode kedaluwarsa (14 menit).
"""
import json, os, subprocess, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location("p", os.path.join(os.path.dirname(os.path.abspath(__file__)), "push-device-flow.py"))
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)

BERKAS = '/tmp/gh_device.json'
DIR_REPO = '/tmp/pushrepo'
LOG = '/tmp/pantau-push.log'


def catat(m):
    with open(LOG, 'a') as f:
        f.write(f"[{time.strftime('%H:%M:%S')}] {m}\n")


def main():
    if not os.path.exists(BERKAS):
        catat('tidak ada kode aktif'); return 2
    d = json.load(open(BERKAS))
    sisa = d['expires_in'] - (int(time.time()) - d['dibuat'])
    catat(f'memantau kode {d["user_code"]} (sisa {sisa} s)')
    while sisa > 0:
        try:
            r = p.minta('https://github.com/login/oauth/access_token',
                        {'client_id': p.CLIENT_ID, 'device_code': d['device_code'],
                         'grant_type': 'urn:ietf:params:oauth:grant-type:device_code'})
        except Exception as e:
            catat('galat jaringan: ' + str(e)[:80]); time.sleep(8); sisa = d['expires_in'] - (int(time.time()) - d['dibuat']); continue
        tok = r.get('access_token')
        if tok:
            catat('✅ disetujui — push dimulai')
            url = f'https://x-access-token:{tok}@github.com/{p.REPO}.git'
            h = subprocess.run(['git', '-C', DIR_REPO, 'push', '-u', url, 'main'], capture_output=True, text=True)
            out = (h.stdout + h.stderr).replace(tok, '***')
            catat('push rc=%d: %s' % (h.returncode, out.strip()[-400:]))
            if h.returncode == 0:
                catat('SELESAI: commit terkirim ke GitHub')
                try: os.remove(BERKAS)
                except OSError: pass
                return 0
            return 5
        if r.get('error') == 'slow_down':
            time.sleep(3)
        elif r.get('error') in ('expired_token', 'access_denied'):
            catat('kode kedaluwarsa/ditolak'); return 3
        else:
            time.sleep(d.get('interval', 5))
        sisa = d['expires_in'] - (int(time.time()) - d['dibuat'])
    catat('kode kedaluwarsa tanpa persetujuan'); return 4


sys.exit(main())
