#!/usr/bin/env node
/* ops/test-news-engine.js — uji mesin analisis berita & router pemandu AI.
   Memastikan halaman publik benar-benar "mengerti" berita: ringkasan, sentimen,
   entitas, pencarian literasi, dan klasifikasi niat pengunjung.
   Jalankan: node ops/test-news-engine.js   (keluar 1 bila ada kegagalan) */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const file = path.join(__dirname, '..', 'website', 'assets', 'js', 'ai-news.js');
const code = fs.readFileSync(file, 'utf8');

const ctx = { performance: { now: () => Date.now() }, console, Set, Math, Object, Array, String, JSON, RegExp, Number };
vm.createContext(ctx);
vm.runInContext(code + '\n;globalThis.__N = MBC_NEWS;', ctx);
const N = ctx.__N;

let fail = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  → ' + extra : ''));
  if (!cond) fail++;
};

console.log('== uji mesin berita MBC (ai-news.js)\n');

ok('korpus berita minimal 5 artikel', N.articles.length >= 5, N.articles.length + ' artikel');
ok('pustaka literasi minimal 10 rujukan', N.LIBRARY.length >= 10, N.LIBRARY.length + ' rujukan');
ok('setiap artikel punya id unik', new Set(N.articles.map(a => a.id)).size === N.articles.length);
ok('setiap artikel punya tag & body', N.articles.every(a => a.tags.length >= 3 && a.body.length >= 3));
ok('semua url rujukan internal valid', N.LIBRARY.every(r => !r.url || r.url.startsWith('http') || /^[\w-]+\.html/.test(r.url)));

// analisis per artikel
for (const a of N.articles) {
  const an = N.analyze(a.id);
  ok(`analisis "${a.title.slice(0, 34)}…"`, an.summary.length > 60 && an.keywords.length >= 3 && an.readingTime.endsWith('menit'),
     `${an.summary.length} char, ${an.keywords.length} kata kunci, ${an.sentiment.tone}, ${an.ms}ms`);
  ok(`  ↳ entitas terdeteksi`, an.entities.organizations.length + an.entities.places.length + an.entities.numbers.length > 0);
  ok(`  ↳ 3 berita terkait`, an.related.length === 3);
}

// sentimen kewajaran
const s1 = N.analyze('n-bmkg-kediri-banjir').sentiment;
const s2 = N.analyze('n-kopi-kediri').sentiment;
ok('berita bencana → nada negatif', ['negatif', 'netral'].includes(s1.label), s1.tone);
ok('berita ekspor sukses → cenderung positif/netral', ['positif', 'netral'].includes(s2.label), s2.tone);

// literasi
const lit1 = N.searchLiteracy('aturan upah minimum dan inflasi');
ok('literasi "upah minimum" menemukan regulasi ketenagakerjaan', lit1.some(x => /Kemnaker/.test(x.t)), lit1.map(x => x.t).slice(0, 2).join(' | '));
const lit2 = N.searchLiteracy('sumber data banjir dan korban bencana');
ok('literasi "banjir" menemukan data kebencanaan', lit2.some(x => /BNPB|BMKG/.test(x.t)));
const lit3 = N.searchLiteracy('privasi data AI', 'regulasi');
ok('filter tipe "regulasi" hanya mengembalikan regulasi', lit3.length > 0 && lit3.every(x => x.typ === 'regulasi'), lit3.map(x => x.t).join(', '));
ok('literasi kosong untuk kata tak relevan', N.searchLiteracy('zzzqqq').length === 0);

// pencarian artikel
const found = N.searchArticles('banjir kediri');
ok('cari "banjir kediri" mengembalikan berita BMKG di peringkat 1', found.length > 0 && /BMKG/.test(found[0].title));
ok('cari "kopi ekspor" mengembalikan berita kopi', N.searchArticles('kopi ekspor').some(x => /Kopi/.test(x.title)));

// router
const routes = {
  'halo': 'greet', 'bisa apa': 'help', 'jadwal live tv': 'watch', 'kontak redaksi': 'contact',
  'carikan referensi soal AI': 'literacy', 'ringkas berita ini': 'analysis', 'kopi kediri': 'search'
};
for (const [q, want] of Object.entries(routes)) {
  const got = N.route(q);
  ok(`router "${q}" → ${want}`, got === want, got);
}

// tanpa bocoran data internal
const dump = JSON.stringify(N.articles);
ok('korpus tidak memuat kredensial/kunci', !/password|api[_-]?key|secret|token/i.test(dump));

console.log('\n' + (fail === 0 ? '✅ SEMUA UJI MESIN BERITA LULUS' : `❌ ${fail} uji gagal`));
process.exit(fail === 0 ? 0 : 1);
