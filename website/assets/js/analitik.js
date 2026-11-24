/* =========================================================================
   MBC INDONESIA — Analitik nyata (tanpa cookie pihak ketiga, tanpa profil)
   Mengirim: tayangan halaman, durasi baca, putar video, bagikan tautan.
   Data masuk ke /api/analytics/collect dan diringkas di /api/analytics/summary.
   ========================================================================= */
(function () {
  'use strict';
  if (window.__mbcAnalitik) return;
  window.__mbcAnalitik = true;

  var sid;
  try {
    sid = localStorage.getItem('mbc_sid');
    if (!sid) {
      sid = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('mbc_sid', sid);
    }
  } catch (e) { sid = 's' + Math.random().toString(36).slice(2, 12); }

  function kirim(type, tambahan) {
    try {
      var body = Object.assign({ page: location.pathname.replace(/^\//, '') || 'index.html', type: type, sid: sid }, tambahan || {});
      var data = JSON.stringify(body);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/collect', new Blob([data], { type: 'application/json' }));
      } else {
        fetch('/api/analytics/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true }).catch(function () {});
      }
    } catch (e) { /* analitik tidak boleh mengganggu pengunjung */ }
  }

  /* 1. Tayangan halaman (sekali per muat) */
  kirim('view');

  /* 2. Durasi baca: kirim saat pengunjung pergi/bilenjong tab, bila > 8 detik */
  var mulai = Date.now(), terkirim = false;
  function laporBaca() {
    if (terkirim) return;
    var detik = Math.round((Date.now() - mulai) / 1000);
    if (detik < 8) return;
    terkirim = true;
    kirim('read', { seconds: detik });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) laporBaca(); });
  window.addEventListener('pagehide', laporBaca);

  /* 3. Putar video: otomatis terpasang ke setiap <video> di halaman */
  function pantauVideo(v) {
    if (!v || v.__dipantau) return;
    v.__dipantau = true;
    var catat = false;
    v.addEventListener('playing', function () {
      if (catat) return;
      catat = true;
      kirim('video', { seconds: 0 });
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('video'), pantauVideo);
  new MutationObserver(function (m) {
    m.forEach(function (r) { Array.prototype.forEach.call(r.addedNodes || [], function (n) {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'VIDEO') pantauVideo(n);
      else if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll('video'), pantauVideo);
    }); });
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });

  /* 4. Bagikan tautan */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-bagikan]');
    if (!t) return;
    kirim('share');
  }, true);

  /* 5. API kecil untuk halaman lain */
  window.MBC_ANALITIK = { kirim: kirim, sid: sid };
})();
