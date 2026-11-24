/* =========================================================================
   MBC INDONESIA — Klien MBC Single Account (1.5.0)
   Dipakai oleh /masuk.html, /daftar.html, /lupa.html, dan /akun/.
   Token disimpan di cookie HttpOnly dari server; di sisi klien hanya disimpan
   salinan untuk tampilan cepat (localStorage) — bukan sumber otorisasi.
   ========================================================================= */
(function () {
  'use strict';

  var KUNCI = 'mbc_akun';

  function simpan(t, anggota) {
    try { localStorage.setItem(KUNCI, JSON.stringify({ t: t, anggota: anggota || null })); } catch (e) {}
  }
  function hapus() { try { localStorage.removeItem(KUNCI); } catch (e) {} }
  function lokal() {
    try { return JSON.parse(localStorage.getItem(KUNCI) || 'null'); } catch (e) { return null; }
  }

  function minta(url, opsi) {
    opsi = opsi || {};
    var h = { 'Content-Type': 'application/json' };
    var l = lokal();
    if (l && l.t) h.Authorization = 'Bearer ' + l.t;
    return fetch(url, {
      method: opsi.method || 'GET',
      headers: h,
      credentials: 'same-origin',
      body: opsi.body ? JSON.stringify(opsi.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, data: j }; });
    });
  }

  function pesan(el, teks, jenis) {
    if (!el) return;
    el.textContent = teks;
    el.hidden = false;
    el.style.color = jenis === 'ok' ? '#2fd27a' : jenis === 'info' ? '#9fb0cc' : '#ff8a80';
  }

  function tombolSibuk(btn, teks) {
    if (!btn) return function () {};
    var asli = btn.textContent;
    btn.disabled = true; btn.textContent = teks;
    return function () { btn.disabled = false; btn.textContent = asli; };
  }

  /* ---------------- FORM: MASUK ---------------- */
  function pasangMasuk(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var p = form.querySelector('[data-pesan]');
      var selesai = tombolSibuk(form.querySelector('button[type=submit]'), 'Memeriksa…');
      minta('/api/akun/masuk', { method: 'POST', body: {
        email: form.elements.email.value, sandi: form.elements.sandi.value
      } }).then(function (r) {
        if (r.ok) {
          simpan(r.data.token, r.data.anggota);
          pesan(p, '✅ Berhasil masuk. Mengalihkan ke dasbor…', 'ok');
          var next = new URLSearchParams(location.search).get('next') || 'akun/';
          setTimeout(function () { location.href = next; }, 700);
        } else pesan(p, '⚠️ ' + (r.data.error || 'Gagal masuk'));
      }).catch(function () { pesan(p, '⚠️ Jaringan tidak tersedia.'); })
        .then(selesai);
    });
  }

  /* ---------------- FORM: DAFTAR ---------------- */
  function pasangDaftar(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var p = form.querySelector('[data-pesan]');
      var setuju = form.querySelector('[name=setuju]');
      if (setuju && !setuju.checked) return pesan(p, '⚠️ Centang persetujuan Syarat & Ketentuan lebih dulu.');
      var selesai = tombolSibuk(form.querySelector('button[type=submit]'), 'Membuat akun…');
      minta('/api/akun/daftar', { method: 'POST', body: {
        nama: form.elements.nama.value,
        email: form.elements.email.value,
        sandi: form.elements.sandi.value,
        peran: form.elements.peran ? form.elements.peran.value : 'anggota',
        setuju: !!(setuju && setuju.checked)
      } }).then(function (r) {
        if (r.ok) {
          simpan(r.data.token, r.data.anggota);
          var kode = r.data.kodePratayang;
          pesan(p, '✅ Akun dibuat.' + (kode
            ? ' Kode verifikasi email Anda: ' + kode + ' — masukkan di dasbor untuk mengaktifkan.'
            : ' Silakan periksa email untuk kode verifikasi.') + ' Mengalihkan ke dasbor…', 'ok');
          setTimeout(function () { location.href = 'akun/' + (kode ? '?kode=' + kode : ''); }, 2600);
        } else pesan(p, '⚠️ ' + (r.data.error || 'Pendaftaran gagal'));
      }).catch(function () { pesan(p, '⚠️ Jaringan tidak tersedia.'); }).then(selesai);
    });
  }

  /* ---------------- FORM: LUPA SANDI (2 langkah) ---------------- */
  function pasangLupa(form) {
    var langkah = 1;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var p = form.querySelector('[data-pesan]');
      var selesai = tombolSibuk(form.querySelector('button[type=submit]'), 'Memproses…');
      var email = form.elements.email.value;

      if (langkah === 1) {
        minta('/api/akun/lupa', { method: 'POST', body: { email: email } }).then(function (r) {
          if (r.ok) {
            pesan(p, '✅ ' + r.data.pesan + (r.data.kodePratayang ? ' Kode Anda: ' + r.data.kodePratayang : ' Periksa kotak masuk email Anda.'), 'ok');
            var blok = document.getElementById('blokPulih');
            if (blok) blok.hidden = false;
            langkah = 2;
          } else pesan(p, '⚠️ ' + (r.data.error || 'Permintaan gagal'));
        }).catch(function () { pesan(p, '⚠️ Jaringan tidak tersedia.'); }).then(selesai);
        return;
      }
      minta('/api/akun/pulihkan', { method: 'POST', body: {
        email: email, kode: form.elements.kode.value, sandi: form.elements.sandiBaru.value
      } }).then(function (r) {
        if (r.ok) {
          pesan(p, '✅ ' + r.data.pesan, 'ok');
          setTimeout(function () { location.href = 'masuk.html'; }, 1400);
        } else pesan(p, '⚠️ ' + (r.data.error || 'Pemulihan gagal'));
      }).catch(function () { pesan(p, '⚠️ Jaringan tidak tersedia.'); }).then(selesai);
    });
  }

  /* ---------------- DASBOR AKUN ---------------- */
  function pasangDasbor() {
    var root = document.getElementById('dasborAkun');
    if (!root) return;
    var pesanEl = document.getElementById('pesanDasbor');

    minta('/api/akun/saya').then(function (r) {
      if (!r.ok) {
        pesan(pesanEl, 'Sesi tidak ditemukan. Mengalihkan ke halaman masuk…', 'info');
        setTimeout(function () { location.href = '../masuk.html?next=akun/'; }, 1200);
        return;
      }
      var a = r.data.anggota;
      document.getElementById('namaAnggota').textContent = a.nama;
      document.getElementById('peranAnggota').textContent = a.labelPeran;
      document.getElementById('emailAnggota').textContent = a.email;
      document.getElementById('bioAnggota').textContent = a.bio || 'Belum ada bio.';
      document.getElementById('sejakAnggota').textContent = new Date(a.sejak).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
      document.getElementById('verifBadge').textContent = a.terverifikasi ? '✓ Email terverifikasi' : '⚠ Email belum terverifikasi';
      document.getElementById('verifBadge').style.color = a.terverifikasi ? '#2fd27a' : '#f2c14e';
      document.getElementById('status2fa').textContent = r.data.duaFaktor ? 'Aktif' : 'Belum aktif';
      document.getElementById('status2fa').style.color = r.data.duaFaktor ? '#2fd27a' : '#f2c14e';
      root.hidden = false;
      muatLayanan();
      muatAktivitas();
      if (!a.terverifikasi) blokVerif(false);
      var kodeUrl = new URLSearchParams(location.search).get('kode');
      if (kodeUrl && !a.terverifikasi) {
        blokVerif(true);
        var fk = document.getElementById('formKode');
        if (fk && fk.elements.kode) fk.elements.kode.value = kodeUrl;
        pesan(pesanEl, 'Kode verifikasi sudah terisi. Tekan "Verifikasi" untuk mengaktifkan email.', 'info');
      }
    }).catch(function () { pesan(pesanEl, 'Gagal memuat profil.'); });

    function muatLayanan() {
      minta('/api/akun/layanan').then(function (r) {
        if (!r.ok) return;
        var host = document.getElementById('daftarLayanan');
        host.innerHTML = r.data.layanan.map(function (l) {
          var aktif = l.status === 'aktif';
          return '<div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:.75rem .9rem">' +
            '<div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center">' +
            '<b style="font-size:.9rem;color:#fff">' + l.nama + '</b>' +
            '<span style="font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:' +
            (aktif ? '#2fd27a' : '#8b97b3') + '">' + (aktif ? 'Aktif' : 'Segera') + '</span></div>' +
            '<div style="font-size:.76rem;color:var(--muted);margin-top:.2rem">' + l.catatan + '</div>' +
            (aktif && l.tautan ? '<a href="..' + l.tautan + '" style="font-size:.76rem;color:var(--red2);display:inline-block;margin-top:.35rem">Buka →</a>' : '') +
            '</div>';
        }).join('');
      });
    }

    function muatAktivitas() {
      minta('/api/akun/aktivitas').then(function (r) {
        if (!r.ok) return;
        var host = document.getElementById('daftarAktivitas');
        host.innerHTML = r.data.aktivitas.length ? r.data.aktivitas.map(function (x) {
          return '<div style="display:flex;justify-content:space-between;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--line);font-size:.8rem">' +
            '<span>' + x.action + '</span><span style="color:var(--muted);white-space:nowrap">' +
            new Date(x.created_at).toLocaleString('id-ID') + '</span></div>';
        }).join('') : '<div style="font-size:.82rem;color:var(--muted)">Belum ada aktivitas.</div>';
      });
    }

    /* ------- profil ------- */
    var formProfil = document.getElementById('formProfil');
    if (formProfil) formProfil.addEventListener('submit', function (e) {
      e.preventDefault();
      var selesai = tombolSibuk(formProfil.querySelector('button[type=submit]'), 'Menyimpan…');
      minta('/api/akun/saya', { method: 'PATCH', body: {
        nama: formProfil.elements.nama.value, bio: formProfil.elements.bio.value
      } }).then(function (r) {
        pesan(pesanEl, r.ok ? '✅ Profil tersimpan.' : '⚠️ ' + (r.data.error || 'Gagal menyimpan'), r.ok ? 'ok' : 'err');
        if (r.ok) {
          document.getElementById('namaAnggota').textContent = r.data.anggota.nama;
          document.getElementById('bioAnggota').textContent = r.data.anggota.bio || 'Belum ada bio.';
        }
      }).catch(function () { pesan(pesanEl, '⚠️ Jaringan tidak tersedia.'); }).then(selesai);
    });

    /* ------- ganti sandi ------- */
    var formSandi = document.getElementById('formSandi');
    if (formSandi) formSandi.addEventListener('submit', function (e) {
      e.preventDefault();
      var selesai = tombolSibuk(formSandi.querySelector('button[type=submit]'), 'Menyimpan…');
      minta('/api/akun/sandi', { method: 'POST', body: {
        lama: formSandi.elements.lama.value, baru: formSandi.elements.sandiBaru.value
      } }).then(function (r) {
        pesan(pesanEl, r.ok ? '✅ ' + r.data.pesan : '⚠️ ' + (r.data.error || 'Gagal'), r.ok ? 'ok' : 'err');
        if (r.ok) formSandi.reset();
      }).catch(function () { pesan(pesanEl, '⚠️ Jaringan tidak tersedia.'); }).then(selesai);
    });

    /* ------- verifikasi email ------- */
    function blokVerif(tampilKode) {
      var b = document.getElementById('blokVerif');
      if (b) b.hidden = false;
      if (tampilKode) {
        var f = document.getElementById('formKode');
        if (f) f.hidden = false;
      }
    }
    var btnKirim = document.getElementById('btnKirimKode');
    if (btnKirim) btnKirim.addEventListener('click', function () {
      var selesai = tombolSibuk(btnKirim, 'Mengirim…');
      minta('/api/akun/otp/kirim', { method: 'POST', body: {} }).then(function (r) {
        pesan(pesanEl, r.ok ? '✅ ' + r.data.pesan + (r.data.kodePratayang ? ' Kode Anda: ' + r.data.kodePratayang : '') : '⚠️ ' + (r.data.error || 'Gagal'), r.ok ? 'ok' : 'err');
        if (r.ok) blokVerif(true);
      }).catch(function () { pesan(pesanEl, '⚠️ Jaringan tidak tersedia.'); }).then(selesai);
    });
    var formKode = document.getElementById('formKode');
    if (formKode) formKode.addEventListener('submit', function (e) {
      e.preventDefault();
      var selesai = tombolSibuk(formKode.querySelector('button[type=submit]'), 'Memeriksa…');
      minta('/api/akun/otp/verifikasi', { method: 'POST', body: { kode: formKode.elements.kode.value } })
        .then(function (r) {
          pesan(pesanEl, r.ok ? '✅ ' + r.data.pesan : '⚠️ ' + (r.data.error || 'Kode salah'), r.ok ? 'ok' : 'err');
          if (r.ok) {
            document.getElementById('verifBadge').textContent = '✓ Email terverifikasi';
            document.getElementById('verifBadge').style.color = '#2fd27a';
            setTimeout(function () { location.reload(); }, 1000);
          }
        }).catch(function () { pesan(pesanEl, '⚠️ Jaringan tidak tersedia.'); }).then(selesai);
    });

    /* ------- 2FA ------- */
    var btn2fa = document.getElementById('btn2fa');
    if (btn2fa) btn2fa.addEventListener('click', function () {
      var selesai = tombolSibuk(btn2fa, 'Menyiapkan…');
      minta('/api/akun/2fa/aktifkan', { method: 'POST', body: {} }).then(function (r) {
        if (!r.ok) { pesan(pesanEl, '⚠️ ' + (r.data.error || '2FA belum tersedia'), 'err'); return; }
        document.getElementById('blok2fa').hidden = false;
        document.getElementById('rahasia2fa').textContent = r.data.rahasia;
        document.getElementById('qr2fa').src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(r.data.uri);
        pesan(pesanEl, 'Pindai QR dengan aplikasi autentikator, lalu masukkan 6 digit.', 'info');
      }).catch(function () { pesan(pesanEl, '⚠️ Jaringan tidak tersedia.'); }).then(selesai);
    });
    var form2fa = document.getElementById('form2fa');
    if (form2fa) form2fa.addEventListener('submit', function (e) {
      e.preventDefault();
      var selesai = tombolSibuk(form2fa.querySelector('button[type=submit]'), 'Memeriksa…');
      minta('/api/akun/2fa/konfirmasi', { method: 'POST', body: { kode: form2fa.elements.kode.value } })
        .then(function (r) {
          pesan(pesanEl, r.ok ? '✅ ' + r.data.pesan : '⚠️ ' + (r.data.error || 'Kode salah'), r.ok ? 'ok' : 'err');
          if (r.ok) { document.getElementById('status2fa').textContent = 'Aktif'; document.getElementById('status2fa').style.color = '#2fd27a'; }
        }).catch(function () { pesan(pesanEl, '⚠️ Jaringan tidak tersedia.'); }).then(selesai);
    });

    /* ------- keluar & hapus sesi lokal ------- */
    var btnKeluar = document.getElementById('btnKeluar');
    if (btnKeluar) btnKeluar.addEventListener('click', function () {
      minta('/api/akun/keluar', { method: 'POST', body: {} }).then(function () {
        hapus(); location.href = '../index.html';
      }).catch(function () { hapus(); location.href = '../index.html'; });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var fMasuk = document.getElementById('formMasuk'); if (fMasuk) pasangMasuk(fMasuk);
    var fDaftar = document.getElementById('formDaftar'); if (fDaftar) pasangDaftar(fDaftar);
    var fLupa = document.getElementById('formLupa'); if (fLupa) pasangLupa(fLupa);
    pasangDasbor();
  });

  window.MBC_AKUN = { minta: minta, lokal: lokal, keluar: hapus, pesan: pesan };
})();
