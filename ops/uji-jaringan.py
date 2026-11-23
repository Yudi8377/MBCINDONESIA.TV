"""Forensik jaringan: catat SEMUA permintaan yang gagal di 4 halaman yang dikeluhkan.
Menjawab satu pertanyaan: yang gagal itu aset situs kita, atau milik pihak ketiga?
"""
import asyncio, json, sys
from urllib.parse import urlparse
from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip("/")
HALAMAN = [
    ("Program",    f"{BASE}/index.html#katalog"),
    ("Live TV",    f"{BASE}/live.html"),
    ("Dokumenter", f"{BASE}/watch.html?id=jejak-nusantara"),
    ("Podcast",    f"{BASE}/watch.html?id=bicara-petang"),
]
ASAL = urlparse(BASE).hostname

async def main():
    ringkas = []
    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        ctx = await br.new_context(viewport={"width": 1280, "height": 800})
        for nama, url in HALAMAN:
            pg = await ctx.new_page()
            gagal, ok_host, konsol = [], {}, []
            def on_resp(r):
                host = urlparse(r.url).hostname or "?"
                if r.status >= 400:
                    gagal.append({"status": r.status, "host": host, "url": r.url[:120]})
                else:
                    ok_host[host] = ok_host.get(host, 0) + 1
            pg.on("response", on_resp)
            pg.on("requestfailed", lambda r: gagal.append({
                "status": "FAILED", "galat": r.failure or "", "host": urlparse(r.url).hostname or "?",
                "url": r.url[:120]}))
            pg.on("console", lambda m: konsol.append(m.text[:160]))
            try:
                await pg.goto(url, wait_until="load", timeout=45000)
                await pg.wait_for_timeout(6000)
                judul = await pg.title()
            except Exception as e:
                judul = f"GAGAL MUAT: {str(e)[:80]}"
            milik_kita = [g for g in gagal if g["host"] == ASAL]
            pihak_lain = [g for g in gagal if g["host"] != ASAL]
            ringkas.append({"halaman": nama, "url": url, "judul": judul,
                            "permintaan_ok": ok_host, "gagal_milik_kita": milik_kita,
                            "gagal_pihak_ketiga": pihak_lain,
                            "konsol": [k for k in konsol if "Failed to load" in k or "ERR_" in k][:5]})
            await pg.close()
        await br.close()
    print(json.dumps(ringkas, indent=2, ensure_ascii=False))
    tot_kita = sum(len(r["gagal_milik_kita"]) for r in ringkas)
    tot_lain = sum(len(r["gagal_pihak_ketiga"]) for r in ringkas)
    print(f"\nRINGKASAN: gagal milik situs = {tot_kita} | gagal pihak ketiga = {tot_lain}")

asyncio.run(main())
