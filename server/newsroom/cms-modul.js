/* ============================================================
   cms-modul.js — Komponen "Modul" untuk 19 menu newsroom
   ------------------------------------------------------------
   Satu komponen (modulPanel) dipasang di SETIAP view sidebar, jadi tiap
   menu punya: daftar dokumen, tambah (nomor otomatis), ubah, hapus
   (arsip), alur status (draf → diperiksa → disetujui → final), riwayat,
   cetak tabel, cetak dokumen resmi, dan ekspor CSV.

   Dipanggil lazy: skema + data baru diminta saat panel berada di viewport,
   supaya view lama tetap ringan. Server: /api/newsroom/modul (lihat
   server/newsroom-modul.js). Kalau tabel belum dimigrasi, server balas 501
   dan panel menampilkan petunjuk migrasi — bukan diam-diam pakai localStorage.
   ============================================================ */
'use strict';

/* ---------- util ---------- */
const MD = { skema: {}, modul: null };
const mdEsc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mdRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const MD_COLOR = { draf: '#8ab4ff', diperiksa: '#f2c14e', disetujui: '#5eead4', final: '#2fd27a', arsip: '#6b7794', dibatalkan: '#ff5245' };
const mdTgl = (s) => s ? new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const mdPill = (t, c) => `<span style="display:inline-block;font-size:.64rem;font-weight:800;padding:.1rem .45rem;border-radius:999px;background:${c}22;color:${c};border:1px solid ${c}55;white-space:nowrap">${mdEsc(t)}</span>`;

(async function mdCss() {
  if (document.getElementById('mdCss')) return;
  const st = document.createElement('style');
  st.id = 'mdCss';
  st.textContent = `
  .md-panel{background:var(--panel,var(--card));border:1px solid var(--line);border-radius:12px;padding:.8rem .9rem;margin-bottom:1rem}
  .md-panel.md-pengantar{border-color:rgba(255,82,69,.28);background:linear-gradient(180deg,rgba(255,82,69,.055),transparent)}
  .md-head{display:flex;justify-content:space-between;gap:.6rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:.55rem}
  .md-head h3{font-size:.9rem;margin:0;color:#fff;display:flex;align-items:center;gap:.45rem}
  .md-head .md-note{font-size:.68rem;color:var(--muted);margin-top:.15rem;line-height:1.4;max-width:60ch}
  .md-bar{display:flex;gap:.35rem;flex-wrap:wrap;align-items:center;margin-bottom:.6rem}
  .md-bar input,.md-bar select{background:#0a1120;border:1px solid var(--line);border-radius:7px;padding:.33rem .5rem;color:#fff;font-size:.75rem;font-family:inherit}
  .md-btn{font-size:.72rem;font-weight:700;border:1px solid var(--line);background:rgba(255,255,255,.05);color:#dbe2f0;border-radius:7px;padding:.33rem .6rem;cursor:pointer;white-space:nowrap}
  .md-btn:hover:not(:disabled){border-color:rgba(255,82,69,.55);color:#fff}
  .md-btn.primary{background:linear-gradient(135deg,var(--red2),var(--red));border-color:transparent;color:#fff}
  .md-btn.go{color:#2fd27a;border-color:rgba(47,210,122,.35)}
  .md-btn.warn{color:#f2c14e;border-color:rgba(242,193,78,.35)}
  .md-btn.danger{color:#ff5245;border-color:rgba(255,82,69,.35)}
  .md-btn:disabled{opacity:.42;cursor:not-allowed}
  .md-btn.on{background:rgba(255,82,69,.16);border-color:rgba(255,82,69,.5);color:#fff}
  .md-tab{font-size:.7rem;padding:.24rem .5rem}
  /* tahap yang belum berisi dokumen: tetap bisa diklik, hanya diredupkan */
  .md-tab.kosong{opacity:.55}
  .md-tab.kosong::after{content:'·';margin-left:.28rem;opacity:.7}
  .md-tab.kosong:hover{opacity:.85}
  .md-tab.on.kosong{opacity:1}
  /* pilihan tahap awal pada formulir dokumen baru */
  .md-tahap-awal{display:inline-flex;align-items:center;gap:.35rem;font-size:.7rem;color:var(--muted);margin-right:auto}
  .md-tahap-awal select{background:#0a1020;border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:.25rem .4rem;font-size:.72rem}
  .md-table{width:100%;border-collapse:collapse;font-size:.76rem}
  .md-table th{text-align:left;color:var(--muted);font-weight:700;font-size:.64rem;text-transform:uppercase;letter-spacing:.05em;padding:.4rem .45rem;border-bottom:1px solid var(--line);white-space:nowrap}
  .md-table td{padding:.45rem;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}
  .md-table tr.on td{background:rgba(255,82,69,.08)}
  .md-table tr:hover td{background:rgba(255,255,255,.025)}
  .md-nomor{font-family:ui-monospace,Menlo,monospace;font-size:.7rem;color:#9fb0d0;white-space:nowrap}
  .md-judul{color:#fff;font-weight:600;cursor:pointer;line-height:1.35;max-width:360px;display:block}
  .md-judul:hover{color:var(--red2)}
  .md-kosong{color:var(--muted);font-size:.77rem;padding:.7rem 0;line-height:1.6}
  .md-info{background:rgba(255,82,69,.08);border:1px solid rgba(255,82,69,.3);border-radius:8px;padding:.5rem .6rem;font-size:.73rem;color:#ffd9d5;line-height:1.5;margin-bottom:.6rem}
  .md-aksi{display:flex;gap:.25rem;flex-wrap:wrap}
  .md-kaki{display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-top:.55rem;font-size:.7rem;color:var(--muted);flex-wrap:wrap}
  /* modal form */
  .md-form{max-height:64vh;overflow:auto;padding-right:.25rem}
  .md-f{margin-bottom:.55rem}
  .md-f label{display:block;font-size:.65rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:.2rem}
  .md-f label b{color:#ff5245}
  .md-f label b.md-wajib{color:#ff5245}
  .md-f input,.md-f select,.md-f textarea{width:100%;background:#0a1120;border:1px solid var(--line);border-radius:7px;padding:.42rem .55rem;color:#fff;font-size:.8rem;font-family:inherit}
  .md-f input:focus,.md-f select:focus,.md-f textarea:focus{outline:2px solid rgba(255,82,69,.45);outline-offset:1px}
  .md-f textarea{min-height:76px;resize:vertical;line-height:1.5}
  .md-f .md-bantu{font-size:.64rem;color:var(--muted);margin-top:.16rem;line-height:1.4}
  .md-f .md-acuan{font-size:.62rem;color:#f2c14e;margin-top:.16rem;line-height:1.4}
  .md-f.md-err input,.md-f.md-err select,.md-f.md-err textarea{border-color:#ff5245}
  .md-2{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}
  /* ===== 1.6.4 — mode LANDSCAPE untuk formulir panjang =====
     Formulir dokumen resmi (mis. Artikel: 49 kolom dalam 8 bagian) tidak nyaman
     diisi di kotak 460px. Saat tombol "Dokumen baru"/"Ubah" ditekan, modal diberi
     kelas .md-lebar: melebar sampai 1240px, isi dibagi 2–3 kolom, tiap bagian
     bisa dilipat, dan tombol simpan menempel di bawah supaya selalu terjangkau. */
  .modal.md-lebar{width:min(1240px,96vw);max-width:none;padding:0;overflow:hidden;
    display:flex;flex-direction:column;max-height:92vh}
  .modal.md-lebar > .md-lwa{display:flex;flex-direction:column;min-height:0;max-height:92vh}
  .md-lw-head{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;
    padding:.7rem 1rem;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--panel);z-index:2}
  .md-lw-head h3{margin:0;font-size:1rem;flex:1 1 auto;min-width:200px}
  .md-lw-aksi{display:flex;gap:.35rem;flex-wrap:wrap}
  .md-lw-note{padding:.45rem 1rem;font-size:.68rem;color:var(--muted);border-bottom:1px solid var(--line);line-height:1.45}
  .md-lebar .md-form{max-height:none;overflow:auto;padding:.85rem 1rem;flex:1 1 auto;min-height:0}
  .md-lebar .md-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem .8rem}
  .md-lebar .md-grid > .md-f[data-lebar="full"]{grid-column:1 / -1}
  .md-lebar .md-f textarea{min-height:120px}
  .md-lebar .md-f textarea[data-kunci="isi"],.md-lebar .md-f textarea[data-kunci="ringkasan"]{min-height:190px}
  .md-lw-kaki{position:sticky;bottom:0;display:flex;gap:.4rem;justify-content:flex-end;flex-wrap:wrap;
    padding:.6rem 1rem;border-top:1px solid var(--line);background:var(--panel);z-index:2}
  .md-lw-kaki .md-info-kecil{flex:1 1 auto;font-size:.66rem;color:var(--muted);align-self:center}
  /* bagian yang bisa dilipat */
  .md-bagian > legend{cursor:pointer;user-select:none}
  .md-bagian > legend::after{content:" ▾";font-size:.6rem;opacity:.6}
  .md-bagian.lipat > legend::after{content:" ▸"}
  .md-bagian.lipat > *:not(legend){display:none}
  /* penunjuk: X bagian belum diisi */
  .md-bagian > legend .md-lw-isi{font-weight:600;font-size:.6rem;color:var(--muted);
    text-transform:none;letter-spacing:0;margin-left:.35rem}
  .md-bagian.lipat > legend .md-lw-isi{color:#f2c14e}
  /* 2 kolom bila layar sedang, 1 kolom bila ponsel */
  @media(max-width:1080px){.md-lebar .md-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:720px){
    .modal.md-lebar{width:100%;max-height:96dvh;border-radius:14px 14px 0 0}
    .md-lebar .md-grid{grid-template-columns:1fr}
    .md-lebar .md-form{padding:.6rem .7rem}
  }
  .md-3{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem}
  @media(max-width:720px){.md-2,.md-3{grid-template-columns:1fr}}
  .md-bagian{border:1px solid var(--line);border-radius:11px;padding:.7rem .8rem .3rem;margin-bottom:.75rem;background:rgba(255,255,255,.017)}
  .md-bagian legend{font-size:.7rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--red2);padding:0 .4rem}
  .md-grid{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}
  .md-grid > .md-f[data-lebar="full"]{grid-column:1 / -1}
  @media(max-width:720px){.md-grid{grid-template-columns:1fr}}
  .md-cek{display:flex;gap:.45rem;align-items:flex-start;font-size:.76rem;color:#dbe2f0}
  .md-cek input{width:auto;margin-top:.15rem}
  .md-galat{background:rgba(255,82,69,.12);border:1px solid rgba(255,82,69,.45);border-radius:8px;padding:.45rem .55rem;font-size:.73rem;color:#ffd9d5;margin-bottom:.6rem;line-height:1.5}
  /* cetak */
  #mdCetak{display:none}
  @media print{
    body>*{display:none!important}
    #mdCetak{display:block!important;color:#000;background:#fff;font-family:"Times New Roman",Georgia,serif;font-size:11.5pt;padding:0}
    #mdCetak .kop{display:flex;gap:12px;align-items:center;border-bottom:3px double #000;padding-bottom:8px;margin-bottom:6px}
    #mdCetak .kop .logo{width:52px;height:52px;border:2px solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;letter-spacing:.5px}
    #mdCetak .kop h1{margin:0;font-size:15pt;letter-spacing:1px}
    #mdCetak .kop div{font-size:9pt;line-height:1.35}
    #mdCetak .subkop{text-align:center;font-size:8.5pt;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:14px;letter-spacing:.4px}
    #mdCetak h2.judul{text-align:center;text-decoration:underline;font-size:13pt;margin:6px 0 2px;letter-spacing:.5px}
    #mdCetak .nomor{text-align:center;font-size:10.5pt;margin-bottom:14px}
    #mdCetak table.isi{width:100%;border-collapse:collapse;font-size:10.5pt;margin-bottom:12px}
    #mdCetak table.isi th,#mdCetak table.isi td{border:1px solid #333;padding:5px 7px;vertical-align:top;text-align:left}
    #mdCetak table.isi th{background:#eee;width:34%;font-weight:700}
    #mdCetak table.daftar{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:8px}
    #mdCetak table.daftar th,#mdCetak table.daftar td{border:1px solid #444;padding:4px 6px;text-align:left}
    #mdCetak table.daftar th{background:#eee}
    #mdCetak .ttd{margin-top:26px;display:flex;justify-content:space-between;gap:20px;font-size:10.5pt}
    #mdCetak .ttd .kol{width:46%;text-align:center}
    #mdCetak .ttd .nama{margin-top:56px;font-weight:700;text-decoration:underline}
    #mdCetak .aturan{margin-top:18px;border-top:1px solid #000;padding-top:7px;font-size:8pt;line-height:1.45;color:#111}
    #mdCetak .aturan b{display:block;margin-bottom:3px}
    #mdCetak .kaki{margin-top:10px;font-size:7.5pt;color:#333;border-top:1px dotted #666;padding-top:4px}
    @page{size:A4;margin:15mm 16mm}
  }`;
  document.head.appendChild(st);
  if (!document.getElementById('mdCetak')) {
    const d = document.createElement('div');
    d.id = 'mdCetak';
    document.body.appendChild(d);
  }
})();

const mdApi = {
  async get(p) { return api.req('/api/newsroom' + p); },
  async post(p, b) { return api.req('/api/newsroom' + p, { method: 'POST', body: b || {} }); },
  async patch(p, b) { return api.req('/api/newsroom' + p, { method: 'PATCH', body: b || {} }); },
  async del(p) { return api.req('/api/newsroom' + p, { method: 'DELETE' }); }
};

/* keadaan per modul (dipisah supaya tiap menu ingat filter sendiri) */
const mdState = (id) => (MD[id] = MD[id] || { cari: '', status: '', page: 1, pilih: null, data: null, muat: false, galat: null });

/* ---------- render satu field ---------- */
function mdFieldHtml(f, v) {
  const id = 'mdF_' + f.kunci;
  const acuan = f.acuan ? `<div class="md-acuan">⚖ ${mdEsc(f.acuan)}</div>` : '';
  const bantu = f.bantuan ? `<div class="md-bantu">${mdEsc(f.bantuan)}</div>` : '';
  let inp;
  if (f.jenis === 'pilih') {
    inp = `<select id="${id}" data-kunci="${f.kunci}"><option value="">— pilih —</option>${(f.opsi || []).map(o => `<option value="${mdEsc(o.nilai)}"${String(v) === String(o.nilai) ? ' selected' : ''}>${mdEsc(o.label)}</option>`).join('')}</select>`;
  } else if (f.jenis === 'multi') {
    const arr = Array.isArray(v) ? v : (v ? String(v).split(',') : []);
    inp = `<div style="display:flex;flex-wrap:wrap;gap:.35rem .7rem;font-size:.76rem;color:#dbe2f0">${(f.opsi || []).map(o => `<label class="md-cek" style="font-weight:400"><input type="checkbox" data-kunci="${f.kunci}" value="${mdEsc(o.nilai)}"${arr.includes(o.nilai) ? ' checked' : ''}>${mdEsc(o.label)}</label>`).join('')}</div>`;
  } else if (f.jenis === 'centang') {
    inp = `<label class="md-cek"><input type="checkbox" id="${id}" data-kunci="${f.kunci}"${v ? ' checked' : ''}> <span>${mdEsc(f.label)}</span></label>`;
  } else if (f.jenis === 'textarea') {
    inp = `<textarea id="${id}" data-kunci="${f.kunci}" rows="4">${mdEsc(v || '')}</textarea>`;
  } else {
    const tipe = f.jenis === 'tanggal' ? 'date' : f.jenis === 'email' ? 'email' : (f.jenis === 'angka' || f.jenis === 'uang') ? 'number' : 'text';
    const step = (f.jenis === 'uang' && !f.bulat) ? ' step="0.01"' : (f.jenis === 'angka' ? ' step="0.01"' : '');
    const ph = f.jenis === 'npwp' ? ' placeholder="99.999.999.9-999.999"' : f.jenis === 'nib' ? ' placeholder="13 digit NIB"' : '';
    inp = `<input id="${id}" data-kunci="${f.kunci}" type="${tipe}"${step}${ph} value="${mdEsc(f.jenis === 'uang' || f.jenis === 'angka' ? (v == null ? '' : v) : (v || ''))}"${f.pola ? ' data-pola="' + mdEsc(f.pola) + '"' : ''}>`;
  }
  const bentuk = f.jenis === 'centang' ? '' : `<label for="${id}">${mdEsc(f.label)}${f.wajib ? ' <b class="md-wajib">*</b>' : ''}</label>`;
  return `<div class="md-f" data-f="${f.kunci}" data-lebar="${f.lebar === 'full' || f.jenis === 'textarea' ? 'full' : 'half'}">${bentuk}${inp}${bantu}${acuan}</div>`;
}

/* ---------- 1.6.4: mode LANDSCAPE untuk formulir panjang ---------- */
/* Modal standar hanya 460px. Formulir dokumen resmi butuh ruang: saat form
   dibuka, #modalBox diberi kelas .md-lebar (sampai 1240px, 3 kolom).
   Kelas dilepas saat modal ditutup, supaya modal lain tetap berukuran normal. */
function mdKotakModal() {
  const ov = document.getElementById('modalOverlay');
  return document.getElementById('modalBox') || (ov && ov.firstElementChild) || null;
}
function mdLebar(aktif) {
  const box = mdKotakModal();
  if (box) box.classList.toggle('md-lebar', !!aktif);
}
/* Penjaga sekali-pasang. Tiga jalur penutupan harus tetap melepas mode lebar:
   1) Esc  → tutup formulir (dan semua cara tutup lain tetap aman),
   2) klik latar overlay,
   3) apa pun yang memanggil closeModal() — dipantau lewat MutationObserver,
      sebab closeModal hanya menambah kelas .hidden pada overlay. */
(function mdLebarPasang() {
  if (typeof document === 'undefined' || window.__mdLebarPasang) return;
  window.__mdLebarPasang = true;

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !document.getElementById('mdForm')) return;
    e.stopPropagation();
    if (typeof closeModal === 'function') closeModal();
    mdLebar(false);
  }, true);

  document.addEventListener('click', (e) => {
    const ov = document.getElementById('modalOverlay');
    if (ov && e.target === ov) mdLebar(false);
  }, true);

  const pantau = () => {
    const ov = document.getElementById('modalOverlay');
    if (!ov || ov.__mdPantau) return;
    ov.__mdPantau = true;
    new MutationObserver(() => {
      if (ov.classList.contains('hidden')) mdLebar(false);
    }).observe(ov, { attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pantau);
  else pantau();
})();

/* beri tahu berapa kolom wajib yang sudah/belum terisi + tandai bagian yang kosong */
function mdHitungTerisi() {
  const form = document.getElementById('mdForm');
  if (!form) return;
  const isiDari = (f) => {
    const el = f.querySelector('[data-kunci]');
    if (!el) return false;
    if (el.type === 'checkbox') return el.checked;
    return String(el.value == null ? '' : el.value).trim() !== '';
  };
  const wajib = [...form.querySelectorAll('.md-f')].filter(f => f.querySelector('label b.md-wajib'));
  const terisi = wajib.filter(isiDari).length;
  const info = document.getElementById('mdLwHitung');
  if (info) {
    info.textContent = wajib.length
      ? `Kolom wajib terisi: ${terisi}/${wajib.length}`
      : 'Tidak ada kolom wajib di menu ini.';
    info.style.color = (wajib.length && terisi === wajib.length) ? '#2fd27a' : '';
  }
  form.querySelectorAll('.md-bagian').forEach(bag => {
    const w = [...bag.querySelectorAll('.md-f')].filter(f => f.querySelector('label b.md-wajib'));
    const kurang = w.filter(f => !isiDari(f)).length;
    let tag = bag.querySelector('.md-lw-isi');
    if (!tag) { tag = document.createElement('span'); tag.className = 'md-lw-isi'; const lg = bag.querySelector('legend'); if (lg) lg.appendChild(tag); }
    tag.textContent = kurang ? `· ${kurang} wajib belum diisi` : (w.length ? '· lengkap' : '');
  });
}

/* bagian formulir bisa dilipat supaya form 8 bagian tidak melelahkan di mata */
function mdPasangLipat() {
  const form = document.getElementById('mdForm');
  if (!form) return;
  form.querySelectorAll('.md-bagian > legend').forEach(lg => {
    lg.addEventListener('click', () => {
      const bag = lg.parentElement;
      bag.classList.toggle('lipat');
    });
  });
  form.addEventListener('input', mdHitungTerisi);
  form.addEventListener('change', mdHitungTerisi);
}

function mdFormHtml(skema, data) {
  const d = data || {};
  /* 1.6.3 — bila field punya 'bagian', form dirender bersection (judul + grid) */
  if ((skema.field || []).some(f => f.bagian)) {
    const peta = new Map();
    skema.field.forEach(f => {
      const b = f.bagian || 'Lainnya';
      if (!peta.has(b)) peta.set(b, []);
      peta.get(b).push(f);
    });
    return Array.from(peta.entries()).map(([judul, daftar]) => {
      const isiBagian = daftar.map(f => mdFieldHtml(f, d[f.kunci])).join('');
      return `<fieldset class="md-bagian"><legend>${mdEsc(judul)}</legend><div class="md-grid">${isiBagian}</div></fieldset>`;
    }).join('');
  }
  const kel = [];
  let buf = [];
  skema.field.forEach((f) => {
    const lebar = f.jenis === 'textarea' ? 'full' : f.lebar || 'half';
    if (lebar === 'full') {
      if (buf.length) { kel.push(`<div class="md-2">${buf.join('')}</div>`); buf = []; }
      kel.push(mdFieldHtml(f, d[f.kunci]));
    } else {
      buf.push(mdFieldHtml(f, d[f.kunci]));
      if (buf.length === 2) { kel.push(`<div class="md-2">${buf.join('')}</div>`); buf = []; }
    }
  });
  if (buf.length) kel.push(`<div class="md-2">${buf.join('')}</div>`);
  return kel.join('');
}

function mdBacaForm() {
  const out = {};
  document.querySelectorAll('#mdForm [data-kunci]').forEach((el) => {
    const k = el.dataset.kunci;
    if (el.type === 'checkbox' && el.closest('.md-cek') && el.parentElement.querySelector('span')) {
      out[k] = el.checked; return;
    }
    if (el.type === 'checkbox' && el.dataset.kunci && el.value && el.value !== 'on') {
      out[k] = out[k] || []; if (el.checked) out[k].push(el.value); return;
    }
    if (el.type === 'checkbox') { out[k] = el.checked; return; }
    out[k] = el.value;
  });
  return out;
}

/* ---------- cetak ---------- */
function mdCetakDokumen(r) {
  const d = r.dokumen, m = r.modul, p = r.perusahaan;
  const tgl = d.dibuat_at ? new Date(d.dibuat_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const isi = r.field.map(f => `<tr><th>${mdEsc(f.label)}</th><td${f.jenis === 'uang' ? ' style="text-align:right;font-variant-numeric:tabular-nums"' : ''}>${mdEsc(f.nilai)}</td></tr>`).join('');
  const aturan = (r.acuan || []).length
    ? `<div class="aturan"><b>Dasar hukum / standar yang dipenuhi dokumen ini:</b>${r.acuan.map(a => '• ' + mdEsc(a)).join('<br>')}</div>` : '';
  document.getElementById('mdCetak').innerHTML = `
    <div class="kop">
      <div class="logo">MBC</div>
      <div>
        <h1>${mdEsc(p.nama)}</h1>
        <div>${mdEsc(p.unit)} · ${mdEsc(p.alamat)}</div>
        <div>Dokumen internal resmi — ${mdEsc(m.judul)}</div>
      </div>
    </div>
    <div class="subkop">LEMBAGA PENYIARAN SWASTA · REKAMAN DOKUMEN ${mdEsc(String(m.kunci).toUpperCase())} · SISTEM NEWSROOM</div>
    <h2 class="judul">${mdEsc(m.judul.toUpperCase())}</h2>
    <div class="nomor">Nomor: ${mdEsc(d.nomor || '—')}</div>
    <table class="isi">${isi}</table>
    <div style="font-size:10pt;margin-bottom:6px">Status dokumen saat dicetak: <b>${mdEsc(d.status_label || d.status)}</b> · Dibuat oleh: <b>${mdEsc(d.dibuat_oleh || '—')}</b> · Tanggal: ${mdEsc(tgl)}</div>
    <div class="ttd">
      <div class="kol"><div>Dibuat oleh,</div><div class="nama">${mdEsc(d.dibuat_oleh || '—')}</div><div style="font-size:9pt">Pembuat dokumen</div></div>
      <div class="kol"><div>Disetujui oleh,</div><div class="nama">${mdEsc(d.disetujui_oleh || 'Pemimpin Redaksi / Direksi')}</div><div style="font-size:9pt">Pengesahan</div></div>
    </div>
    ${aturan}
    <div class="kaki">${mdEsc(p.catatan)} Dokumen dicetak ${new Date().toLocaleString('id-ID')} · ${mdEsc(m.kunci)}#${d.id} · ${mdEsc(d.nomor || '')}</div>`;
  const lama = document.title;
  document.title = `${d.nomor || m.judul} — ${d.judul || ''}`.slice(0, 90);
  window.print();
  document.title = lama;
}

function mdCetakTabel(modulId) {
  const st = mdState(modulId);
  const skema = st.skema;
  const baris = (st.data && st.data.dokumen) || [];
  if (!baris.length) return toast('Tidak ada dokumen untuk dicetak.');
  const kepala = skema.kolom.map(k => `<th>${mdEsc(k.label)}</th>`).join('');
  const isi = baris.map(b => '<tr>' + skema.kolom.map(k => {
    let v = k.kunci.split('.').reduce((o, p) => (o == null ? null : o[p]), b);
    if (k.kunci === 'data.jenis' || k.kunci === 'data.status') v = (skema.field.find(f => f.kunci === k.kunci.split('.')[1]) || {}).opsi?.find(o => o.nilai === v)?.label || v;
    if (k.kunci === 'status') v = MD_STATUS[v] || v;
    if (k.uang && v != null) v = mdRp(v);
    return `<td>${mdEsc(v == null || v === '' ? '—' : v)}</td>`;
  }).join('') + '</tr>').join('');
  document.getElementById('mdCetak').innerHTML = `
    <div class="kop"><div class="logo">MBC</div><div><h1>MBC INDONESIA GROUP</h1>
      <div>MBCINDONESIA.TV · Kediri, Jawa Timur</div><div>Daftar dokumen — ${mdEsc(skema.judul)}</div></div></div>
    <div class="subkop">DAFTAR DOKUMEN ${mdEsc(modulId.toUpperCase())} · DICETAK ${new Date().toLocaleString('id-ID')}${st.status ? ' · FILTER STATUS: ' + mdEsc(MD_STATUS[st.status] || st.status) : ''}</div>
    <table class="daftar"><thead><tr>${kepala}</tr></thead><tbody>${isi}</tbody></table>
    <div class="kaki">Total ${baris.length} dokumen ditampilkan dari ${st.data.total} rekaman. Sumber: PostgreSQL Newsroom MBC Indonesia.</div>`;
  window.print();
}

/* ---------- panel utama ---------- */
let MD_ALUR = { draf: ['diperiksa'], diperiksa: ['disetujui'], disetujui: ['final'], final: ['arsip'] };
let MD_STATUS = { draf: 'Draf' };
/* status puncak = butuh wewenang penyetuju; dipakai untuk mewarnai tombol */
const mdPuncak = (s) => ['tayang', 'final', 'menang', 'aktif', 'berlaku', 'diterbitkan', 'disetujui', 'selesai', 'dipakai', 'tampil'].includes(s);

function modulPanel(modulId) {
  const st = mdState(modulId);
  /* data-tabmilik="modul" menandai bahwa tombol tab ini milik panel modul.
     Tanpa penanda ini, handler klik milik view lain (mis. Master Data) yang
     dipasang pada elemen induk ikut menangkap klik tab dan menggambar ulang
     view-nya sendiri — akibatnya tab terlihat "tidak berfungsi". */
  return `<section class="md-panel" id="mdPanel" data-modul="${mdEsc(modulId)}" data-tabmilik="modul">
    <div class="md-head">
      <div>
        <h3><span id="mdJudul">🗂 Modul ${mdEsc(modulId)}</span><span id="mdJumlah" style="font-size:.68rem;font-weight:600;color:var(--muted)"></span></h3>
        <div class="md-note" id="mdNote">Memuat modul…</div>
      </div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap">
        <button class="md-btn primary" id="mdBaru" disabled>＋ Baru</button>
        <button class="md-btn" id="mdCetakTabel" disabled>🖨 Cetak daftar</button>
        <button class="md-btn" id="mdCsv" disabled>⬇ Ekspor CSV</button>
      </div>
    </div>
    <div id="mdIsi"><div class="md-kosong">Menyiapkan modul…</div></div>
  </section>`;
}

/* dipanggil view setelah innerHTML dipasang */
function modulPasang(root, modulId) {
  const p = root.querySelector('#mdPanel');
  if (!p || p.dataset.siap) return;
  p.dataset.siap = '1';
  const st = mdState(modulId);

  const muat = async (pertama) => {
    const isi = p.querySelector('#mdIsi');
    if (pertama) isi.innerHTML = '<div class="md-kosong">Memuat modul…</div>';
    try {
      let sk;
      const [hasilSkema, daftar] = await Promise.all([
        mdApi.get(`/modul/${modulId}/skema`),
        mdApi.get(`/modul/${modulId}?limit=25&page=${st.page}` + (st.cari ? `&cari=${encodeURIComponent(st.cari)}` : '') + (st.status ? `&status=${st.status}` : ''))
      ]);
      sk = hasilSkema;
      st.skema = sk.skema;
      st.alur = sk.alur || MD_ALUR;
      st.label = sk.status_label || MD_STATUS;
      MD_ALUR = st.alur; MD_STATUS = st.label;
      st.data = daftar; st.muat = true; st.galat = null;
    } catch (e) {
      st.muat = true; st.galat = e.message;
      isi.innerHTML = `<div class="md-info"><b>Modul belum aktif.</b><br>${mdEsc(e.message)}</div>
        <div class="md-kosong">Bila pesan di atas menyebut tabel belum ada, jalankan <code>docs/MIGRASI-1.6.2.sql</code> di Supabase SQL Editor. Setelah itu muat ulang halaman — form lengkap akan langsung tersedia untuk 19 modul.</div>`;
      return;
    }
    const skema = st.skema;
    const judulEl = p.querySelector('#mdJudul');
    if (judulEl) judulEl.textContent = '🗂 ' + (skema.judul || modulId);
    MD_ALUR = st.alur || MD_ALUR;
    MD_STATUS = st.label || MD_STATUS;
    p.querySelector('#mdNote').innerHTML = `${mdEsc(skema.deskripsi || '')} <span style="color:#8ab4ff">Prefiks nomor: <b>${mdEsc(skema.prefiks)}</b></span>
      <span style="color:var(--muted)"> · Alur menu ini: <b>${Object.keys(MD_ALUR).filter(x => x !== 'arsip').map(x => mdEsc(MD_STATUS[x] || x)).join(' → ')}</b></span>`;
    render();
  };

  const barisHtml = (b) => {
    const skema = st.skema;
    const sel = st.pilih === b.id;
    const tds = skema.kolom.map(k => {
      const kunci = k.kunci;
      let v = kunci.split('.').reduce((o, x) => (o == null ? null : o[x]), b);
      if (kunci === 'status') return `<td>${mdPill(MD_STATUS[v] || v, MD_COLOR[v] || '#8ab4ff')}</td>`;
      if (kunci === 'nomor') return `<td class="md-nomor">${mdEsc(v || '—')}</td>`;
      if (kunci === 'judul') return `<td><span class="md-judul" data-buka="${b.id}">${mdEsc(v || '—')}</span></td>`;
      if (kunci.startsWith('data.')) {
        const f = skema.field.find(x => x.kunci === kunci.slice(5));
        if (f && f.opsi) v = (f.opsi.find(o => o.nilai === v) || {}).label || v;
      }
      if (k.uang && v != null) return `<td style="text-align:right;font-variant-numeric:tabular-nums">${mdRp(v)}</td>`;
      return `<td>${mdEsc(v == null || v === '' ? '—' : v)}</td>`;
    }).join('');
    return `<tr class="${sel ? 'on' : ''}" data-id="${b.id}">${tds}</tr>`;
  };

  /* keterangan saat tabel kosong — dibedakan antara "belum ada dokumen sama
     sekali" dan "tahap ini memang belum berisi". Tanpa pembedaan ini, tab yang
     kosong terasa seperti tombol yang tidak bekerja. */
  const mdKosongHtml = (skema, state) => {
    const tahap = state.status ? (MD_STATUS[state.status] || state.status) : '';
    const cari = state.cari ? ` untuk pencarian “${mdEsc(state.cari)}”` : '';
    if (tahap) {
      return `<div class="md-kosong"><b>Belum ada dokumen pada tahap “${mdEsc(tahap)}”${cari}.</b><br>
        Dokumen berpindah ke tahap ini lewat tombol <b>Ubah status</b> di detail dokumen.
        ${state.status === Object.keys(MD_ALUR)[0] ? '<br>Ingin langsung mencatat agenda di tahap ini? Klik <b>＋ Dokumen baru</b>.' : ''}
        <br><button class="md-btn" id="mdLihatSemua" type="button">Lihat semua dokumen</button></div>`;
    }
    return `<div class="md-kosong">Belum ada dokumen di modul ini${cari}. Klik <b>＋ Dokumen baru</b> — nomor urut dibuat otomatis dengan prefiks <b>${mdEsc(skema.prefiks)}</b>.</div>`;
  };

  const render = () => {
    const d = st.data || { dokumen: [], total: 0, status: {} };
    const skema = st.skema;
    if (st.alur) MD_ALUR = st.alur;
    if (st.label) MD_STATUS = st.label;
    const jumlah = d.total;
    /* urutan tab = urutan siklus menu ini; status akhir (arsip) ditaruh paling kanan.
       Tab yang jumlahnya 0 diberi kelas .kosong (redup) supaya jelas "memang belum
       ada isinya", bukan tombol rusak. Tab tetap bisa diklik: setelah itu tabel
       menampilkan keterangan kosong yang sesuai tahapnya. */
    const urut = Object.keys(MD_ALUR).filter(x => x !== 'arsip');
    const tab = ['', ...urut, 'arsip'].map(t => {
      const n = t ? (d.status?.[t] || 0) : jumlah;
      const lab = t ? (MD_STATUS[t] || t) : 'Semua';
      const kunciTab = t === 'arsip' ? 'arsip' : t;
      const kelasKosong = (t && !n) ? ' kosong' : '';
      return `<button class="md-btn md-tab${kelasKosong} ${st.status === kunciTab ? 'on' : ''}" data-tab="${kunciTab}" title="${t ? `Tahap ${mdEsc(lab)}${n ? ' · ' + n + ' dokumen' : ' · belum ada dokumen'}` : 'Semua tahap'}">${mdEsc(lab)}${n ? ' ' + n : ''}</button>`;
    }).join('');
    const halaman = Math.max(1, Math.ceil(jumlah / 25));
    p.querySelector('#mdIsi').innerHTML = `
      <div class="md-bar">${tab}</div>
      <div class="md-bar">
        <input id="mdCari" placeholder="Cari uraian atau nomor…" value="${mdEsc(st.cari)}" style="flex:1;min-width:150px">
        <button class="md-btn primary" id="mdBaru2">＋ Dokumen baru</button>
        <button class="md-btn" id="mdMuat">↻ Muat ulang</button>
      </div>
      ${d.dokumen.length ? `<div style="overflow:auto"><table class="md-table"><thead><tr>${skema.kolom.map(k => `<th style="width:${k.lebar || 'auto'}">${mdEsc(k.label)}</th>`).join('')}<th></th></tr></thead>
        <tbody>${d.dokumen.map(b => barisHtml(b)).join('')}</tbody></table></div>` : mdKosongHtml(skema, st)}
      <div class="md-kaki"><span>Menampilkan ${d.dokumen.length} dari ${jumlah} rekaman · halaman ${st.page}/${halaman}</span>
        <span style="display:flex;gap:.3rem"><button class="md-btn" id="mdPrev" ${st.page <= 1 ? 'disabled' : ''}>‹ Sebelumnya</button><button class="md-btn" id="mdNext" ${st.page >= halaman ? 'disabled' : ''}>Berikutnya ›</button></span></div>
      <div id="mdDetail"></div>`;
    p.querySelector('#mdJumlah').textContent = jumlah ? `· ${jumlah} rekaman` : '';
    /* 1.6.4 — dulu tombol "＋ Baru" di kepala panel dibiarkan disabled selamanya
       (hanya tombol ＋ Dokumen baru di dalam tabel yang hidup), sehingga terasa
       sebagai tombol mati. Sekarang diaktifkan begitu skema modul berhasil dimuat. */
    const tombolBaru = p.querySelector('#mdBaru');
    if (tombolBaru) tombolBaru.disabled = false;
    p.querySelector('#mdCetakTabel').disabled = !d.dokumen.length;
    p.querySelector('#mdCsv').disabled = !d.dokumen.length;
    p.querySelector('#mdCari').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      st.cari = e.target.value.trim(); st.page = 1; muat();
    });
    /* Tab status: ditangani di fase CAPTURE dan propagasinya dihentikan.
       Dulu klik tab juga sampai ke handler klik milik view lain (Master Data)
       yang terpasang pada elemen induk, sehingga view berganti dan tab tampak
       "tidak berfungsi". Dengan capture + stopPropagation, hanya modul ini
       yang bereaksi. */
    p.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (b.dataset.tab === st.status) return;      /* tab yang sama: tidak perlu muat ulang */
      st.status = b.dataset.tab; st.page = 1; muat();
    }, true));
    p.querySelectorAll('[data-buka]').forEach(el => el.addEventListener('click', () => mdDetail(Number(el.dataset.buka))));
    p.querySelectorAll('#mdPrev,#mdNext').forEach(b => b.addEventListener('click', () => {
      st.page += b.id === 'mdNext' ? 1 : -1; muat();
    }));
    p.querySelectorAll('#mdBaru,#mdBaru2').forEach(b => b.addEventListener('click', () => mdForm(null)));
    const lihatSemua = p.querySelector('#mdLihatSemua');
    if (lihatSemua) lihatSemua.addEventListener('click', () => { st.status = ''; st.page = 1; muat(); });
    p.querySelector('#mdMuat').addEventListener('click', () => muat());
    p.querySelector('#mdCari').addEventListener('change', (e) => { st.cari = e.target.value.trim(); st.page = 1; muat(); });
    p.querySelector('#mdCetakTabel').addEventListener('click', () => mdCetakTabel(modulId));
    p.querySelector('#mdCsv').addEventListener('click', () => mdCsv(modulId));
    if (st.pilih) mdDetail(st.pilih, true);
  };

  /* formulir tambah/ubah di modal — 1.6.4: mode LANDSCAPE (melebar) */
  /* Pilihan "tahap saat dokumen dibuat". Tanpa ini, semua dokumen baru selalu
     masuk tahap pertama (Rencana/Draf/Ide) sehingga tab tahap berikutnya selalu
     kosong dan terasa "tidak berfungsi". Pemindahan tahap berikutnya tetap wajib
     lewat tombol Ubah status, jadi alur persetujuan tidak dilangkahi. */
  const mdPilihTahap = (rekam) => {
    if (rekam) return '';
    const awal = Object.keys(MD_ALUR)[0];
    const isi = Object.keys(MD_ALUR).map(k => `<option value="${mdEsc(k)}"${k === awal ? ' selected' : ''}>${mdEsc(MD_STATUS[k] || k)}</option>`).join('');
    return `<label class="md-tahap-awal" title="Tahap dokumen saat disimpan">Tahap awal
      <select id="mdTahapAwal">${isi}</select></label>`;
  };

  const mdForm = async (rekam) => {
    const skema = st.skema;
    const data = rekam ? rekam.data : {};
    mdLebar(true);
    openModal(`<div class="md-lwa">
      <div class="md-lw-head">
        <h3>${rekam ? 'Ubah' : 'Dokumen baru'} — ${mdEsc(skema.judul)}</h3>
        <span class="md-lw-aksi">
          <button class="md-btn" id="mdLipatSemua" type="button" title="Lipat/buka semua bagian">⤢ Lipat semua</button>
          <button class="md-btn" id="mdTutupX" type="button" title="Tutup (Esc)">✕</button>
        </span>
      </div>
      <div class="md-lw-note">Nomor urut otomatis (${mdEsc(skema.prefiks)}) · kolom bertanda <b style="color:#ff5245">*</b> wajib ·
        ⚖ = dasar hukum kolom · <b>Esc</b> menutup · bagian bisa dilipat dengan mengeklik judulnya.</div>
      <div id="mdGalat" style="padding:0 1rem"></div>
      <form id="mdForm" class="md-form" onsubmit="return false">${mdFormHtml(skema, data)}</form>
      <div class="md-lw-kaki">
        <span class="md-info-kecil" id="mdLwHitung"></span>
        ${mdPilihTahap(rekam)}
        <button class="md-btn" id="mdBatal" type="button">Batal</button>
        <button class="md-btn primary" id="mdSimpan" type="button">${rekam ? 'Simpan perubahan' : 'Simpan sebagai draf'}</button>
      </div>
    </div>`);
    mdPasangLipat();
    mdHitungTerisi();
    document.getElementById('mdTutupX').addEventListener('click', closeModal);
    document.getElementById('mdLipatSemua').addEventListener('click', (ev) => {
      const bag = [...document.querySelectorAll('#mdForm .md-bagian')];
      const adaLipat = bag.some(b => b.classList.contains('lipat'));
      bag.forEach(b => b.classList.toggle('lipat', !adaLipat));
      ev.currentTarget.textContent = adaLipat ? '⤢ Lipat semua' : '⤡ Buka semua';
    });
    document.getElementById('mdBatal').addEventListener('click', closeModal);
    document.getElementById('mdSimpan').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const isi = mdBacaForm();
      document.querySelectorAll('#mdForm .md-f').forEach(el => el.classList.remove('md-err'));
      btn.disabled = true; btn.textContent = 'Menyimpan…';
      try {
        if (rekam) {
          await mdApi.patch(`/modul/${modulId}/${rekam.id}`, isi);
          toast('Perubahan tersimpan.');
        } else {
          const pilih = document.getElementById('mdTahapAwal');
          const isiAwal = pilih ? Object.assign({}, isi, { status_awal: pilih.value }) : isi;
          const out = await mdApi.post(`/modul/${modulId}`, isiAwal);
          toast('Dokumen dibuat: ' + out.dokumen.nomor);
        }
        closeModal(); mdLebar(false);
        st.page = 1; st.pilih = null;
        await muat();
        audit(`Modul ${modulId}: ${rekam ? 'ubah' : 'dokumen baru'} oleh ${(session() || {}).name || 'operator'}`);
      } catch (e) {
        const g = document.getElementById('mdGalat');
        if (g) g.innerHTML = `<div class="md-galat">${mdEsc(e.message)}</div>`;
        btn.disabled = false; btn.textContent = rekam ? 'Simpan perubahan' : 'Simpan sebagai draf';
      }
    });
  };

  /* detail + aksi satu dokumen */
  const mdDetail = async (id, diam) => {
    st.pilih = id;
    p.querySelectorAll('.md-table tr').forEach(tr => tr.classList.toggle('on', Number(tr.dataset.id) === id));
    const wadah = p.querySelector('#mdDetail');
    if (!wadah) return;
    wadah.innerHTML = '<div class="md-kosong">Memuat dokumen…</div>';
    let r;
    try { r = await mdApi.get(`/modul/${modulId}/${id}`); }
    catch (e) { wadah.innerHTML = `<div class="md-info">${mdEsc(e.message)}</div>`; return; }
    const d = r.dokumen, skema = st.skema;
    if (st.alur) MD_ALUR = st.alur;
    if (st.label) MD_STATUS = st.label;
    const lanjut = (MD_ALUR[d.status] || []);
    const nilai = skema.field.filter(f => d.data[f.kunci] !== undefined && d.data[f.kunci] !== null && d.data[f.kunci] !== '').map(f => {
      let v = d.data[f.kunci];
      if (f.opsi) v = Array.isArray(v) ? v.map(x => (f.opsi.find(o => o.nilai === x) || {}).label || x).join(', ') : (f.opsi.find(o => o.nilai === v) || {}).label || v;
      if (f.jenis === 'centang') v = v ? 'Ya' : 'Tidak';
      if (f.jenis === 'uang') v = mdRp(v);
      return `<tr><td style="color:var(--muted);width:34%;font-size:.72rem">${mdEsc(f.label)}</td><td style="font-weight:600;color:#e8eefb">${mdEsc(v)}</td></tr>`;
    }).join('');
    const acuan = [...new Set(skema.field.map(f => f.acuan).filter(Boolean))];
    wadah.innerHTML = `
      <div class="md-panel" style="background:rgba(255,255,255,.03);margin-top:.7rem">
        <div class="md-head" style="margin-bottom:.4rem">
          <div><h3 style="font-size:.85rem">${mdEsc(d.judul || '—')}</h3>
            <div class="md-note"><span class="md-nomor">${mdEsc(d.nomor || '')}</span> · ${mdPill(MD_STATUS[d.status] || d.status, MD_COLOR[d.status] || '#8ab4ff')} · dibuat ${mdEsc(d.dibuat_oleh || '—')}, ${mdTgl(d.dibuat_at)}</div></div>
          <div class="md-aksi">
            <button class="md-btn" data-act="ubah" ${['final', 'arsip'].includes(d.status) ? 'disabled' : ''}>✎ Ubah</button>
            ${lanjut.map(s => `<button class="md-btn ${mdPuncak(s) ? 'go' : (s === 'dibatalkan' || s === 'tarik' || s === 'batal' || s === 'ditolak' || s === 'kalah') ? 'danger' : 'warn'}" data-status="${s}">→ ${mdEsc(MD_STATUS[s] || s)}</button>`).join('')}
            <button class="md-btn" data-act="riwayat">🕘 Riwayat</button>
            <button class="md-btn" data-act="cetak">🖨 Cetak dokumen</button>
            <button class="md-btn danger" data-act="hapus">🗑 Arsipkan</button>
          </div>
        </div>
        <div style="overflow:auto"><table class="md-table"><tbody>${nilai || '<tr><td class="md-kosong">Belum ada isian.</td></tr>'}</tbody></table></div>
        ${acuan.length ? `<div class="md-note" style="margin-top:.5rem;border-top:1px solid var(--line);padding-top:.45rem"><b style="color:#f2c14e">Dasar hukum terpenuhi:</b> ${acuan.map(a => mdEsc(a)).join(' · ')}</div>` : ''}
        <div id="mdSub"></div>
      </div>`;
    wadah.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', async () => {
      const tujuan = b.dataset.status;
      b.disabled = true;
      try {
        const out = await mdApi.post(`/modul/${modulId}/${d.id}/status`, { status: tujuan });
        toast('Status: ' + (out.status_label || tujuan));
        await muat(); mdDetail(d.id, true);
      } catch (e) { toast(e.message); b.disabled = false; }
    }));
    wadah.querySelector('[data-act="ubah"]').addEventListener('click', () => mdForm(d));
    wadah.querySelector('[data-act="cetak"]').addEventListener('click', async (ev) => {
      try { mdCetakDokumen(await mdApi.get(`/modul/${modulId}/${d.id}/cetak`)); }
      catch (e) { toast(e.message); }
    });
    wadah.querySelector('[data-act="hapus"]').addEventListener('click', async () => {
      if (!confirm(`Arsipkan dokumen ${d.nomor}? Dokumen tidak dihapus permanen (masa simpan 10 tahun, UU KUP Pasal 28).`)) return;
      try { const out = await mdApi.del(`/modul/${modulId}/${d.id}`); toast(out.catatan || 'Diarsipkan.'); st.pilih = null; await muat(); }
      catch (e) { toast(e.message); }
    });
    wadah.querySelector('[data-act="riwayat"]').addEventListener('click', async () => {
      const sub = wadah.querySelector('#mdSub');
      sub.innerHTML = '<div class="md-kosong">Memuat riwayat…</div>';
      try {
        const rr = await mdApi.get(`/modul/${modulId}/${d.id}/riwayat`);
        sub.innerHTML = `<div class="md-note" style="margin-top:.5rem"><b style="color:#fff">Jejak dokumen</b></div>
          <table class="md-table"><tbody>${(rr.riwayat || []).map(x => `<tr><td style="width:22%">${mdEsc(x.aksi)}</td><td>${x.status_lama || x.status_baru ? mdEsc((MD_STATUS[x.status_lama] || x.status_lama || '—') + ' → ' + (MD_STATUS[x.status_baru] || x.status_baru || '—')) : ''}</td><td>${mdEsc(x.oleh || '—')}</td><td style="white-space:nowrap">${mdTgl(x.at)}</td></tr>`).join('') || '<tr><td colspan="4" class="md-kosong">Belum ada jejak.</td></tr>'}</tbody></table>`;
      } catch (e) { sub.innerHTML = `<div class="md-info">${mdEsc(e.message)}</div>`; }
    });
    if (diam && wadah.scrollIntoView) { try { wadah.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {} }
  };

  const mdCsv = async (mid) => {
    const d = st.data;
    if (!d || !d.dokumen.length) return;
    const skema = st.skema;
    const kol = ['id', 'nomor', 'judul', 'status', ...skema.field.map(f => f.kunci), 'dibuat_oleh', 'dibuat_at'];
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const isi = d.dokumen.map(b => [b.id, b.nomor, b.judul, b.status, ...skema.field.map(f => {
      const v = b.data[f.kunci];
      return Array.isArray(v) ? v.join('; ') : v;
    }), b.dibuat_oleh, b.dibuat_at].map(q).join(';'));
    const csv = '\ufeff' + kol.map(q).join(';') + '\n' + isi.join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `modul-${mid}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    toast('CSV diekspor (pemisah titik koma, siap Excel Indonesia).');
  };

  muat(true);
}

/* pasang otomatis: setiap view memanggil ini setelah root.innerHTML selesai */
function modulTanam(root, modulId) {
  const blok = document.createElement('div');
  blok.innerHTML = modulPanel(modulId);
  /* 1.6.4 — panel modul ditaruh di BAWAH isi menu, bukan di atas.
     Dulu ia disisipkan di paling atas dan memakai lebar penuh, sehingga
     isi menu yang sebenarnya (kalender 7 hari, KPI, papan kanban) terdorong
     jauh ke bawah dan tampak "hilang / tidak muncul". Menaruhnya di bawah
     membuat halaman menu tampil normal, lalu modul dokumen jadi bagian
     kerjanya di bawahnya. */
  root.appendChild(blok.firstElementChild);
  modulPasang(root, modulId);
}

/* ============================================================
   1.6.4 — VIEW EDITORIAL BARU: Dewan Redaksi & Tajuk/Opini
   ------------------------------------------------------------
   Keduanya memakai mesin modul yang sama (daftar, form, alur status,
   cetak, CSV) tetapi diberi pengantar singkat yang menjelaskan ATURAN
   jurnalistiknya, supaya staf tidak salah memperlakukan tajuk
   seperti berita biasa.
   ============================================================ */
function mdViewEditorial(root, modulId, kepala) {
  root.innerHTML = `<div class="md-panel md-pengantar">${kepala}</div>`;
  modulTanam(root, modulId);
}

function viewModulDewan(root) {
  mdViewEditorial(root, 'dewan', `
    <div class="md-head"><h3>🪑 Dewan Redaksi</h3></div>
    <div class="md-head" style="display:block">
      <div class="md-note" style="max-width:80ch">
        Ruang keputusan redaksi: <b>rapat harian</b>, <b>usulan topik</b>, <b>penugasan liputan</b>,
        <b>evaluasi terbitan</b>, dan <b>sikap redaksi</b> atas suatu isu.
        Satu dokumen = satu rapat/keputusan, dengan nomor <b>DWR</b>.
        Tahap: <b>Usulan → Dibahas → Diputuskan → Berlaku</b>. Tahap "Berlaku" hanya bisa
        dipasang oleh <b>pemred/direksi</b> — catatan rapat yang berlaku adalah dokumen resmi.
        Bila rapat menghasilkan tajuk, tulis nomor tajuknya di kolom <i>Nomor tajuk terkait</i>.
      </div>
    </div>`);
}

function viewModulTajuk(root) {
  mdViewEditorial(root, 'tajuk', `
    <div class="md-head"><h3>🖋 Tajuk &amp; Opini</h3></div>
    <div class="md-head" style="display:block">
      <div class="md-note" style="max-width:80ch">
        Naskah <b>sikap resmi lembaga</b> — berbeda tegas dari berita.
        Tajuk <b>tidak ditandatangani</b> (tulis "Redaksi"), wajib berasal dari <b>rapat dewan redaksi</b>
        (isi nomor <b>DWR</b>-nya), dan baru boleh terbit setelah <b>disetujui pemred</b>.
        Opini/kolom adalah pandangan <b>penulis</b>, bukan sikap redaksi — karena itu kolom
        <i>Label yang tampil ke pembaca</i> wajib dipilih.
        Tahap: <b>Ide → Dibahas dewan → Penulisan → Review pemred → Siap terbit → Tayang</b>.
      </div>
      <div class="md-info" style="margin-top:.5rem;max-width:80ch">
        ⚖ <b>Catatan hukum:</b> tajuk adalah sikap lembaga, sehingga tanggung jawabnya ada pada
        pemimpin redaksi (UU 40/1999 Pers Pasal 12). Siapkan <b>hak jawab</b> bagi pihak yang
        disebut sebelum naskah naik ke "Siap terbit".
      </div>
    </div>`);
}
