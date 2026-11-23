#!/usr/bin/env node
/* ============================================================
   ops/responsive-audit.js — audit tata letak lintas perangkat
   ------------------------------------------------------------
   Memeriksa setiap halaman pada ukuran ponsel Android, iPhone (SE &
   14 Pro), tablet, dan laptop:
     • tidak ada geser horizontal (halaman "ambyar")
     • tidak ada elemen yang keluar layar tanpa wadah geser
     • tidak ada error JavaScript saat halaman dimuat
     • target sentuh utama ≥ 36 px

   Pakai:
     BASE_URL=http://127.0.0.1:8080 node ops/responsive-audit.js
     BASE_URL=https://mbcindonesia.tv  node ops/responsive-audit.js

   Butuh Playwright:
     npx playwright@1.49.0 install chromium && npm i -D playwright-core@1.49.0
   ============================================================ */
'use strict';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const PAGES = process.env.PAGES
  ? process.env.PAGES.split(',')
  : ['/', '/berita.html', '/live.html', '/watch.html?id=jejak-nusantara', '/privasi.html', '/syarat.html', '/404.html', '/newsroom/gerbang.html'];
const VIEWPORTS = [
  [360, 740, 'Android kecil'],
  [390, 844, 'Android umum'],
  [375, 667, 'iPhone SE'],
  [393, 852, 'iPhone 14 Pro'],
  [768, 1024, 'Tablet potret'],
  [1024, 768, 'Tablet lanskap'],
  [1280, 800, 'Laptop']
];

let chromium;
try { ({ chromium } = require('playwright-core')); }
catch (_) {
  try { ({ chromium } = require('playwright')); }
  catch (_) {
    console.error('⚠️  Playwright belum terpasang. Jalankan:\n   npm i -D playwright-core@1.49.0 && npx playwright@1.49.0 install chromium');
    process.exit(2);
  }
}

/* Tautan inline di tengah kalimat dikecualikan dari syarat ukuran sentuh (WCAG 2.5.8). */
const probe = () => {
  const W = screen.width;
  const clipped = el => {
    let n = el.parentElement;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (/auto|scroll|hidden/.test(cs.overflowX) || /auto|scroll|hidden/.test(cs.overflow)) return true;
      n = n.parentElement;
    }
    return false;
  };
  const overflow = [...document.querySelectorAll('body *')]
    .map(el => ({ el, b: el.getBoundingClientRect() }))
    .filter(o => o.b.width > 0 && o.b.right > W + 2 && getComputedStyle(o.el).position !== 'fixed' && !clipped(o.el))
    .slice(0, 4)
    .map(o => `${o.el.tagName.toLowerCase()}${o.el.id ? '#' + o.el.id : ''}.${String(o.el.className || '').split(' ')[0]} (${Math.round(o.b.width)}px)`);
  const small = [...document.querySelectorAll('a[href],button,.chip')]
    .map(el => ({ el, b: el.getBoundingClientRect() }))
    .filter(o => {
      if (o.b.height <= 2 || o.b.height >= 36) return false;
      const par = o.el.parentElement;
      const inlineInProse = par && /^(P|LI|SPAN|TD)$/.test(par.tagName) &&
        [...par.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 8);
      return !inlineInProse;
    })
    .map(o => `${o.el.tagName.toLowerCase()} "${o.el.textContent.trim().slice(0, 24)}" ${Math.round(o.b.height)}px`);
  return { overflow, small, hScroll: document.documentElement.scrollWidth > W + 1, width: document.documentElement.scrollWidth };
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let fail = 0, total = 0;
  console.log(`== Audit responsif · ${BASE}`);
  for (const path of PAGES) {
    for (const [w, h, label] of VIEWPORTS) {
      total++;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      try {
        await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(500);
        const r = await page.evaluate(probe);
        const bad = r.hScroll || r.overflow.length || errors.length;
        if (bad) {
          fail++;
          console.log(`GAGAL ${path.padEnd(30)} ${label.padEnd(16)} lebar=${r.width}/${w}` +
            (r.overflow.length ? ` · keluar: ${r.overflow.join(', ')}` : '') +
            (errors.length ? ` · JS: ${errors[0]}` : ''));
        } else {
          console.log(`ok    ${path.padEnd(30)} ${label.padEnd(16)} ${r.small.length ? 'catatan: ' + r.small.length + ' target kecil' : ''}`);
        }
      } catch (e) {
        fail++;
        console.log(`GAGAL ${path.padEnd(30)} ${label.padEnd(16)} tidak dapat dimuat: ${e.message.split('\n')[0]}`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log('-------------------------------------------');
  if (fail) { console.log(`❌ ${fail}/${total} kombinasi halaman × perangkat bermasalah`); process.exit(1); }
  console.log(`✅ ${total} kombinasi halaman × perangkat lolos (tanpa geser horizontal, tanpa elemen keluar layar, tanpa error JS)`);
})();
