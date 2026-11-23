#!/usr/bin/env python3
"""Buat klip video demo MBC Indonesia secara lokal (tanpa aset eksternal).
Menghasilkan MP4 H.264 + yuv420p + faststart agar bisa diputar di Chrome,
Safari iOS, dan WebView Android tanpa bergantung pada CDN luar.
"""
import subprocess, os, sys

F = "/usr/local/lib/python3.13/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
IMG = "/home/user/mbcindonesia/website/assets/img"
OUT = "/home/user/mbcindonesia/website/assets/video"
os.makedirs(OUT, exist_ok=True)
TMP = "/tmp/vid"
os.makedirs(TMP, exist_ok=True)

KLIP = [
    ("bunny",      "jejak-nusantara.jpg",    "Jejak Nusantara",          "Menyusuri desa & kota Indonesia"),
    ("elephants",  "hero.jpg",               "Dokumenter Nusantara",     "Alam, satwa, dan manusia"),
    ("sintel",     "selasar-budaya.jpg",     "Selasar Budaya",           "Cerita di balik tradisi"),
    ("tos",        "ruang-bisnis.jpg",       "Ruang Bisnis",             "UMKM naik kelas"),
    ("blazes",     "kabar-nusantara.jpg",    "Kabar Nusantara Pagi",     "Berita pagi dari Kediri"),
    ("escapes",    "kabar-nusantara.jpg",    "Kabar Nusantara Siang",    "Update siang hari ini"),
    ("joyrides",   "bicara-petang.jpg",      "Bicara Petang",            "Diskusi hangat bersama narasumber"),
    ("meltdowns",  "kamera-komunitas.jpg",   "Kamera Komunitas",         "Karya warga, untuk warga"),
    ("fun",        "panggung-musik.jpg",     "Panggung Musik",           "Musik daerah dan panggung terbuka"),
    ("flicks",     "dapur-rempah.jpg",       "Dapur Rempah",             "Kuliner khas Jawa Timur"),
    ("subaru",     "jejak-nusantara.jpg",    "Jelajah Nusantara",        "Perjalanan lintas kota"),
]

def enc(src, dst, detik, judul, sub, tambahan_filter=""):
    t1 = os.path.join(TMP, "a.txt"); t2 = os.path.join(TMP, "b.txt")
    open(t1, "w").write(judul); open(t2, "w").write(sub)
    vf = (
        f"scale=1600:-2,zoompan=z='min(zoom+0.00045,1.12)':d={detik*25}:s=1280x720:fps=25,"
        f"drawbox=y=ih-140:h=140:color=black@0.5:t=fill,"
        f"drawtext=fontfile={FONT}:textfile={t1}:fontcolor=white:fontsize=46:x=64:y=h-104,"
        f"drawtext=fontfile={FONT}:textfile={t2}:fontcolor=white@0.8:fontsize=24:x=64:y=h-48"
        + tambahan_filter
    )
    cmd = [F, "-y", "-hide_banner", "-loglevel", "error", "-loop", "1", "-i", src,
           "-t", str(detik), "-vf", vf,
           "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
           "-crf", "31", "-preset", "veryfast", "-g", "50",
           "-movflags", "+faststart", "-an", dst]
    subprocess.run(cmd, check=True)
    return os.path.getsize(dst)

total = 0
for key, img, judul, sub in KLIP:
    dst = os.path.join(OUT, f"{key}.mp4")
    n = enc(os.path.join(IMG, img), dst, 6, judul, sub)
    total += n
    print(f"  {key:<11} {n/1024:6.1f} KB")

# --- Siaran loop: 20 detik maju + 20 detik mundur = 40 detik mulus (seamless) ---
seg1 = os.path.join(TMP, "loop_fwd.mp4")
seg2 = os.path.join(TMP, "loop_rev.mp4")
enc(os.path.join(IMG, "kabar-nusantara.jpg"), seg1, 20, "SIARAN LANGSUNG  -  KABAR NUSANTARA PETANG",
    "MBC INDONESIA  -  Kediri  -  1080i",
    ",drawbox=x=64:y=64:w=220:h=54:color=red@0.85:t=fill,"
    "drawtext=fontfile=" + FONT + ":text=LIVE:fontcolor=white:fontsize=34:x=100:y=76,"
    "drawtext=fontfile=" + FONT + ":text='%{pts\\:hms}':fontcolor=white@0.9:fontsize=30:x=w-tw-64:y=76:box=1:boxcolor=black@0.45:boxborderw=12")
subprocess.run([F, "-y", "-hide_banner", "-loglevel", "error", "-i", seg1, "-vf", "reverse",
                "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "31",
                "-preset", "veryfast", "-g", "50", "-an", seg2], check=True)
lst = os.path.join(TMP, "list.txt")
open(lst, "w").write(f"file '{seg1}'\nfile '{seg2}'\n")
live = os.path.join(OUT, "live-24jam.mp4")
subprocess.run([F, "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
                "-i", lst, "-c", "copy", "-movflags", "+faststart", live], check=True)
nl = os.path.getsize(live); total += nl
print(f"  {'live-24jam':<11} {nl/1024:6.1f} KB  (40 detik, mulus berulang)")
print(f"TOTAL {total/1024/1024:.2f} MB di {OUT}")
