#!/usr/bin/env python3
"""Uji antarmuka MBC Single Account 1.5.0 (Playwright, Chromium) — desktop + mobile."""
import os, time, re, sys, hashlib
from playwright.sync_api import sync_playwright

DB_UJI = "postgresql://uji@localhost:5433/mbcuji?host=/tmp"
SECRET_UJI = os.environ.get("JWT_SECRET", "rahasiaujilokal1234567890")

def kode_dari_db(email, jenis):
    """Kode verifikasi tidak pernah tampil di halaman produksi; uji membacanya
    dari DB uji (meniru tim IT memeriksa) agar alur tetap bisa diuji."""
    try:
        import psycopg2
        c = psycopg2.connect(DB_UJI, connect_timeout=10); cur = c.cursor()
        cur.execute("""select evidence->'data'->>'hash' from ai_findings
                       where agent_id='etika' and evidence->>'jenis'='otp'
                         and evidence->>'kunci'=%s order by id desc limit 1""", (email.lower() + '|' + jenis,))
        b = cur.fetchone(); c.close()
        if not b or not b[0]:
            return ''
        for n in range(1000000):
            t = str(n).zfill(6)
            if hashlib.sha256((t + '|' + email.lower() + '|' + SECRET_UJI).encode()).hexdigest() == b[0]:
                return t
    except Exception:
        pass
    return ''

BASE = "http://127.0.0.1:8081"
EMAIL = f"ui.{int(time.time())}@contoh.id"
SANDI = "Rahasia123"
hasil = []

def cek(nama, syarat, ket=""):
    hasil.append((nama, bool(syarat), ket))
    print(("  OK   " if syarat else "  GAGAL") + f"  {nama}" + (f"  — {ket}" if ket else ""))

with sync_playwright() as p:
    br = p.chromium.launch()
    konteks = br.new_context(viewport={"width": 1440, "height": 900})
    pg = konteks.new_page()
    galat = []
    pg.on("pageerror", lambda e: galat.append(str(e)))
    pg.on("console", lambda m: galat.append(m.text)
          if m.type == "error" and "Failed to load resource" not in m.text else None)

    print("\n=== 1. HALAMAN DAFTAR ===")
    r = pg.goto(f"{BASE}/daftar.html", wait_until="networkidle")
    cek("daftar.html termuat 200", r.status == 200)
    cek("judul halaman benar", "Daftar" in pg.title(), pg.title())
    pg.fill("#d-nama", "Uji Antarmuka")
    pg.fill("#d-email", EMAIL)
    pg.fill("#d-sandi", SANDI)
    pg.select_option("#d-peran", "kreator")
    pg.check("[name=setuju]")
    pg.click("#formDaftar button[type=submit]")
    pg.wait_for_selector("#formDaftar [data-pesan]:not([hidden])", timeout=20000)
    pg.wait_for_timeout(400)
    kotak = pg.locator("#formDaftar [data-pesan]").inner_text()
    cek("daftar dari UI: pesan sukses tampil", "berhasil" in kotak.lower() or "dibuat" in kotak.lower(), kotak[:90])
    cek("sesi tersimpan di localStorage mbc_akun", bool(pg.evaluate("localStorage.getItem('mbc_akun')")))
    cek("kode verifikasi TIDAK ditampilkan ke pengguna", "Kode verifikasi email Anda" not in kotak, kotak[:90])
    pg.wait_for_timeout(3400)  # tunggu pengalihan ke dasbor

    print("\n=== 2. VERIFIKASI EMAIL DARI DASBOR ===")
    pg.wait_for_selector("#dasborAkun:not([hidden])", timeout=15000)
    cek("dasbor terbuka setelah daftar", "akun" in pg.url, pg.url.replace(BASE, ""))
    # klik "Kirim kode verifikasi" agar formulir kode terbuka (jalur pengguna nyata)
    if pg.locator("#btnKirimKode").count() and pg.locator("#btnKirimKode").is_visible():
        pg.click("#btnKirimKode")
        pg.wait_for_timeout(2500)
    kode_verif = kode_dari_db(EMAIL, 'verifikasi')
    cek("kode verifikasi tersedia (dibaca dari DB uji)", bool(kode_verif))
    cek("formulir kode terbuka setelah minta kode", pg.locator("#k-kode").is_visible())
    pg.fill("#k-kode", kode_verif)
    pg.click("#formKode button[type=submit]")
    badge = ""
    for _ in range(20):                     # dasbor memuat ulang setelah verifikasi
        pg.wait_for_timeout(600)
        try:
            badge = pg.locator("#verifBadge").inner_text(timeout=2000)
        except Exception:
            badge = ""
        if badge.strip().startswith("✓"):
            break
    cek("verifikasi email dari UI berhasil", badge.strip().startswith("✓"), badge or "belum tampil")

    print("\n=== 3. DASBOR AKUN ===")
    r = pg.goto(f"{BASE}/akun/", wait_until="networkidle")
    cek("akun/ termuat 200", r.status == 200)
    pg.wait_for_timeout(1500)
    cek("nama anggota tampil di dasbor", "Uji Antarmuka" in pg.inner_text("#namaAnggota"), pg.inner_text("#namaAnggota"))
    cek("label peran tampil", "Kreator" in pg.inner_text("#peranAnggota"), pg.inner_text("#peranAnggota"))
    cek("status email terverifikasi tampil", "terverifikasi" in pg.inner_text("#verifBadge").lower(),
        pg.inner_text("#verifBadge"))
    pg.wait_for_timeout(1200)
    jml = pg.eval_on_selector_all("#daftarLayanan > div", "els => els.length")
    cek("kartu layanan dirender (>=6)", jml >= 6, str(jml))
    cek("layanan 2FA berstatus aktif", "2FA" in pg.inner_text("#daftarLayanan"))

    print("\n=== 4. GANTI PROFIL ===")
    pg.fill("#p-bio", "Warga Kediri, suka berita ekonomi daerah.")
    pg.fill("#p-nama", "Uji Antarmuka Revisi")
    pg.click("#formProfil button[type=submit]")
    pg.wait_for_timeout(2000)
    cek("simpan profil dari UI", "tersimpan" in pg.inner_text("#pesanDasbor").lower(),
        pg.inner_text("#pesanDasbor")[:70])
    cek("nama baru langsung tampil", "Revisi" in pg.inner_text("#namaAnggota"))

    print("\n=== 5. KELUAR & MASUK ULANG ===")
    pg.click("#btnKeluar")
    pg.wait_for_timeout(2200)
    cek("keluar menghapus sesi localStorage", pg.evaluate("localStorage.getItem('mbc_akun')") in (None, "", "null"))
    r = pg.goto(f"{BASE}/masuk.html", wait_until="networkidle")
    cek("masuk.html termuat 200", r.status == 200)
    pg.fill("#m-email", EMAIL)
    pg.fill("#m-sandi", SANDI)
    pg.click("#formMasuk button[type=submit]")
    pg.wait_for_timeout(2600)
    cek("masuk dari UI berhasil diarahkan ke dasbor", "akun" in pg.url, pg.url.replace(BASE, ""))
    cek("tanpa galat JavaScript di halaman akun", not galat, "; ".join(galat[:2]))

    print("\n=== 6. LUPA KATA SANDI ===")
    r = pg.goto(f"{BASE}/lupa.html", wait_until="networkidle")
    cek("lupa.html termuat 200", r.status == 200)
    pg.fill("#l-email", EMAIL)
    pg.click("#formLupa button[type=submit]")
    pg.wait_for_selector("#formLupa [data-pesan]:not([hidden])", timeout=20000)
    pg.wait_for_timeout(400)
    teks = pg.locator("#formLupa [data-pesan]").inner_text()
    cek("lupa: kode TIDAK ditampilkan di halaman", re.search(r"\d{6}", teks) is None, teks[:80])
    kode_pulih = kode_dari_db(EMAIL, 'pulih')
    m = bool(kode_pulih)
    if m:
        cek("form pemulihan terbuka", not pg.locator("#blokPulih").is_hidden())
        pg.fill("#l-kode", kode_pulih)
        pg.fill("#l-baru", "PulihUI88")
        pg.click("#formLupa button[type=submit]")
        try:
            pg.wait_for_url("**/masuk.html", timeout=25000)   # bcrypt + pengalihan
            diarahkan, ket = True, pg.url.replace(BASE, "")
        except Exception:
            diarahkan = False
            try:
                ket = pg.locator("#formLupa [data-pesan]").inner_text(timeout=3000)[:70]
            except Exception:
                ket = pg.url.replace(BASE, "")
        cek("pulihkan akun dari UI berhasil & diarahkan ke masuk", diarahkan, ket)
    else:
        cek("pulihkan akun dari UI berhasil", False, "kode pratayang tidak tampil")

    print("\n=== 7. MOBILE 360 & 390 ===")
    for w, h in [(360, 740), (390, 844)]:
        m1 = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pm = m1.new_page()
        pm.goto(f"{BASE}/daftar.html", wait_until="networkidle")
        luber = pm.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        cek(f"daftar.html @{w}px tanpa geser horizontal", not luber,
            f"scrollWidth={pm.evaluate('document.documentElement.scrollWidth')}")
        pm.fill("#d-nama", "Uji Mobile")
        pm.fill("#d-email", f"mob.{w}.{int(time.time())}@contoh.id")
        pm.fill("#d-sandi", SANDI)
        pm.check("[name=setuju]")
        pm.click("#formDaftar button[type=submit]")
        pm.wait_for_selector("#formDaftar [data-pesan]:not([hidden])", timeout=20000)
        pm.wait_for_timeout(300)
        pesan = pm.locator("#formDaftar [data-pesan]").inner_text()
        cek(f"daftar dari mobile {w}px tertangani", len(pesan.strip()) > 0, pesan[:60])
        m1.close()

    br.close()

print("\n=== RINGKASAN UI ===")
lulus = sum(1 for _, ok, _ in hasil if ok)
print(f"  {lulus}/{len(hasil)} uji UI lulus")
gagal = [n for n, ok, _ in hasil if not ok]
if gagal:
    print("  Gagal:", "; ".join(gagal))
sys.exit(0 if lulus == len(hasil) else 1)
