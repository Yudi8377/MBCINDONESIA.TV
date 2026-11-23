#!/usr/bin/env python3
"""Buat satu klip video unik untuk SETIAP episode program MBCINDONESIA.TV.

Masalah yang diselesaikan: dulu banyak episode berbagi satu dari 11 klip generik,
sehingga "Ruang Bisnis — Ep 24" bisa memutar video berjudul "Jelajah Nusantara".

Sekarang: nama berkas video = slug episode, isinya = foto program + judul episode
+ label program. Sumber data dibaca dari database (sumber kebenaran), dengan
cadangan `website/assets/js/data.js`.

Pakai:
  python3 ops/buat-video-episode.py            # lihat rencana
  python3 ops/buat-video-episode.py --tulis    # render semua klip
"""
import json, os, re, subprocess, sys, unicodedata

F = "/usr/local/lib/python3.13/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "website", "assets", "video")
TMP = "/tmp/vid-ep"
os.makedirs(OUT, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

LABEL = {  # label singkat di klip
    "kabar-nusantara": "KABAR NUSANTARA", "jejak-nusantara": "JEJAK NUSANTARA",
    "selasar-budaya": "SELASAR BUDAYA", "ruang-bisnis": "RUANG BISNIS",
    "bicara-petang": "BICARA PETANG", "dapur-rempah": "DAPUR REMPAH",
    "kamera-komunitas": "KAMERA KOMUNITAS", "panggung-musik": "PANGGUNG MUSIK",
}


def slug(teks: str) -> str:
    t = unicodedata.normalize("NFKD", teks).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return re.sub(r"-+", "-", t)[:70]


def dari_database():
    """Ambil program + episode dari Supabase (lewati bila tidak tersedia)."""
    try:
        import subprocess as sp
        kode = """
        require('dotenv').config({path:'server/.env'});
        const {Pool}=require('pg');
        const p=new Pool({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:8000});
        p.query(`select pr.id, pr.title as program, pr.cat, pr.img, e.ep_index, e.title, e.video_key
                 from programs pr join episodes e on e.program_id = pr.id
                 order by pr.title, e.ep_index`)
         .then(r=>{console.log(JSON.stringify(r.rows));return p.end();})
         .catch(e=>{console.error('ERR',e.message);process.exit(1);});
        """
        out = sp.run(["node", "-e", kode], cwd=ROOT, capture_output=True, text=True, timeout=60)
        if out.returncode != 0:
            return None
        return json.loads(out.stdout)
    except Exception as e:
        print(f"  (database tidak dipakai: {str(e)[:60]})")
        return None


def dari_datajs():
    """Cadangan: baca MBCDATA.programs dari data.js."""
    p = os.path.join(ROOT, "website", "assets", "js", "data.js")
    s = open(p, encoding="utf-8").read()
    hasil = []
    for blok in re.finditer(r"\{ id:\"([^\"]+)\", title:\"([^\"]+)\", cat:\"([^\"]+)\", img:\"([^\"]+)\"", s):
        pid, judul, cat, img = blok.groups()
        sisa = s[blok.end(): s.find("eps:", blok.end())]
        eps = re.findall(r'\["([^"]+)","([^"]+)","([^"]+)"\]', s[s.find("eps:[", blok.end()): s.find("]}", s.find("eps:[", blok.end()))])
        for i, (t, d, k) in enumerate(eps):
            hasil.append({"id": pid, "program": judul, "cat": cat, "img": img,
                          "ep_index": i, "title": t, "video_key": k})
    return hasil


def render(foto, judul, label, tujuan, detik=6):
    t1 = os.path.join(TMP, "j.txt"); t2 = os.path.join(TMP, "l.txt")
    # judul panjang dipotong ke 2 baris agar muat
    kata = judul.split()
    baris, kini = [], ""
    for k in kata:
        if len(kini) + len(k) + 1 <= 34:
            kini = (kini + " " + k).strip()
        else:
            baris.append(kini); kini = k
    if kini: baris.append(kini)
    baris = baris[:2]
    open(t1, "w", encoding="utf-8").write("\n".join(baris))
    open(t2, "w", encoding="utf-8").write(label)
    vf = (
        f"scale=1600:-2,zoompan=z='min(zoom+0.00045,1.10)':d={detik*25}:s=1280x720:fps=25,"
        f"drawbox=y=ih-170:h=170:color=black@0.55:t=fill,"
        f"drawtext=fontfile={FONT}:textfile={t2}:fontcolor=#ff5a4d:fontsize=26:x=64:y=h-150,"
        f"drawtext=fontfile={FONT}:textfile={t1}:fontcolor=white:fontsize=44:line_spacing=10:x=64:y=h-112"
    )
    subprocess.run([F, "-y", "-hide_banner", "-loglevel", "error", "-loop", "1", "-i", foto,
                    "-t", str(detik), "-vf", vf, "-c:v", "libx264", "-profile:v", "high",
                    "-pix_fmt", "yuv420p", "-crf", "31", "-preset", "veryfast", "-g", "50",
                    "-movflags", "+faststart", "-an", tujuan], check=True)


if __name__ == "__main__":
    baris = dari_database() or dari_datajs()
    sumber = "database" if dari_database() else "data.js"
    print(f"  sumber data: {sumber} — {len(baris)} episode")
    rencana = []
    for r in baris:
        kunci = slug(r["title"])
        foto = os.path.join(ROOT, "website", r["img"])
        if not os.path.exists(foto):
            foto = os.path.join(ROOT, "website", "assets", "img", "hero.jpg")
        rencana.append((kunci, foto, r["title"], LABEL.get(r["id"], r["program"].upper()), r["id"], r["ep_index"]))
    if "--tulis" in sys.argv:
        for i, (kunci, foto, judul, label, pid, ep) in enumerate(rencana, 1):
            tujuan = os.path.join(OUT, kunci + ".mp4")
            render(foto, judul.replace("—", "-"), label, tujuan)
            print(f"  [{i:>2}/{len(rencana)}] {kunci}.mp4  ({os.path.getsize(tujuan)//1024} KB)")
        json.dump([{"kunci": k, "program": p, "episode": e, "judul": j} for k, _, j, _, p, e in rencana],
                  open(os.path.join(TMP, "peta.json"), "w"), ensure_ascii=False, indent=1)
        print(f"  total {sum(os.path.getsize(os.path.join(OUT, k + '.mp4')) for k, *_ in rencana)//1024} KB")
    else:
        for k, _, j, l, p, e in rencana:
            print(f"  {k}.mp4  <-  {p} ep{e}: {j}")
