"""Uji filter berita.html/rubrik.html: rubrik, wilayah, topik, artikel, pencarian, chip.
Jalankan: python3 ops/uji-filter-berita.py [BASE_URL]
Default BASE_URL = http://127.0.0.1:8101 (server statis folder website/)."""
import json, sys
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8101"
# CMS tiruan hanya dipakai saat uji lokal; di produksi pakai data CMS asli.
PAKAI_CMS_TIRUAN = "127.0.0.1" in B or "localhost" in B
CMS = {"articles": [
 {"slug":"cms-pasar","title":"Pasar Setono Betek Ramai Jelang Akhir Tahun","deck":"Pedagang melaporkan kenaikan pembeli.","channel":"Ekonomi","body":"Paragraf satu.\n\nParagraf dua.","published_at":"2026-11-21T08:00:00Z","tags":["pasar"],"hero_image":""},
 {"slug":"cms-teknologi","title":"Pelatihan Literasi AI untuk Guru Kediri","deck":"Guru belajar AI etis.","channel":"Teknologi","body":"Isi.\n\nDua.","published_at":"2026-11-21T07:00:00Z","tags":["ai"],"hero_image":""},
 {"slug":"cms-surabaya","title":"Banjir di Surabaya Barat Surut","deck":"Warga bersih-bersih.","channel":"Daerah","wilayah":"surabaya","body":"Isi.\n\nDua.","published_at":"2026-11-21T06:00:00Z","tags":["banjir"],"hero_image":""},
 {"slug":"cms-tanpa-kanal","title":"Warga Kediri Gotong Royong Bersihkan Kali","deck":"Kerja bakti warga.","channel":"","body":"Isi.\n\nDua.","published_at":"2026-11-21T05:00:00Z","tags":["kediri"],"hero_image":""}]}

KASUS = [
 ("/berita.html", "tanpa filter", None),
 ("/berita.html?artikel=n-bmkg-kediri-banjir&rubrik=daerah", "KASUS LAPORAN (artikel+rubrik)", "daerah"),
 ("/berita.html?artikel=cms-teknologi", "artikel CMS", None),
 ("/berita.html?rubrik=teknologi", "rubrik=teknologi", "teknologi"),
 ("/berita.html?rubrik=ekonomi", "rubrik=ekonomi", "ekonomi"),
 ("/berita.html?rubrik=pendidikan", "rubrik=pendidikan", "pendidikan"),
 ("/berita.html?rubrik=budaya", "rubrik=budaya", "budaya"),
 ("/berita.html?rubrik=internasional", "rubrik=internasional", "internasional"),
 ("/berita.html?rubrik=nasional", "rubrik=nasional", "nasional"),
 ("/berita.html?wilayah=surabaya", "wilayah=surabaya", None),
 ("/berita.html?wilayah=kediri", "wilayah=kediri", None),
 ("/berita.html?wilayah=jatim", "wilayah=jatim", None),
 ("/berita.html?wilayah=jawa-timur", "alias jawa-timur", None),
 ("/berita.html?rubrik=olahraga", "rubrik tak dikenal", None),
 ("/berita.html?topik=ekonomi&utm_source=wa", "?topik= lama + utm", "ekonomi"),
 ("/rubrik.html", "halaman rubrik", None),
]

def cek(br, jalur):
    ctx = br.new_context(viewport={"width": 1280, "height": 900})
    p = ctx.new_page()
    galat = []
    p.on("pageerror", lambda e: galat.append(str(e)))
    if PAKAI_CMS_TIRUAN:
        p.route("**/api/newsroom/public-list", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(CMS)))
    p.goto(B + jalur, wait_until="domcontentloaded"); p.wait_for_timeout(2500)
    d = {
      "chips": p.eval_on_selector_all("#topicChips button", "e=>e.map(x=>x.textContent.replace(/\\s+/g,' ').trim()+(x.classList.contains('active')?'‹AKTIF›':''))") if p.query_selector("#topicChips") else [],
      "kartu": p.eval_on_selector_all("#list .art-card", "e=>e.map(x=>x.querySelector('h3').textContent)") if p.query_selector("#list") else [],
      "dibaca": (p.inner_text("#reader h2") if p.query_selector("#reader h2") else ""),
      "url": p.url.replace(B, ""),
      "url_lengkap": p.url,
      "galat": galat,
      "sw": p.evaluate("navigator.serviceWorker.controller ? 1 : 0"),
    }
    if p.query_selector("#daftarRubrik"):
        d["rubrik_teks"] = p.inner_text("#daftarRubrik")
        d["wilayah_teks"] = p.inner_text("#daftarWilayah")
        d["catatan"] = p.inner_text("#catatanRubrik")
    ctx.close()
    return d

with sync_playwright() as pw:
    br = pw.chromium.launch()
    kelas = []
    for jalur, nama, harus_rubrik in KASUS:
        d = cek(br, jalur)
        print("\n== " + nama + "  [" + jalur + "]")
        print("   chips : " + " | ".join(d["chips"]) if d["chips"] else "   chips : -")
        print("   kartu : " + str(len(d["kartu"])) + " " + str([k[:45] for k in d["kartu"]]))
        print("   dibaca: " + d["dibaca"][:60])
        print("   URL   : " + d["url"] + "   | SW aktif: " + str(d["sw"]) + " | galat JS: " + str(d["galat"] or "tidak ada"))
        if "catatan" in d:
            print("   rubrik: " + " / ".join(x.strip() for x in d["rubrik_teks"].splitlines() if x.strip()))
            print("   wilayah: " + " / ".join(x.strip() for x in d["wilayah_teks"].splitlines() if x.strip()))
            print("   catatan: " + d["catatan"])
        if d["galat"] or d["url"].startswith("/berita.html?rubrik=tidak"):
            kelas.append(nama)
    # uji interaksi: klik chip, klik kartu, tombol hapus filter, pencarian
    ctx = br.new_context(viewport={"width": 1280, "height": 900}); p = ctx.new_page()
    if PAKAI_CMS_TIRUAN:
        p.route("**/api/newsroom/public-list", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(CMS)))
    print("\n== INTERAKSI ==")
    p.goto(B + "/berita.html", wait_until="networkidle"); p.wait_for_timeout(1000)
    p.click("#topicChips button[data-rubrik=ekonomi]"); p.wait_for_timeout(500)
    print("   klik chip Ekonomi → URL " + p.url.replace(B, "") + " | kartu " + str(len(p.query_selector_all("#list .art-card"))) + " | dibaca " + p.inner_text("#reader h2")[:40])
    cards = p.query_selector_all("#list .art-card")
    if len(cards) > 1:
        cards[-1].click(); p.wait_for_timeout(400)
        print("   klik kartu terakhir → dibaca " + p.inner_text("#reader h2")[:45] + " | URL " + p.url.replace(B, ""))
    p.click("#topicChips button[data-rubrik=ekonomi]"); p.wait_for_timeout(400)
    print("   klik chip aktif lagi (toggle) → kartu " + str(len(p.query_selector_all("#list .art-card"))) + " | chip aktif " + str(p.eval_on_selector_all("#topicChips button.active", "e=>e.map(x=>x.textContent.trim())")))
    p.click("#topicChips button[data-rubrik=budaya]"); p.wait_for_timeout(400)
    hapus = p.query_selector("#topicChips .chip-filter")
    print("   tombol ✕ ada: " + str(bool(hapus)) + " | teks: " + (hapus.inner_text().strip() if hapus else "-"))
    if hapus:
        hapus.click(); p.wait_for_timeout(500)
        print("   setelah ✕ → URL " + p.url.replace(B, "") + " | kartu " + str(len(p.query_selector_all("#list .art-card"))))
    p.fill("#q", "kopi"); p.wait_for_timeout(600)
    print("   cari 'kopi' → kartu " + str(len(p.query_selector_all("#list .art-card"))) + " | dibaca " + p.inner_text("#reader h2")[:40])
    p.fill("#q", "zzzz"); p.wait_for_timeout(600)
    print("   cari 'zzzz' → kartu " + str(len(p.query_selector_all("#list .art-card"))) + " | pesan: " + p.inner_text("#list")[:50])
    p.fill("#q", ""); p.wait_for_timeout(400)
    rel = p.query_selector_all("#sideRel .rel-item")
    if rel:
        href = rel[0].get_attribute("href"); rel[0].click(); p.wait_for_timeout(600)
        print("   klik berita terkait " + str(href) + " → dibaca " + p.inner_text("#reader h2")[:40] + " | URL " + p.url.replace(B, ""))
    br.close()
print("\nSELESAI. Gagal: " + (", ".join(kelas) if kelas else "tidak ada"))
