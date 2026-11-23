#!/usr/bin/env python3
"""Publikasikan MBCINDONESIA.TV ke Vercel TANPA Git.

Strategi transport:
  * berkas teks (.html/.css/.js/.json/.sql/.md/.svg ...) -> dikirim apa adanya (`data`)
  * berkas biner (gambar, video, ikon PNG)             -> base64 (`data`,
    `encoding: "base64"`), supaya tidak ada langkah unggah terpisah

Jalankan:
  python3 ops/publikasikan-vercel.py --daftar     # tampilkan ringkasan paket
  python3 ops/publikasikan-vercel.py --keluaran out.json   # tulis payload untuk connector
"""
import base64, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BINER = ('.jpg', '.jpeg', '.png', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.mp4', '.webm', '.mp3')
ABAIKAN_DIR = {'node_modules', '.git', 'backups', 'docs', '.vercel', 'media'}
ABAIKAN_FILE = {'.env', 'package-lock.json'}
SUMBER = ['website', 'server', 'api', 'vercel.json', 'package.json', '.vercelignore']


def kumpulkan():
    teks, biner, dilewati = [], [], []
    for item in SUMBER:
        jalur = os.path.join(ROOT, item)
        if os.path.isfile(jalur):
            kandidat = [jalur]
        else:
            kandidat = []
            for base, dirs, files in os.walk(jalur):
                dirs[:] = [d for d in dirs if d not in ABAIKAN_DIR]
                kandidat += [os.path.join(base, f) for f in files]
        for p in kandidat:
            rel = os.path.relpath(p, ROOT).replace(os.sep, '/')
            nama = os.path.basename(p)
            if nama in ABAIKAN_FILE or nama.startswith('.env') or rel.startswith('docs/'):
                dilewati.append(rel); continue
            try:
                with open(p, 'rb') as f:
                    isi = f.read()
            except OSError:
                dilewati.append(rel); continue
            if p.lower().endswith(BINER):
                biner.append((rel, base64.b64encode(isi).decode(), len(isi)))
            else:
                try:
                    teks.append((rel, isi.decode('utf-8'), len(isi)))
                except UnicodeDecodeError:
                    dilewati.append(rel)
    return teks, biner, dilewati


def payload(teks, biner):
    """Semua berkas dikirim base64.

    Catatan lapangan: API Vercel menolak `data` yang isinya diawali '{' (dianggap
    objek, bukan string) — jadi JSON/HTML/JS pun di-base64 supaya seragam & aman.
    """
    files = []
    for r, d, _ in teks:
        files.append({"file": r, "data": base64.b64encode(d.encode("utf-8")).decode(), "encoding": "base64"})
    for r, d, _ in biner:
        files.append({"file": r, "data": d, "encoding": "base64"})
    return files


if __name__ == '__main__':
    teks, biner, dilewati = kumpulkan()
    tb = sum(s for _, _, s in teks); bb = sum(s for _, _, s in biner)
    print(f"teks : {len(teks):>4} berkas  {tb/1024:8.1f} KB")
    print(f"biner: {len(biner):>4} berkas  {bb/1024:8.1f} KB  (base64 ≈ {bb*4/3/1024:.1f} KB terkirim)")
    print(f"dilewati: {len(dilewati)} -> {dilewati[:6]}")
    if '--daftar' in sys.argv:
        for r, _, s in sorted(teks, key=lambda x: -x[2])[:8]:
            print(f"   teks  {s:>7}  {r}")
        for r, _, s in sorted(biner, key=lambda x: -x[2])[:5]:
            print(f"   biner {s:>7}  {r}")
    if '--keluaran' in sys.argv:
        out = sys.argv[sys.argv.index('--keluaran') + 1]
        data = payload(teks, biner)
        with open(out, 'w') as f:
            json.dump({"jumlah": len(data), "files": data}, f)
        print(f"payload ditulis ke {out} ({os.path.getsize(out)/1024/1024:.1f} MB)")
