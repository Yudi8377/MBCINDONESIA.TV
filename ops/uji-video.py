"""Uji pemutaran video MBC Indonesia dengan Chromium sungguhan (bukan asumsi).
Mengecek: error media, readyState, durasi, dan apakah waktu berjalan (video benar-benar main).
"""
import asyncio, json, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"
TARGET = [
    ("live",    f"{BASE}/live.html",              "#liveVideo"),
    ("watch",   f"{BASE}/watch.html?id=kabar-nusantara", "#player"),
    ("watch2",  f"{BASE}/watch.html?id=dapur-rempah",    "#player"),
]

async def main():
    hasil = []
    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        for nama, url, sel in TARGET:
            pg = await br.new_page(viewport={"width": 1280, "height": 800})
            galat, konsol = [], []
            pg.on("console", lambda m: konsol.append(f"{m.type}: {m.text}"[:200]))
            pg.on("pageerror", lambda e: galat.append(str(e)[:200]))
            await pg.goto(url, wait_until="load")
            await pg.wait_for_timeout(1500)
            # klik play bila autoplay ditahan
            await pg.evaluate("(s)=>{const v=document.querySelector(s); if(v&&v.paused){v.muted=true;v.play().catch(()=>{})}}", sel)
            await pg.wait_for_timeout(3500)
            info = await pg.evaluate("""(s)=>{const v=document.querySelector(s);
              return v? {src:(v.currentSrc||'').split('/').pop(), readyState:v.readyState,
                durasi:Math.round(v.duration*10)/10, waktu:Math.round(v.currentTime*10)/10,
                paused:v.paused, err:v.error?v.error.code:null, lebar:v.videoWidth, tinggi:v.videoHeight}:null;}""", sel)
            ok = bool(info) and info["readyState"] >= 2 and info["waktu"] > 0.3 and not info["err"]
            hasil.append({"uji": nama, "url": url, "info": info, "main": ok,
                          "galat_js": galat, "konsol": konsol[-3:]})
            await pg.close()
        await br.close()
    print(json.dumps(hasil, indent=2, ensure_ascii=False))
    gagal = [h for h in hasil if not h["main"]]
    print("\nRINGKASAN:", "SEMUA VIDEO BERJALAN ✅" if not gagal else f"{len(gagal)} GAGAL ❌")
    return 0 if not gagal else 1

sys.exit(asyncio.run(main()))
