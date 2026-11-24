/* =========================================================================
   MBC INDONESIA — Aksi publik: kontribusi berita, laporan konten,
   penonton live nyata, dan penyegaran angka pengunjung (analitik nyata).
   Semua fungsi di sini tunduk pada rate limit di server.
   ========================================================================= */
(function () {
  'use strict';

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  }); };

  function kirimJSON(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); });
  }

  /* ---------------- 1. Form kontributor berita ---------------- */
  function pasangFormKontributor(root) {
    if (!root || root.dataset.siap) return;
    root.dataset.siap = '1';
    root.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var pesan = f.querySelector('[data-pesan]');
      var tombol = f.querySelector('button[type=submit]');
      var data = {
        nama: f.elements.nama.value,
        email: f.elements.email.value,
        judul: f.elements.judul.value,
        kategori: f.elements.kategori.value,
        wilayah: f.elements.wilayah.value,
        tautan: f.elements.tautan ? f.elements.tautan.value : '',
        isi: f.elements.isi.value
      };
      if (tombol) { tombol.disabled = true; tombol.textContent = 'Mengirim…'; }
      kirimJSON('/api/kontributor/kirim', data).then(function (r) {
        if (r.ok) {
          if (pesan) { pesan.textContent = '✅ ' + (r.body.pesan || 'Kiriman diterima.'); pesan.style.color = '#2fd27a'; pesan.hidden = false; }
          f.reset();
          if (window.MBC_ANALITIK) window.MBC_ANALITIK.kirim('share', { seconds: 0 });
        } else {
          if (pesan) { pesan.textContent = '⚠️ ' + (r.body.error || 'Kiriman gagal. Coba lagi.'); pesan.style.color = '#ff8a80'; pesan.hidden = false; }
        }
      }).catch(function () {
        if (pesan) { pesan.textContent = '⚠️ Jaringan tidak tersedia. Coba lagi.'; pesan.style.color = '#ff8a80'; pesan.hidden = false; }
      }).then(function () {
        if (tombol) { tombol.disabled = false; tombol.textContent = 'Kirim ke Redaksi'; }
      });
    });
  }


  /* ---------------- 2a. Pastikan tombol & jendela laporan selalu ada ---------------- */
  /* Gaya inti dipasang SEBELUM pemeriksaan awal: halaman yang sudah memuat
     #laporBtn/#laporModal dari HTML (mis. halaman akun) tetap butuh aturan
     `[hidden]{display:none}` agar jendela laporan tidak menutupi formulir. */
  function pasangGayaLapor() {
    if (document.getElementById('gayaLapor')) return;
    var gaya = document.createElement('style');
    gaya.id = 'gayaLapor';
    gaya.textContent = '#laporModal[hidden]{display:none !important}' +
      '#laporModal{position:fixed;inset:0;z-index:80;background:rgba(4,7,14,.8);display:grid;place-items:center;padding:1rem}' +
      '#laporBtn{position:fixed;right:14px;bottom:14px;z-index:60;font-size:.76rem;padding:.5rem .8rem}' +
      '#laporModal .kotak{background:var(--card,#111827);border:1px solid var(--line,#26304a);border-radius:14px;max-width:440px;width:100%;padding:1.1rem 1.2rem;color:var(--text,#e9edf6)}' +
      '#laporModal h3{margin:0 0 .3rem;font-size:1rem;color:#fff}' +
      '#laporModal .sub{color:var(--muted,#8b97b3);font-size:.8rem;margin:0 0 .8rem}' +
      '#laporModal .baris{display:flex;gap:.4rem;align-items:center;margin-bottom:.55rem}' +
      '#laporModal .baris label{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#8b97b3);font-weight:700;min-width:74px}' +
      '#laporModal input,#laporModal select,#laporModal textarea{flex:1;background:#0a1020;border:1px solid var(--line,#26304a);border-radius:9px;color:#fff;padding:.5rem .6rem;font-size:.85rem;font-family:inherit;min-height:42px}' +
      '#laporModal textarea{min-height:84px;resize:vertical}';
    document.head.appendChild(gaya);
  }

  function pastikanLapor() {
    pasangGayaLapor();
    if (document.getElementById('laporBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'laporBtn'; btn.className = 'btn btn-ghost';
    btn.type = 'button'; btn.textContent = '⚑ Laporkan konten';
    btn.setAttribute('aria-haspopup', 'dialog');
    document.body.appendChild(btn);

    var modal = document.createElement('div');
    modal.id = 'laporModal'; modal.hidden = true; modal.setAttribute('role', 'dialog');
    modal.innerHTML = '<div class="kotak"><h3>Laporkan konten</h3>' +
      '<p class="sub">Bantu kami menjaga ruang publik. Laporan ditinjau tim moderasi dalam 1×24 jam.</p>' +
      '<form><div class="baris"><label for="laporJenis">Jenis</label><select id="laporJenis" name="jenis">' +
      '<option value="spam">Spam / iklan</option><option value="sara">SARA / ujaran kebencian</option>' +
      '<option value="hoaks">Hoaks / misinformasi</option><option value="pelecehan">Pelecehan</option>' +
      '<option value="hak-cipta">Pelanggaran hak cipta</option><option value="lainnya">Lainnya</option></select></div>' +
      '<div class="baris"><label for="laporTarget">Tautan</label><input id="laporTarget" name="target" required maxlength="160"></div>' +
      '<div class="baris"><label for="laporCatatan">Catatan</label><textarea id="laporCatatan" name="catatan" maxlength="1000" placeholder="Jelaskan singkat masalahnya (opsional)"></textarea></div>' +
      '<div class="baris"><label for="laporEmail">Email</label><input id="laporEmail" name="email" type="email" maxlength="254" placeholder="opsional"></div>' +
      '<p data-pesan hidden style="font-size:.82rem;margin:.4rem 0"></p>' +
      '<div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:.5rem">' +
      '<button type="button" class="btn btn-ghost" data-tutup style="font-size:.8rem">Batal</button>' +
      '<button type="submit" class="btn btn-red" style="font-size:.8rem">Kirim laporan</button></div></form></div>';
    document.body.appendChild(modal);
  }

  /* ---------------- 2. Jendela laporan konten ---------------- */
  function pasangLaporan() {
    var tombol = document.getElementById('laporBtn');
    var modal = document.getElementById('laporModal');
    if (!tombol || !modal || modal.dataset.siap) return;
    modal.dataset.siap = '1';

    function buka() {
      modal.hidden = false; modal.style.display = 'grid';
      var t = document.getElementById('laporTarget');
      if (t && !t.value) t.value = location.pathname + location.search;
      var i = modal.querySelector('input, select, textarea'); if (i) i.focus();
    }
    function tutup() { modal.hidden = true; modal.style.display = 'none'; }

    tombol.addEventListener('click', buka);
    modal.addEventListener('click', function (e) { if (e.target.dataset.tutup !== undefined) tutup(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) tutup(); });

    var form = modal.querySelector('form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pesan = form.querySelector('[data-pesan]');
      var data = {
        jenis: form.elements.jenis.value,
        target: form.elements.target.value,
        catatan: form.elements.catatan.value,
        email: form.elements.email ? form.elements.email.value : '',
        halaman: location.pathname + location.search
      };
      kirimJSON('/api/lapor', data).then(function (r) {
        if (pesan) {
          pesan.textContent = r.ok ? '✅ ' + (r.body.pesan || 'Laporan diterima.') : '⚠️ ' + (r.body.error || 'Laporan gagal.');
          pesan.style.color = r.ok ? '#2fd27a' : '#ff8a80';
          pesan.hidden = false;
        }
        if (r.ok) { form.reset(); setTimeout(tutup, 1800); }
      }).catch(function () {
        if (pesan) { pesan.textContent = '⚠️ Jaringan tidak tersedia.'; pesan.style.color = '#ff8a80'; pesan.hidden = false; }
      });
    });
  }

  /* ---------------- 3. Penonton live nyata ---------------- */
  function pasangPenontonLive() {
    var el = document.getElementById('viewerCount');
    if (!el) return;
    var sid = (window.MBC_ANALITIK && window.MBC_ANALITIK.sid) || ('s' + Math.random().toString(36).slice(2, 12));
    var nyata = false;
    function detak() {
      kirimJSON('/api/live/heartbeat', { sid: sid }).then(function (r) {
        if (r.ok && typeof r.body.penonton === 'number') {
          nyata = true;
          el.textContent = r.body.penonton.toLocaleString('id-ID');
          el.title = 'Penonton aktif (diperbarui tiap 30 detik)';
          el.dataset.nyata = '1';
          var lbl = document.getElementById('viewerLabel');
          if (lbl) lbl.textContent = 'penonton aktif (data nyata)';
        }
      }).catch(function () {});
    }
    detak();
    setInterval(detak, 30000);
    /* beri tanda visual bila angka belum tersedia dari server */
    setTimeout(function () {
      if (nyata) return;
      el.title = 'Data penonton sedang disiapkan';
      var lbl = document.getElementById('viewerLabel');
      if (lbl) lbl.textContent = 'penonton (data belum tersedia)';
    }, 5000);
  }

  /* ---------------- 4. Angka pengunjung nyata di beranda ---------------- */
  function pasangAngkaPengunjung() {
    var hosts = document.querySelectorAll('[data-statistik="pengunjung"], [data-statistik="tayangan"]');
    if (!hosts.length) return;
    fetch('/api/analytics/summary', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) return;
        document.querySelectorAll('[data-statistik="pengunjung"]').forEach(function (el) {
          el.textContent = Number(j.pengunjung || 0).toLocaleString('id-ID');
        });
        document.querySelectorAll('[data-statistik="tayangan"]').forEach(function (el) {
          el.textContent = Number(j.tayangan || 0).toLocaleString('id-ID');
        });
        document.querySelectorAll('[data-statistik="video"]').forEach(function (el) {
          el.textContent = Number(j.putar_video || 0).toLocaleString('id-ID');
        });
      }).catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-form-kontributor]').forEach(pasangFormKontributor);
    pastikanLapor();
    pasangLaporan();
    pasangPenontonLive();
    pasangAngkaPengunjung();
  });
  window.MBC_AKSI = { esc: esc };
})();
