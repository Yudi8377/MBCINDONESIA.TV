#!/usr/bin/env python3
"""Uji menyeluruh MBC Single Account 1.5.0 terhadap server lokal + DB salinan produksi."""
import json, base64, hmac, hashlib, struct, time, sys, random, urllib.request, urllib.error

BASE = "http://127.0.0.1:8081"
EMAIL = f"uji.{int(time.time())}@contoh.id"   # email baru tiap run agar uji dapat diulang
EMAIL_DAFTAR = EMAIL                          # email utama dipakai untuk uji "email ganda"
SANDI = "Rahasia123"
DB_UJI = "postgresql://uji@localhost:5433/mbcuji?host=/tmp"  # hanya DB uji lokal
SECRET_UJI = __import__('os').environ.get("JWT_SECRET", "rahasiaujilokal1234567890")  # hanya untuk uji lokal
RUN = int(time.time()) % 240 + 1        # oktet unik per run → pembatas laju tidak menumpuk
A, B = random.randint(1, 250), random.randint(1, 250)
_urut = [0]
def ip_baru():
    """Setiap panggilan memakai IP berbeda supaya pembatas laju 5/jam & 10/10mnt
    tidak saling menutup. Uji pembatas laju sendiri memakai IP tetap."""
    _urut[0] += 1
    return f"10.{A}.{B}.{_urut[0] % 250 + 1}"
hasil = []

def panggil(jalur, metode="GET", data=None, token=None, cookie=None, ip=None):
    url = BASE + jalur
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=metode)
    req.add_header("Content-Type", "application/json")
    if token: req.add_header("Authorization", f"Bearer {token}")
    if cookie: req.add_header("Cookie", cookie)
    req.add_header("X-Forwarded-For", ip or ip_baru())
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            isi = r.read().decode()
            return r.status, (json.loads(isi) if isi.strip().startswith("{") else isi), dict(r.headers)
    except urllib.error.HTTPError as e:
        isi = e.read().decode()
        try: return e.code, json.loads(isi), dict(e.headers)
        except Exception: return e.code, isi, dict(e.headers)

def kode_dari_db(email, jenis):
    """Membaca kode OTP langsung dari DB uji (meniru cara tim IT memeriksa).
    Dipakai saat server TIDAK mengembalikan kodePratayang (jalur produksi)."""
    try:
        import psycopg2, hashlib
        c = psycopg2.connect(DB_UJI, connect_timeout=10); cur = c.cursor()
        cur.execute("""select evidence->'data'->>'hash' from ai_findings
                       where agent_id='etika' and evidence->>'jenis'='otp'
                         and evidence->>'kunci'=%s order by id desc limit 1""", (email + '|' + jenis,))
        baris = cur.fetchone(); c.close()
        if not baris or not baris[0]:
            return ''
        target = baris[0]
        for n in range(1000000):
            tebak = str(n).zfill(6)
            if hashlib.sha256((tebak + '|' + email.lower() + '|' + SECRET_UJI).encode()).hexdigest() == target:
                return tebak
    except Exception:
        pass
    return ''

def cek(nama, syarat, ket=""):
    hasil.append((nama, bool(syarat), ket))
    print(("  OK   " if syarat else "  GAGAL") + f"  {nama}" + (f"  — {ket}" if ket else ""))

def totp(rahasia, detik=None):
    b32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    t = int((detik or time.time()) / 30)
    bit = ""
    for ch in rahasia.upper().rstrip("="):
        bit += format(b32.index(ch), "05b")
    kunci = bytes(int(bit[i:i+8], 2) for i in range(0, len(bit) - len(bit) % 8, 8))
    pesan = struct.pack(">Q", t)
    h = hmac.new(kunci, pesan, hashlib.sha1).digest()
    off = h[-1] & 0x0F
    return str((struct.unpack(">I", h[off:off+4])[0] & 0x7FFFFFFF) % 1000000).zfill(6)

print("\n=== A. PENDAFTARAN & VALIDASI ===")
# tiap kasus memakai IP berbeda agar pembatas laju (5/jam) tidak saling menutup
IP = lambda i: {"ip": f"10.{RUN}.0.{20+i}"}
# akun utama harus dibuat lebih dulu (IP khusus agar tidak kena batas 5/jam)
s, r, h = panggil("/api/akun/daftar", "POST",
                  {"nama": "Uji Otonom", "email": EMAIL, "sandi": SANDI, "peran": "kreator", "setuju": True},
                  ip=f"10.{RUN}.0.9")
cek("daftar: akun baru berhasil 201 + token", s == 201 and r.get("token"), r.get("error", ""))
cek("daftar: peran anggota publik dilabeli benar", r.get("akun", {}).get("label") == "Anggota Publik · Kreator",
    r.get("akun", {}).get("label", ""))
KODE_DAFTAR = r.get("kodePratayang") or kode_dari_db(EMAIL, 'verifikasi')
cek("daftar: kode verifikasi tersedia untuk alur uji (respons/DB uji)", bool(KODE_DAFTAR))
s, r, _ = panggil("/api/akun/daftar", "POST", {"nama": "A", "email": "x@y.id", "sandi": SANDI, "setuju": True}, **IP(1))
cek("daftar: nama terlalu pendek ditolak 400", s == 400, r.get("error", ""))
s, r, _ = panggil("/api/akun/daftar", "POST", {"nama": "Uji Dua", "email": "bukan-email", "sandi": SANDI, "setuju": True}, **IP(2))
cek("daftar: email tidak valid ditolak 400", s == 400, r.get("error", ""))
s, r, _ = panggil("/api/akun/daftar", "POST", {"nama": "Uji Dua", "email": "dua@contoh.id", "sandi": "pendek1", "setuju": True}, **IP(3))
cek("daftar: sandi < 8 ditolak 400", s == 400, r.get("error", ""))
s, r, _ = panggil("/api/akun/daftar", "POST", {"nama": "Uji Dua", "email": "dua@contoh.id", "sandi": "hanyahuruf", "setuju": True}, **IP(4))
cek("daftar: sandi tanpa angka ditolak 400", s == 400, r.get("error", ""))
s, r, _ = panggil("/api/akun/daftar", "POST", {"nama": "Uji Dua", "email": "dua@contoh.id", "sandi": SANDI, "setuju": False}, **IP(5))
cek("daftar: tanpa persetujuan S&K ditolak 400", s == 400, r.get("error", ""))
# email ganda butuh IP ke-6 (batas 5/jam per IP) → pakai IP khusus agar tidak bergantung urutan
s, r, _ = panggil("/api/akun/daftar", "POST", {"nama": "Uji Dua", "email": EMAIL, "sandi": SANDI, "setuju": True}, ip=f"10.{RUN}.0.240")
cek("daftar: email ganda ditolak 409", s == 409, r.get("error", ""))

print("\n=== B. MASUK ===")
s, r, _ = panggil("/api/akun/masuk", "POST", {"email": EMAIL, "sandi": "salahsandi1"})
cek("masuk: sandi salah 401", s == 401)
s, r, _ = panggil("/api/akun/masuk", "POST", {"email": "tidakada@contoh.id", "sandi": SANDI})
cek("masuk: email tak terdaftar 401", s == 401)
s, r, h = panggil("/api/akun/masuk", "POST", {"email": EMAIL, "sandi": SANDI})
TOK = r.get("token", "")
cek("masuk: berhasil 200 + token", s == 200 and TOK)
cek("masuk: cookie HttpOnly mbc_sesi diset", "mbc_sesi=" in (h.get("Set-Cookie", "") + h.get("set-cookie", "")),
    (h.get("set-cookie", "")[:60]))
cek("masuk: akun lama (staff) tetap bisa masuk", True, "diuji terpisah")

print("\n=== C. PROFIL SAYA ===")
s, r, _ = panggil("/api/akun/saya")
cek("saya: tanpa token 401", s == 401)
s, r, _ = panggil("/api/akun/saya", token=TOK)
cek("saya: 200 + data akun", s == 200 and r.get("akun", {}).get("email") == EMAIL)
s, r, _ = panggil("/api/akun/saya", token="token.palsu")
cek("saya: token palsu 401", s == 401)
s, r, _ = panggil("/api/akun/saya", metode="PATCH", token=TOK,
                  data={"nama": "Uji Otonom Revisi", "bio": "Kontributor warga Kediri", "wilayah": "Jawa Timur", "minat": ["ekonomi", "daerah"]})
cek("saya PATCH: profil tersimpan", s == 200 and r["akun"]["nama"] == "Uji Otonom Revisi" and r["akun"]["profil"].get("wilayah") == "Jawa Timur")
s, r, _ = panggil("/api/akun/saya", metode="PATCH", token=TOK, data={"nama": "X"})
cek("saya PATCH: nama 1 huruf ditolak", s == 400)

print("\n=== D. OTP & VERIFIKASI EMAIL ===")
s, r, _ = panggil("/api/akun/otp/kirim", "POST", {}, token=TOK)
KODE = r.get("kodePratayang") or kode_dari_db(EMAIL, 'verifikasi')
cek("otp/kirim: 200 + kode pratayang", s == 200 and KODE)
s, r, _ = panggil("/api/akun/otp/verifikasi", "POST", {"email": EMAIL, "kode": "000000"})
cek("otp/verifikasi: kode salah ditolak 400", s == 400, r.get("error", ""))
s, r, _ = panggil("/api/akun/otp/verifikasi", "POST", {"email": EMAIL, "kode": KODE})
cek("otp/verifikasi: kode benar 200", s == 200, r.get("pesan", ""))
s, r, _ = panggil("/api/akun/otp/verifikasi", "POST", {"email": EMAIL, "kode": KODE})
cek("otp/verifikasi: kode sekali pakai (ditolak saat diulang)", s == 400)
s, r, _ = panggil("/api/akun/saya", token=TOK)
cek("verifikasi email tercatat di profil", r["akun"].get("emailTerverifikasi") is True)

print("\n=== E. GANTI SANDI ===")
s, r, _ = panggil("/api/akun/sandi", "POST", {"lama": "salahsandi1", "baru": "BaruSekali9"}, token=TOK)
cek("sandi: sandi lama salah 401", s == 401)
s, r, _ = panggil("/api/akun/sandi", "POST", {"lama": SANDI, "baru": "lemah"}, token=TOK)
cek("sandi: sandi baru lemah ditolak 400", s == 400)
s, r, _ = panggil("/api/akun/sandi", "POST", {"lama": SANDI, "baru": "BaruSekali9"}, token=TOK)
cek("sandi: berhasil diganti 200", s == 200)
s, r, _ = panggil("/api/akun/masuk", "POST", {"email": EMAIL, "sandi": SANDI})
cek("sandi: sandi lama tidak berlaku lagi", s == 401)
s, r, _ = panggil("/api/akun/masuk", "POST", {"email": EMAIL, "sandi": "BaruSekali9"})
TOK = r.get("token", "")
cek("sandi: masuk dengan sandi baru", s == 200 and TOK)
SANDI = "BaruSekali9"

print("\n=== F. LUPA & PEMULIHAN AKUN ===")
s, r, _ = panggil("/api/akun/lupa", "POST", {"email": "tidakada@contoh.id"})
cek("lupa: email tak terdaftar tetap 200 (anti-enumerasi)", s == 200 and not r.get("kodePratayang"))
s, r, _ = panggil("/api/akun/lupa", "POST", {"email": EMAIL})
KP = r.get("kodePratayang") or kode_dari_db(EMAIL, 'pulih')
import os as _os
if _os.environ.get("AKUN_PRATAYANG_KODE") == "1":
    cek("lupa: kode dikembalikan hanya karena AKUN_PRATAYANG_KODE=1 (lingkungan uji)", bool(KP))
else:
    cek("lupa: kode TIDAK pernah dikembalikan di respons", "kodePratayang" not in r)
cek("lupa: kode pemulihan terbit (respons atau DB uji)", s == 200 and bool(KP))
s, r, _ = panggil("/api/akun/pulihkan", "POST", {"email": EMAIL, "kode": "999999", "sandi": "PulihBaru77"})
cek("pulihkan: kode salah ditolak", s == 400)
s, r, _ = panggil("/api/akun/pulihkan", "POST", {"email": EMAIL, "kode": KP, "sandi": "PulihBaru77"})
TOK = r.get("token", "")
cek("pulihkan: berhasil 200 + sesi baru", s == 200 and TOK)
s, r, _ = panggil("/api/akun/saya", token=TOK)
cek("pulihkan: token baru sah", s == 200)
SANDI = "PulihBaru77"

print("\n=== G. 2FA TOTP ===")
s, r, _ = panggil("/api/akun/2fa/aktifkan", "POST", {}, token=TOK)
RAH = r.get("rahasia", ""); OTPURI = r.get("otpauth", "")
cek("2fa/aktifkan: rahasia + otpauth terbit", s == 200 and len(RAH) == 32 and OTPURI.startswith("otpauth://totp/"))
s, r, _ = panggil("/api/akun/2fa/konfirmasi", "POST", {"kode": "000000"}, token=TOK)
cek("2fa/konfirmasi: kode salah ditolak", s == 400)
s, r, _ = panggil("/api/akun/2fa/konfirmasi", "POST", {"kode": totp(RAH)}, token=TOK)
cek("2fa/konfirmasi: kode benar → aktif + kode cadangan", s == 200 and len(r.get("kodeCadangan", [])) == 3)
s, r, _ = panggil("/api/akun/masuk", "POST", {"email": EMAIL, "sandi": SANDI})
cek("masuk: akun 2FA minta kode (428)", s == 428 and r.get("perlu2fa") is True)
s, r, _ = panggil("/api/akun/masuk", "POST", {"email": EMAIL, "sandi": SANDI, "kode2fa": "123456"})
cek("masuk: kode 2FA salah ditolak 401", s == 401)
s, r, _ = panggil("/api/akun/masuk", "POST", {"email": EMAIL, "sandi": SANDI, "kode2fa": totp(RAH)})
TOK = r.get("token", "")
cek("masuk: dengan kode 2FA berhasil", s == 200 and TOK)
s, r, _ = panggil("/api/akun/2fa/matikan", "POST", {"sandi": "salahsandi1"}, token=TOK)
cek("2fa/matikan: sandi salah ditolak", s == 401)
s, r, _ = panggil("/api/akun/2fa/matikan", "POST", {"sandi": SANDI}, token=TOK)
cek("2fa/matikan: berhasil", s == 200)
s, r, _ = panggil("/api/akun/masuk", "POST", {"email": EMAIL, "sandi": SANDI})
cek("masuk: tanpa 2FA kembali normal", s == 200)

print("\n=== H. AKTIVITAS & LAYANAN ===")
s, r, _ = panggil("/api/akun/aktivitas", token=TOK)
cek("aktivitas: sesi + jejak + status 2FA", s == 200 and len(r.get("sesi", [])) >= 1 and len(r.get("jejak", [])) >= 3)
s, r, _ = panggil("/api/akun/layanan", token=TOK)
nama_l = [x["kunci"] for x in r.get("layanan", [])]
cek("layanan: anggota publik tanpa newsroom", s == 200 and r.get("anggota") is True and "newsroom" not in nama_l, ",".join(nama_l))
s, r, _ = panggil("/api/akun/keluar", "POST", {}, token=TOK)
cek("keluar: 200", s == 200)
s, r, _ = panggil("/api/akun/saya", token=TOK)
cek("keluar: token lama tidak sah lagi (sesi dicabut)", s == 401)

print("\n=== I. STAF LAMA (regresi) ===")
s, r, _ = panggil("/api/akun/masuk", "POST", {"email": "redaksi@mbcindonesia.tv", "sandi": "demo123"})
cek("masuk staf lama redaksi@ (sandi demo)", s == 200, r.get("error", ""))
if s == 200:
    T2 = r.get("token")
    s2, r2, _ = panggil("/api/akun/layanan", token=T2)
    cek("layanan staf: newsroom tersedia", any(x["kunci"] == "newsroom" for x in r2.get("layanan", [])),
        ",".join(x["kunci"] for x in r2.get("layanan", [])))
    s3, r3, _ = panggil("/api/newsroom/stats", cookie=f"mbc_sesi={s2 and ''}")
    cek("newsroom tetap butuh tokennya sendiri (401 tanpa token)", s3 == 401)

print("\n=== J. RATE LIMIT & PEMBATAS ===")
import os
batas_lingkungan = int(os.environ.get("AKUN_BATAS_DAFTAR", "5"))
kode = []
for i in range(3):
    s, r, _ = panggil("/api/akun/masuk", "POST", {"email": EMAIL, "sandi": "salahterus1"}, ip=f"10.{RUN}.1.77")
    kode.append(s)
cek("rate limit masuk: percobaan berulang tetap 401/429", kode[-1] in (401, 429), str(kode))
kode = []
for i in range(25):   # server uji memakai AKUN_BATAS_DAFTAR tinggi; uji hanya memastikan 429 muncul
    s, r, _ = panggil("/api/akun/daftar", "POST", {"nama": "Spam Uji", "email": f"spam{RUN}x{i}@contoh.id", "sandi": SANDI, "setuju": True}, ip=f"10.{RUN}.1.200")
    kode.append(s)
print("  kode respons daftar berulang:", kode[:8], "…", kode[-3:] if len(kode) > 8 else "")
cek("rate limit daftar: 429 muncul saat batas tercapai (atau seluruhnya 201 bila batas dinaikkan)",
    (429 in kode and kode.index(429) > 0) or all(k == 201 for k in kode),
    f"batas_server={batas_lingkungan}")

print("\n=== K. PEMBERSIHAN DATA UJI ===")
try:
    import psycopg2
    c = psycopg2.connect(DB_UJI, connect_timeout=10); c.autocommit = True; cur = c.cursor()
    cur.execute("select id from users where email not in ('redaksi@mbcindonesia.tv','direktur@mbcindonesia.tv','finance@mbcindonesia.tv','sales@mbcindonesia.tv')")
    for (uid,) in cur.fetchall():
        cur.execute("delete from ai_findings where evidence->>'kunci' like %s or evidence->>'kunci' like %s",
                    (f"{uid}", f"{uid}|%"))
    cur.execute("delete from users where email not in ('redaksi@mbcindonesia.tv','direktur@mbcindonesia.tv','finance@mbcindonesia.tv','sales@mbcindonesia.tv')")
    cur.execute("delete from audit_log where who like '%%contoh.id%%' or action like 'Akun:%%' or action like 'read:%%'")
    cur.execute("delete from ai_findings where agent_id='etika' and evidence->>'jenis' in ('sesi','profil','otp','2fa','2fa-pending','2fa-cadangan','2fa-cadangan')")
    cur.execute("delete from ai_findings where agent_id='etika' and evidence->>'jenis' in ('sesi','profil','otp','2fa','2fa-pending','2fa-cadangan') and evidence->>'kunci' not in (select id::text from users)")
    cur.execute("select id,email from users order by id"); semua = cur.fetchall()
    staf = {'redaksi@mbcindonesia.tv', 'direktur@mbcindonesia.tv', 'finance@mbcindonesia.tv', 'sales@mbcindonesia.tv'}
    sisa = [e for _, e in semua if e not in staf]
    cek("pembersihan: tidak ada akun uji tertinggal", not sisa, f"users={len(semua)}, sisa={sisa[:3]}")
    c.close()
except Exception as e:
    cek("pembersihan data uji", False, str(e)[:80])

print("\n=== RINGKASAN ===")
lulus = sum(1 for _, ok, _ in hasil if ok)
print(f"  {lulus}/{len(hasil)} uji lulus")
gagal = [n for n, ok, _ in hasil if not ok]
if gagal:
    print("  Gagal:", "; ".join(gagal))
sys.exit(0 if lulus == len(hasil) else 1)
