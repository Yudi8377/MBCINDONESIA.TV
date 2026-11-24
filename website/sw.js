/* MBCINDONESIA.TV — Service Worker (cache app-shell, network-first untuk navigasi) */
const CACHE = 'mbc-tv-v5'; /* naikkan versi setiap aset berubah agar klien lama ikut segar */
const SHELL = [
  './', './index.html', './watch.html', './live.html', './berita.html', './privasi.html', './syarat.html',
  './assets/css/site.css', './assets/js/site.js', './assets/js/data.js', './assets/js/ai-news.js', './assets/js/companion.js',
  './manifest.webmanifest', './icons/icon.svg',
  './assets/img/hero.jpg', './assets/img/kabar-nusantara.jpg', './assets/img/jejak-nusantara.jpg',
  './assets/img/selasar-budaya.jpg', './assets/img/ruang-bisnis.jpg', './assets/img/bicara-petang.jpg',
  './assets/img/kamera-komunitas.jpg', './assets/img/dapur-rempah.jpg', './assets/img/panggung-musik.jpg',
  './assets/video/live-24jam.mp4'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            /* sumber luar: langsung ke jaringan */
  if (url.pathname.includes('/assets/video/')) return;   /* video: jangan di-cache agar Range/seek tetap benar */
  /* API: SELALU ke jaringan, tidak di-cache. Dulu JSON /api/newsroom/public-list
     ikut tersimpan cache-first sehingga daftar berita CMS bisa basi berhari-hari. */
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
  }).catch(() => caches.match('./index.html'))));
});
