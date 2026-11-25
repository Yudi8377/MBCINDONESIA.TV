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
  .md-f input,.md-f select,.md-f textarea{width:100%;background:#0a1120;border:1px solid var(--line);border-radius:7px;padding:.42rem .55rem;color:#fff;font-size:.8rem;font-family:inherit}
  .md-f input:focus,.md-f select:focus,.md-f textarea:focus{outline:2px solid rgba(255,82,69,.45);outline-offset:1px}
  .md-f textarea{min-height:76px;resize:vertical;line-height:1.5}
  .md-f .md-bantu{font-size:.64rem;color:var(--muted);margin-top:.16rem;line-height:1.4}
  .md-f .md-acuan{font-size:.62rem;color:#f2c14e;margin-top:.16rem;line-height:1.4}
  .md-f.md-err input,.md-f.md-err select,.md-f.md-err textarea{border-color:#ff5245}
  .md-2{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}
  .md-3{display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem}
  @media(max-width:720px){.md-2,.md-3{grid-template-columns:1fr}}
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
  const bentuk = f.jenis === 'centang' ? '' : `<label for="${id}">${mdEsc(f.label)}${f.wajib ? ' <b>*</b>' : ''}</label>`;
  return `<div class="md-f" data-f="${f.kunci}">${bentuk}${inp}${bantu}${acuan}</div>`;
}

function mdFormHtml(skema, data) {
  const d = data || {};
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
let MD_STATUS = { draf: 'Draf' };
let MD_ALUR = { draf: ['diperiksa'], diperiksa: ['disetujui'], disetujui: ['final'], final: ['arsip'] };

function modulPanel(modulId) {
  const st = mdState(modulId);
  return `<section class="md-panel" id="mdPanel" data-modul="${mdEsc(modulId)}">
    <div class="md-head">
      <div>
        <h3><span>🗂 Modul ${mdEsc(modulId)}</span><span id="mdJumlah" style="font-size:.68rem;font-weight:600;color:var(--muted)"></span></h3>
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
      const [sk, daftar] = await Promise.all([
        st.skema ? Promise.resolve({ skema: st.skema, alur: MD_ALUR, status_label: MD_STATUS }) : mdApi.get(`/modul/${modulId}/skema`),
        mdApi.get(`/modul/${modulId}?limit=25&page=${st.page}` + (st.cari ? `&cari=${encodeURIComponent(st.cari)}` : '') + (st.status ? `&status=${st.status}` : ''))
      ]);
      st.skema = sk.skema; MD_ALUR = sk.alur || MD_ALUR; MD_STATUS = sk.status_label || MD_STATUS;
      st.data = daftar; st.muat = true; st.galat = null;
    } catch (e) {
      st.muat = true; st.galat = e.message;
      isi.innerHTML = `<div class="md-info"><b>Modul belum aktif.</b><br>${mdEsc(e.message)}</div>
        <div class="md-kosong">Bila pesan di atas menyebut tabel belum ada, jalankan <code>docs/MIGRASI-1.6.2.sql</code> di Supabase SQL Editor. Setelah itu muat ulang halaman — form lengkap akan langsung tersedia untuk 19 modul.</div>`;
      return;
    }
    const skema = st.skema;
    p.querySelector('#mdNote').innerHTML = `${mdEsc(skema.deskripsi || '')} <span style="color:#8ab4ff">Prefiks nomor: <b>${mdEsc(skema.prefiks)}</b></span>`;
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

  const render = () => {
    const d = st.data || { dokumen: [], total: 0, status: {} };
    const skema = st.skema;
    const jumlah = d.total;
    const tab = ['', ...Object.keys(MD_ALUR)].map(t => {
      const n = t ? (d.status?.[t] || 0) : jumlah;
      const lab = t ? (MD_STATUS[t] || t) : 'Semua';
      return `<button class="md-btn md-tab ${st.status === t ? 'on' : ''}" data-tab="${t}">${mdEsc(lab)}${n ? ' ' + n : ''}</button>`;
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
        <tbody>${d.dokumen.map(b => barisHtml(b)).join('')}</tbody></table></div>` : `<div class="md-kosong">Belum ada dokumen di modul ini. Klik <b>＋ Dokumen baru</b> — nomor urut dibuat otomatis dengan prefiks <b>${mdEsc(skema.prefiks)}</b>.</div>`}
      <div class="md-kaki"><span>Menampilkan ${d.dokumen.length} dari ${jumlah} rekaman · halaman ${st.page}/${halaman}</span>
        <span style="display:flex;gap:.3rem"><button class="md-btn" id="mdPrev" ${st.page <= 1 ? 'disabled' : ''}>‹ Sebelumnya</button><button class="md-btn" id="mdNext" ${st.page >= halaman ? 'disabled' : ''}>Berikutnya ›</button></span></div>
      <div id="mdDetail"></div>`;
    p.querySelector('#mdJumlah').textContent = jumlah ? `· ${jumlah} rekaman` : '';
    p.querySelector('#mdCetakTabel').disabled = !d.dokumen.length;
    p.querySelector('#mdCsv').disabled = !d.dokumen.length;
    p.querySelector('#mdCari').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      st.cari = e.target.value.trim(); st.page = 1; muat();
    });
    p.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
      st.status = b.dataset.tab; st.page = 1; muat();
    }));
    p.querySelectorAll('[data-buka]').forEach(el => el.addEventListener('click', () => mdDetail(Number(el.dataset.buka))));
    p.querySelectorAll('#mdPrev,#mdNext').forEach(b => b.addEventListener('click', () => {
      st.page += b.id === 'mdNext' ? 1 : -1; muat();
    }));
    p.querySelectorAll('#mdBaru,#mdBaru2').forEach(b => b.addEventListener('click', () => mdForm(null)));
    p.querySelector('#mdMuat').addEventListener('click', () => muat());
    p.querySelector('#mdCari').addEventListener('change', (e) => { st.cari = e.target.value.trim(); st.page = 1; muat(); });
    p.querySelector('#mdCetakTabel').addEventListener('click', () => mdCetakTabel(modulId));
    p.querySelector('#mdCsv').addEventListener('click', () => mdCsv(modulId));
    if (st.pilih) mdDetail(st.pilih, true);
  };

  /* formulir tambah/ubah di modal */
  const mdForm = async (rekam) => {
    const skema = st.skema;
    const data = rekam ? rekam.data : {};
    openModal(`<h3 style="margin-bottom:.2rem">${rekam ? 'Ubah' : 'Baru'} — ${mdEsc(skema.judul)}</h3>
      <div class="md-note" style="margin-bottom:.6rem">Nomor urut otomatis (${mdEsc(skema.prefiks)}). Kolom bertanda <b style="color:#ff5245">*</b> wajib. Baris ⚖ = dasar hukum field tersebut.</div>
      <div id="mdGalat"></div>
      <form id="mdForm" class="md-form" onsubmit="return false">${mdFormHtml(skema, data)}</form>
      <div style="display:flex;gap:.4rem;justify-content:flex-end;margin-top:.7rem;flex-wrap:wrap">
        <button class="md-btn" id="mdBatal">Batal</button>
        <button class="md-btn primary" id="mdSimpan">${rekam ? 'Simpan perubahan' : 'Simpan sebagai draf'}</button>
      </div>`);
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
          const out = await mdApi.post(`/modul/${modulId}`, isi);
          toast('Dokumen dibuat: ' + out.dokumen.nomor);
        }
        closeModal();
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
            ${lanjut.map(s => `<button class="md-btn ${['disetujui', 'final'].includes(s) ? 'go' : s === 'dibatalkan' ? 'danger' : 'warn'}" data-status="${s}">→ ${mdEsc(MD_STATUS[s] || s)}</button>`).join('')}
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
  root.insertBefore(blok.firstElementChild, root.firstChild);
  modulPasang(root, modulId);
}
