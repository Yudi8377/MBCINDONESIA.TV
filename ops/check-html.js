#!/usr/bin/env node
/* ops/check-html.js — audit kualitas HTML statis tanpa dependensi/browser.
   Cek: bahasa, judul, meta deskripsi, satu <h1>, viewport, skip-link, alt gambar,
        tautan internal yang benar-benar ada, dan tautan mati href="#".
   Pakai: node ops/check-html.js   (keluar 1 bila ada pelanggaran) */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'website');
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let problems = 0;
const bad = (f, msg) => { console.log(`  ✗ ${f}: ${msg}`); problems++; };

console.log(`Audit ${pages.length} halaman HTML di website/\n`);

for (const f of pages) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const before = problems;

  if (!/<html[^>]+lang="id"/i.test(html)) bad(f, 'atribut lang="id" tidak ada');
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  if (!title.trim()) bad(f, '<title> kosong');
  else if (title.trim().length > 75) bad(f, `<title> terlalu panjang (${title.trim().length} char)`);
  if (!/<meta[^>]+name="description"[^>]+content="[^"]{40,}"/i.test(html)) bad(f, 'meta description hilang/terlalu pendek');
  if (!/<meta[^>]+name="viewport"[^>]+width=device-width/i.test(html)) bad(f, 'meta viewport hilang');

  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1 === 0 && !/class="code">404/.test(html)) bad(f, 'tidak ada <h1>');
  if (h1 > 1) bad(f, `${h1} elemen <h1> (harus 1)`);

  // skip-link → target harus ada
  if (/class="skip-link"/.test(html)) {
    const target = (html.match(/class="skip-link"[^>]*href="#([^"]+)"/) || [])[1];
    if (target && !new RegExp(`id="${target}"`).test(html)) bad(f, `skip-link menunjuk #${target} yang tidak ada`);
  }

  // tautan internal harus ada filenya
  const links = [...html.matchAll(/(?:href|src)="([^"#:?]+\.(?:html|css|js|png|jpg|svg|webmanifest|xml|ico))"/g)].map(m => m[1]);
  for (const l of new Set(links)) {
    const rel = l.replace(/^\.?\//, '');
    const cands = [path.join(ROOT, rel), path.join(ROOT, path.dirname(f), rel)];
    if (!cands.some(c => fs.existsSync(c))) bad(f, `aset/tautan hilang: ${l}`);
  }

  // tautan mati
  const dead = (html.match(/href="#"/g) || []).length;
  if (dead) bad(f, `${dead} tautan mati href="#"`);

  // gambar tanpa alt
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const noAlt = imgs.filter(t => !/\balt=/.test(t)).length;
  if (noAlt) bad(f, `${noAlt} <img> tanpa alt`);

  // sintaks <script> inline (tanpa eksekusi)
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  for (const code of inline) {
    try { new Function(code); } catch (e) { bad(f, `sintaks <script> inline: ${e.message}`); }
  }

  if (problems === before) console.log(`  ✓ ${f} — ${title.trim()}`);
}

console.log('\n' + (problems === 0 ? `✅ ${pages.length} halaman lolos audit HTML` : `❌ ${problems} masalah ditemukan`));
process.exit(problems === 0 ? 0 : 1);
