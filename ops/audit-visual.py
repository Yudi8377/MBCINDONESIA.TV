"""Audit tampilan: error konsol, 4xx/5xx, teks yang tumpang tindih, elemen keluar layar,
dan tangkapan layar di 3 ukuran (ponsel, tablet, desktop)."""
import asyncio, json, sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip('/')
ASAL = urlparse(BASE).hostname
HAL = ["/index.html", "/live.html", "/berita.html", "/watch.html?id=jejak-nusantara",
       "/watch.html?id=bicara-petang", "/newsroom/gerbang.html"]
UKURAN = [("ponsel", 390, 844), ("tablet", 820, 1180), ("desktop", 1366, 900)]

async def main():
    out = []
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        for nama, w, h in UKURAN:
            ctx = await br.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            for jalur in HAL:
                pg = await ctx.new_page()
                gagal, err_js, overflow = [], [], []
                pg.on("response", lambda r: r.status >= 400 and gagal.append(f"{r.status} {r.url[:90]}"))
                pg.on("pageerror", lambda e: err_js.append(str(e)[:140]))
                try:
                    await pg.goto(BASE + jalur, wait_until="load", timeout=45000)
                    await pg.wait_for_timeout(2500)
                    overflow = await pg.evaluate("""() => {
                      const w = document.documentElement.clientWidth, bad = [];
                      document.querySelectorAll('body *').forEach(el => {
                        const r = el.getBoundingClientRect();
                        if (r.width > 4 && (r.right > w + 2 || r.left < -2))
                          bad.push((el.tagName + '.' + (el.className||'')).slice(0,60) + ' [' + Math.round(r.left) + '→' + Math.round(r.right) + ' / ' + w + ']');
                      });
                      return bad.slice(0, 8);
                    }""")
                    tumpang = await pg.evaluate("""() => {
                      /* teks kecil yang terpotong (scrollWidth > clientWidth) = tanda layout rusak */
                      const bad = [];
                      document.querySelectorAll('h1,h2,h3,p,a,button,span').forEach(el => {
                        if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 3 &&
                            getComputedStyle(el).overflow !== 'visible' && el.textContent.trim().length > 3)
                          bad.push(el.tagName + ': "' + el.textContent.trim().slice(0, 40) + '"');
                      });
                      return bad.slice(0, 6);
                    }""")
                    judul = await pg.title()
                except Exception as e:
                    judul = "GAGAL: " + str(e)[:80]
                nama_file = f"docs/screens/{nama}-{jalur.strip('/').replace('?', '-').replace('=', '-').replace('/', '_') or 'home'}.png"
                try:
                    await pg.screenshot(path=nama_file, full_page=False)
                except Exception:
                    nama_file = "(gagal)"
                out.append({"ukuran": f"{nama} {w}x{h}", "halaman": jalur, "judul": judul,
                            "http_gagal": gagal, "error_js": err_js,
                            "keluar_layar": overflow, "teks_terpotong": tumpang, "layar": nama_file})
                await pg.close()
            await ctx.close()
        await br.close()
    print(json.dumps(out, indent=2, ensure_ascii=False))
    masalah = [o for o in out if o["http_gagal"] or o["error_js"] or o["keluar_layar"] or o["teks_terpotong"]]
    print(f"\nRINGKASAN: {len(out)} pemeriksaan, {len(masalah)} bermasalah")

asyncio.run(main())
