/* ============================================================
   cms.js — Modul Newsroom: CMS Editorial, Meja Redaksi,
   Multi-Agent AI Studio, Media Library, Moderasi, Analitik.
   Dipakai oleh newsroom/index.html (memakai util global: api, $, esc,
   toast, audit, session, openModal, closeModal, fmtRp).
   ============================================================ */
'use strict';

/* ---------- util lokal ---------- */
const NR = {
  cache: {},
  async get(path) { return api.req('/api/newsroom' + path); },
  async post(path, body) { return api.req('/api/newsroom' + path, { method: 'POST', body: body || {} }); },
  async patch(path, body) { return api.req('/api/newsroom' + path, { method: 'PATCH', body: body || {} }); },
  async del(path) { return api.req('/api/newsroom' + path, { method: 'DELETE' }); }
};

const STATUS_LABEL = {
  ide: 'Ide', draft: 'Draf', review: 'Review Redaktur', fakta: 'Verifikasi Fakta',
  hukum: 'Tinjauan Hukum', siap: 'Siap Terbit', terjadwal: 'Terjadwal', tayang: 'Tayang',
  arsip: 'Arsip', ditarik: 'Ditarik'
};
const STATUS_COLOR = {
  ide: '#94a0b8', draft: '#8ab4ff', review: '#f2c14e', fakta: '#5eead4', hukum: '#ffb86c',
  siap: '#2fd27a', terjadwal: '#c792ea', tayang: '#2fd27a', arsip: '#6b7794', ditarik: '#ff5245'
};
const SEV_COLOR = { kritis: '#ff5245', peringatan: '#f2c14e', saran: '#8ab4ff', info: '#94a0b8' };
const pill = (text, color) => `<span style="display:inline-block;font-size:.66rem;font-weight:700;padding:.1rem .5rem;border-radius:999px;background:${color}22;color:${color};border:1px solid ${color}55">${esc(text)}</span>`;
const dt = s => s ? new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/* tarik CSS khusus CMS sekali */
(function injectCss() {
  if (document.getElementById('cmsCss')) return;
  const st = document.createElement('style');
  st.id = 'cmsCss';
  st.textContent = `
  .cms-bar{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-bottom:.8rem}
  .cms-bar input,.cms-bar select{background:#0a1120;border:1px solid var(--line);border-radius:8px;padding:.42rem .6rem;color:#fff;font-size:.8rem;font-family:inherit}
  .cms-bar input:focus,.cms-bar select:focus{outline:2px solid rgba(255,82,69,.45);outline-offset:1px}
  .cms-btn{font-size:.76rem;font-weight:700;border:1px solid var(--line);background:rgba(255,255,255,.05);color:#dbe2f0;border-radius:8px;padding:.4rem .7rem;cursor:pointer}
  .cms-btn:hover{border-color:rgba(255,82,69,.5);color:#fff}
  .cms-btn.primary{background:linear-gradient(135deg,var(--red2),var(--red));border-color:transparent;color:#fff}
  .cms-btn.ghost{background:none}
  .cms-btn:disabled{opacity:.5;cursor:not-allowed}
  .cms-table{width:100%;border-collapse:collapse;font-size:.79rem}
  .cms-table th{text-align:left;color:var(--muted);font-weight:600;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;padding:.45rem .5rem;border-bottom:1px solid var(--line)}
  .cms-table td{padding:.55rem .5rem;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top}
  .cms-table tr:hover td{background:rgba(255,255,255,.02)}
  .cms-table td.t{max-width:340px}
  .cms-title{color:#fff;font-weight:600;cursor:pointer;line-height:1.35}
  .cms-title:hover{color:var(--red2)}
  .cms-sub{color:var(--muted);font-size:.7rem;margin-top:.12rem}
  .cms-cols{display:grid;grid-template-columns:2.1fr 1fr;gap:.9rem;align-items:start}
  @media(max-width:1050px){.cms-cols{grid-template-columns:1fr}}
  .cms-panel{background:var(--panel,var(--card));border:1px solid var(--line);border-radius:12px;padding:.85rem .95rem;margin-bottom:.9rem}
  .cms-panel h3{font-size:.86rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:center;gap:.5rem}
  .cms-field{margin-bottom:.6rem}
  .cms-field label{display:block;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.22rem}
  .cms-field input,.cms-field select,.cms-field textarea{width:100%;background:#0a1120;border:1px solid var(--line);border-radius:8px;padding:.5rem .6rem;color:#fff;font-size:.82rem;font-family:inherit}
  .cms-field textarea{min-height:180px;resize:vertical;line-height:1.6}
  .cms-field textarea.short{min-height:64px}
  .cms-2{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
  .cms-3{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem}
  @media(max-width:700px){.cms-2,.cms-3{grid-template-columns:1fr}}
  .cms-chip{display:inline-flex;align-items:center;gap:.25rem;font-size:.68rem;background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:999px;padding:.12rem .5rem;margin:.1rem .15rem .1rem 0}
  .cms-chip button{background:none;border:0;color:var(--muted);cursor:pointer;font-size:.8rem;line-height:1}
  .cms-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.55rem;margin-bottom:.9rem}
  .cms-kpi div{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:10px;padding:.55rem .7rem}
  .cms-kpi b{display:block;font-size:1.15rem;color:#fff}
  .cms-kpi span{font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  .cms-list{display:grid;gap:.45rem}
  .cms-item{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:9px;padding:.5rem .65rem;font-size:.78rem}
  .cms-item b{color:#fff}
  .cms-empty{color:var(--muted);font-size:.79rem;padding:.7rem 0}
  .cms-tabs{display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.7rem;border-bottom:1px solid var(--line);padding-bottom:.4rem}
  .cms-tabs button{background:none;border:1px solid transparent;color:var(--muted);font-size:.76rem;font-weight:600;padding:.3rem .6rem;border-radius:7px;cursor:pointer}
  .cms-tabs button.on{background:rgba(255,82,69,.14);border-color:rgba(255,82,69,.35);color:#fff}
  .agent-card{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:11px;padding:.6rem .7rem}
  .agent-card .h{display:flex;gap:.4rem;align-items:center;font-size:.8rem;font-weight:700;color:#fff}
  .agent-card p{font-size:.71rem;color:var(--muted);margin:.25rem 0 .45rem;line-height:1.45}
  .ai-out{background:#070d18;border:1px solid var(--line);border-radius:9px;padding:.55rem .65rem;font-size:.75rem;color:#d5deee;white-space:pre-wrap;max-height:260px;overflow:auto;line-height:1.55}
  .sev-kritis{border-left:3px solid #ff5245}
  .sev-peringatan{border-left:3px solid #f2c14e}
  .sev-saran{border-left:3px solid #8ab4ff}
  .sev-info{border-left:3px solid #94a0b8}
  .bar-row{display:flex;align-items:center;gap:.5rem;font-size:.74rem;margin-bottom:.3rem}
  .bar-row .n{width:110px;color:var(--muted)}
  .bar-row .b{flex:1;height:7px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
  .bar-row .b i{display:block;height:100%;border-radius:99px}
  .bar-row .v{width:56px;text-align:right;color:#fff;font-variant-numeric:tabular-nums}
  `;
  document.head.appendChild(st);
})();

/* ══════════════ 1. DAFTAR ARTIKEL (CMS) ══════════════ */
let ARTICLE_FILTER = { status: 'semua', channel: 'semua', q: '' };

async function viewArticles(root) {
  root.innerHTML = `<div class="cms-empty">Memuat artikel…</div>`;
  const [list, tax] = await Promise.all([NR.get('/articles?limit=200'), NR.get('/taxonomy')]);
  NR.cache.taxonomy = tax;
  const rows = list.articles;
  const counts = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});

  root.innerHTML = `
  <div class="cms-kpi">
    <div><b>${rows.length}</b><span>Total artikel</span></div>
    <div><b>${counts.tayang || 0}</b><span>Tayang</span></div>
    <div><b>${(counts.review || 0) + (counts.fakta || 0) + (counts.hukum || 0)}</b><span>Menunggu review</span></div>
    <div><b>${(counts.draft || 0) + (counts.ide || 0)}</b><span>Draf & ide</span></div>
    <div><b>${rows.reduce((a, r) => a + (r.open_notes || 0), 0)}</b><span>Catatan terbuka</span></div>
    <div><b>${rows.reduce((a, r) => a + (r.new_findings || 0), 0)}</b><span>Temuan AI baru</span></div>
  </div>

  <div class="cms-bar">
    <input id="fq" placeholder="Cari judul / isi…" value="${esc(ARTICLE_FILTER.q)}" style="flex:1;min-width:180px" aria-label="Cari artikel">
    <select id="fstatus" aria-label="Filter status">
      <option value="semua">Semua status</option>
      ${Object.keys(STATUS_LABEL).map(s => `<option value="${s}"${ARTICLE_FILTER.status === s ? ' selected' : ''}>${STATUS_LABEL[s]}${counts[s] ? ` (${counts[s]})` : ''}</option>`).join('')}
    </select>
    <select id="fch" aria-label="Filter kanal">
      <option value="semua">Semua kanal</option>
      ${tax.channels.map(c => `<option value="${c.id}"${ARTICLE_FILTER.channel === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select>
    <button class="cms-btn primary" id="newArt">+ Artikel Baru</button>
    <button class="cms-btn" id="runSweep" title="Jalankan agen prioritas pada semua artikel yang belum tayang">⚡ AI Sweep</button>
  </div>

  <div class="cms-panel" style="padding-bottom:.3rem">
    <table class="cms-table">
      <thead><tr><th style="width:44%">Judul</th><th>Kanal</th><th>Status</th><th>Penulis</th><th>Diperbarui</th><th>Catatan</th><th>AI</th><th></th></tr></thead>
      <tbody id="artRows">${renderArticleRows(rows)}</tbody>
    </table>
  </div>`;

  const apply = () => {
    const q = $('#fq').value.toLowerCase();
    const shown = rows.filter(r =>
      (ARTICLE_FILTER.status === 'semua' || r.status === ARTICLE_FILTER.status) &&
      (ARTICLE_FILTER.channel === 'semua' || r.channel_id === ARTICLE_FILTER.channel) &&
      (!q || (r.title + ' ' + (r.deck || '')).toLowerCase().includes(q)));
    $('#artRows').innerHTML = renderArticleRows(shown);
  };
  $('#fq').addEventListener('input', e => { ARTICLE_FILTER.q = e.target.value; apply(); });
  $('#fstatus').addEventListener('change', e => { ARTICLE_FILTER.status = e.target.value; apply(); });
  $('#fch').addEventListener('change', e => { ARTICLE_FILTER.channel = e.target.value; apply(); });
  $('#newArt').addEventListener('click', () => openEditor(null));
  $('#runSweep').addEventListener('click', async e => {
    e.target.disabled = true; e.target.textContent = '⚡ Menjalankan…';
    try {
      const r = await NR.post('/ai/sweep');
      toast(`${r.articles} artikel diperiksa — ${r.findings} temuan baru.`);
      navTo('findings');
    } catch (err) { toast(err.message); }
    finally { e.target.disabled = false; e.target.textContent = '⚡ AI Sweep'; }
  });
  $('#artRows').addEventListener('click', e => {
    const t = e.target.closest('[data-open]');
    if (t) { openEditor(t.dataset.open); return; }
    const q2 = e.target.closest('[data-quickai]');
    if (q2) { runAgentQuick(q2.dataset.quickai, q2.dataset.agent); }
  });
}

function aiChip(n) {
  if (!n) return '<span class="cms-sub">—</span>';
  return `<span style="font-size:.66rem;font-weight:700;color:#f2c14e" title="${n} temuan AI baru">${n} ⚑</span>`;
}
function renderArticleRows(rows) {
  if (!rows.length) return `<tr><td colspan="8" class="cms-empty">Tidak ada artikel pada filter ini.</td></tr>`;
  return rows.map(r => `
    <tr>
      <td class="t">
        <div class="cms-title" data-open="${r.id}">${r.is_breaking ? '🔴 ' : ''}${esc(r.title)}</div>
        <div class="cms-sub">${esc((r.deck || '').slice(0, 110))}${(r.deck || '').length > 110 ? '…' : ''}</div>
        <div class="cms-sub">${(r.tags || []).slice(0, 4).map(t => `<span class="cms-chip">${esc(t)}</span>`).join('')} · ${r.word_count} kata · ${r.read_time_min} mnt</div>
      </td>
      <td>${r.channel_name ? `<span style="color:${r.channel_color};font-size:.74rem;font-weight:600">${esc(r.channel_name)}</span>` : '<span class="cms-sub">—</span>'}</td>
      <td>${pill(STATUS_LABEL[r.status] || r.status, STATUS_COLOR[r.status] || '#94a0b8')}${r.priority === 'tinggi' || r.priority === 'mendesak' ? `<div class="cms-sub" style="color:${r.priority === 'mendesak' ? '#ff5245' : '#f2c14e'}">${r.priority}</div>` : ''}</td>
      <td style="font-size:.74rem">${esc(r.author_name || r.author_email || '—')}</td>
      <td style="font-size:.72rem;color:var(--muted)">${dt(r.updated_at)}</td>
      <td>${r.open_notes ? `<span style="color:#f2c14e;font-size:.74rem;font-weight:700">${r.open_notes}</span>` : '<span class="cms-sub">—</span>'}</td>
      <td>${aiChip(r.new_findings)}</td>
      <td><button class="cms-btn ghost" data-quickai="${r.id}" data-agent="pipeline" title="Jalankan 9 agen AI">AI</button></td>
    </tr>`).join('');
}

async function runAgentQuick(articleId, agent) {
  toast('Menjalankan agen AI…');
  try {
    const r = agent === 'pipeline' ? await NR.post('/ai/pipeline', { article_id: Number(articleId) })
      : await NR.post('/ai/run', { article_id: Number(articleId), agent });
    toast(`${r.runs.length} agen selesai · ${r.findings} temuan baru.`);
    navTo('findings');
  } catch (e) { toast(e.message); }
}

/* ══════════════ 2. EDITOR ARTIKEL ══════════════ */
async function openEditor(id) {
  const tax = NR.cache.taxonomy || await NR.get('/taxonomy');
  NR.cache.taxonomy = tax;
  let a = { title: '', deck: '', body: '', channel_id: '', tags: [], hero_image: '', seo_title: '', seo_desc: '', sources: [], fact_checks: [], priority: 'normal', status: 'draft', is_breaking: false };
  let detail = null;
  if (id) {
    detail = await NR.get('/articles/' + id);
    a = { ...a, ...detail.article, tags: detail.article.tags || [], sources: detail.article.sources || [], fact_checks: detail.article.fact_checks || [] };
  }
  const isNew = !id;
  const flow = detail ? FLOW_MAP[detail.article.status] || [] : [];

  openModal(`
  <div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.7rem">
    <h3 style="font-size:1rem;margin:0">${isNew ? 'Artikel Baru' : 'Editor Artikel'}</h3>
    <div style="display:flex;gap:.35rem;flex-wrap:wrap">
      ${detail ? `<span>${pill(STATUS_LABEL[a.status], STATUS_COLOR[a.status])}</span>` : ''}
      <button class="cms-btn ghost" onclick="closeModal()">Tutup</button>
    </div>
  </div>
  ${detail ? `<div class="cms-tabs" id="edTabs">
      <button class="on" data-tab="isi">Isi Naskah</button>
      <button data-tab="meta">SEO & Metadata</button>
      <button data-tab="fakta">Verifikasi & Sumber</button>
      <button data-tab="ai">Multi-Agent AI</button>
      <button data-tab="kolab">Catatan & Approval</button>
      <button data-tab="rev">Riwayat</button>
      <button data-tab="stat">Performa</button>
    </div>` : ''}

  <div id="tab-isi">
    <div class="cms-field"><label for="eTitle">Judul</label><input id="eTitle" value="${esc(a.title)}" placeholder="Judul berita…"></div>
    <div class="cms-field"><label for="eDeck">Deck / ringkasan pembuka (1–2 kalimat)</label><textarea id="eDeck" class="short" placeholder="Ringkasan singkat…">${esc(a.deck)}</textarea></div>
    <div class="cms-field"><label for="eBody">Naskah (pisahkan paragraf dengan baris kosong)</label><textarea id="eBody" placeholder="Tulis naskah…">${esc(a.body)}</textarea></div>
    <div class="cms-3">
      <div class="cms-field"><label for="eCh">Kanal</label><select id="eCh"><option value="">— pilih —</option>${tax.channels.map(c => `<option value="${c.id}"${a.channel_id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="cms-field"><label for="ePri">Prioritas</label><select id="ePri">${['rendah', 'normal', 'tinggi', 'mendesak'].map(p => `<option value="${p}"${a.priority === p ? ' selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="cms-field"><label for="eHero">Gambar utama (path)</label><select id="eHero"><option value="">— tidak ada —</option>${(tax && NR.cache.media ? NR.cache.media : []).map(m => `<option value="${esc(m.path)}"${a.hero_image === m.path ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
    </div>
    <div class="cms-field"><label for="eTags">Tag (pisahkan koma)</label><input id="eTags" value="${esc((a.tags || []).join(', '))}" placeholder="BMKG, banjir, Kediri"></div>
    <div class="cms-field"><label><input type="checkbox" id="eBreak" ${a.is_breaking ? 'checked' : ''} style="width:auto"> Tandai sebagai breaking news</label></div>
    <div class="cms-bar" style="margin-top:.4rem">
      <button class="cms-btn primary" id="saveArt">💾 Simpan</button>
      ${detail ? `<button class="cms-btn" id="goStatus">Ajukan ke tahap berikutnya →</button>
      <button class="cms-btn ghost" id="dupArt">Duplikat</button>
      <button class="cms-btn ghost" id="delArt" style="color:#ff8a80">Hapus</button>` : ''}
      <span class="cms-sub" id="saveMsg"></span>
    </div>
  </div>

  <div id="tab-meta" style="display:none">
    <div class="cms-field"><label for="eSeoT">Judul SEO (≤60 karakter)</label><input id="eSeoT" value="${esc(a.seo_title || '')}" maxlength="70"></div>
    <div class="cms-field"><label for="eSeoD">Meta deskripsi (≤158 karakter)</label><textarea id="eSeoD" class="short" maxlength="170">${esc(a.seo_desc || '')}</textarea></div>
    <div class="cms-field"><label>Pratinjau hasil pencarian</label>
      <div style="background:#fff;border-radius:8px;padding:.6rem .75rem">
        <div style="color:#1a0dab;font-size:.86rem">${esc(a.seo_title || a.title || 'Judul artikel')}</div>
        <div style="color:#006621;font-size:.7rem">mbcindonesia.tv › berita › ${esc((a.slug || 'slug-artikel'))}</div>
        <div style="color:#545454;font-size:.74rem">${esc(a.seo_desc || a.deck || 'Deskripsi akan muncul di sini…')}</div>
      </div>
    </div>
    ${detail && detail.article.ai_summary ? `<div class="cms-panel"><h3>Ringkasan AI tersimpan</h3><p style="font-size:.79rem;line-height:1.6">${esc(detail.article.ai_summary)}</p><div class="cms-sub">Nada: ${esc(detail.article.ai_sentiment || '—')} · kata kunci: ${esc((detail.article.ai_keywords || []).join(', '))}</div></div>` : ''}
  </div>

  <div id="tab-fakta" style="display:none">
    <div class="cms-panel"><h3>Sumber <button class="cms-btn ghost" id="addSrc">+ Tambah</button></h3>
      <div id="srcList" class="cms-list"></div></div>
    <div class="cms-panel"><h3>Verifikasi fakta <button class="cms-btn ghost" id="addFact">+ Klaim</button></h3>
      <div id="factList" class="cms-list"></div>
      <p class="cms-sub" style="margin-top:.5rem">Sistem menolak status <b>Tayang</b> bila masih ada klaim berstatus “menunggu” atau belum ada sumber.</p>
    </div>
  </div>

  <div id="tab-ai" style="display:none">
    <p class="cms-sub" style="margin-bottom:.6rem">9 agen berjalan lokal di server (deterministik, dapat diaudit). Pilih agen lalu jalankan; hasil tersimpan di Temuan AI.</p>
    <div class="cms-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.5rem" id="agentGrid"></div>
    <div class="cms-bar" style="margin-top:.6rem">
      <button class="cms-btn primary" id="runAll">▶ Jalankan 9 agen sekaligus</button>
      <span class="cms-sub" id="aiMsg"></span>
    </div>
    <div id="aiResults"></div>
  </div>

  <div id="tab-kolab" style="display:none">
    <div class="cms-panel"><h3>Catatan redaksi</h3>
      <div class="cms-field"><textarea id="noteBody" class="short" placeholder="Tulis catatan, koreksi, atau permintaan…"></textarea></div>
      <div class="cms-bar">
        <select id="noteKind"><option value="catatan">Catatan</option><option value="koreksi">Koreksi</option><option value="permintaan">Permintaan</option><option value="hukum">Hukum</option></select>
        <button class="cms-btn" id="addNote">Tambah catatan</button>
      </div>
      <div id="noteList" class="cms-list" style="margin-top:.55rem"></div>
    </div>
    <div class="cms-panel"><h3>Alur persetujuan</h3>
      <div id="apprList" class="cms-list"></div>
      <div class="cms-bar" style="margin-top:.5rem">
        <select id="apprStage">${['redaktur', 'fakta', 'hukum', 'pemimpin'].map(s => `<option value="${s}">${s}</option>`).join('')}</select>
        <button class="cms-btn primary" id="doApprove">Setujui</button>
        <button class="cms-btn" id="doRevisi">Minta revisi</button>
        <button class="cms-btn ghost" id="doReject" style="color:#ff8a80">Tolak</button>
      </div>
      <p class="cms-sub" style="margin-top:.4rem">Hanya <b>Direksi/Pemimpin Redaksi</b> yang dapat memberi keputusan.</p>
    </div>
  </div>

  <div id="tab-rev" style="display:none"><div id="revList" class="cms-list"></div></div>
  <div id="tab-stat" style="display:none"><div id="statBox"></div></div>
  `);

  /* ----- pengikatan ----- */
  const msg = $('#saveMsg');
  const collect = () => ({
    title: $('#eTitle').value.trim(),
    deck: $('#eDeck').value.trim(),
    body: $('#eBody').value,
    channel_id: $('#eCh').value || null,
    priority: $('#ePri').value,
    is_breaking: $('#eBreak').checked,
    tags: $('#eTags').value.split(',').map(t => t.trim()).filter(Boolean),
    hero_image: $('#eHero').value,
    seo_title: $('#eSeoT') ? $('#eSeoT').value.trim() : (a.seo_title || ''),
    seo_desc: $('#eSeoD') ? $('#eSeoD').value.trim() : (a.seo_desc || ''),
    sources: SRC.slice(),
    fact_checks: FACTS.slice()
  });

  let SRC = (a.sources || []).slice();
  let FACTS = (a.fact_checks || []).slice();

  const drawSrc = () => {
    const el = $('#srcList'); if (!el) return;
    el.innerHTML = SRC.length ? SRC.map((s, i) => `
      <div class="cms-item"><b>${esc(s.title || '(tanpa judul)')}</b> <span class="cms-chip">${esc(s.type || 'lain')}</span>
        <button class="cms-chip" data-delsrc="${i}" style="cursor:pointer">hapus</button>
        <div class="cms-sub">${esc(s.note || '')} ${s.url ? `· <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a>` : ''}</div></div>`).join('')
      : `<div class="cms-empty">Belum ada sumber. Artikel tanpa sumber tidak bisa diterbitkan.</div>`;
  };
  const drawFacts = () => {
    const el = $('#factList'); if (!el) return;
    el.innerHTML = FACTS.length ? FACTS.map((f, i) => `
      <div class="cms-item"><b>${esc(f.claim || '')}</b>
        <div class="cms-bar" style="margin:.3rem 0 0">
          <select data-fstat="${i}">${['menunggu', 'terverifikasi', 'tidak akurat', 'tidak dapat diverifikasi'].map(s => `<option value="${s}"${f.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
          <input data-fsrc="${i}" value="${esc(f.source || '')}" placeholder="bukti/tautan" style="flex:1;min-width:120px">
          <button class="cms-chip" data-delfact="${i}" style="cursor:pointer">hapus</button>
        </div></div>`).join('')
      : `<div class="cms-empty">Belum ada klaim yang dicatat.</div>`;
  };
  drawSrc(); drawFacts();

  document.getElementById('modalBox').addEventListener('click', e => {
    if (e.target.id === 'addSrc') {
      SRC.push({ title: '', url: '', type: 'data', note: '' });
      openSrcDialog();
    }
    if (e.target.id === 'addFact') {
      FACTS.push({ claim: '', status: 'menunggu', source: '', by: session()?.name || '', at: new Date().toISOString().slice(0, 10) });
      drawFacts();
    }
    const d = e.target.closest('[data-delsrc]'); if (d) { SRC.splice(+d.dataset.delsrc, 1); drawSrc(); }
    const f2 = e.target.closest('[data-delfact]'); if (f2) { FACTS.splice(+f2.dataset.delfact, 1); drawFacts(); }
  });
  document.getElementById('modalBox').addEventListener('change', e => {
    if (e.target.dataset.fstat !== undefined) FACTS[+e.target.dataset.fstat].status = e.target.value;
    if (e.target.dataset.fsrc !== undefined) FACTS[+e.target.dataset.fsrc].source = e.target.value;
  });

  function openSrcDialog() {
    const idx = SRC.length - 1;
    const html = `
      <div class="cms-panel"><h3>Sumber baru</h3>
        <div class="cms-field"><label>Judul / dokumen</label><input id="sTitle" placeholder="mis. Risalah rapat Dewan Pengupahan"></div>
        <div class="cms-2"><div class="cms-field"><label>Tipe</label><select id="sType">
          <option value="regulasi">Regulasi</option><option value="data">Data/Statistik</option>
          <option value="organisasi">Lembaga</option><option value="akademik">Akademik</option>
          <option value="kutipan">Kutipan narasumber</option><option value="dokumen">Dokumen internal</option></select></div>
        <div class="cms-field"><label>URL (opsional)</label><input id="sUrl" placeholder="https://…"></div></div>
        <div class="cms-field"><label>Catatan</label><input id="sNote" placeholder="Apa isinya / halaman berapa"></div>
        <div class="cms-bar"><button class="cms-btn primary" id="sSave">Tambah</button><button class="cms-btn ghost" onclick="closeModal()">Batal</button></div>
      </div>`;
    openModal(html);
    $('#sSave').addEventListener('click', () => {
      SRC[idx] = { title: $('#sTitle').value.trim(), type: $('#sType').value, url: $('#sUrl').value.trim(), note: $('#sNote').value.trim() };
      openEditor(id); // gambar ulang editor dengan data terbaru
    });
  }

  if (detail) {
    $('#edTabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      [...$('#edTabs').children].forEach(x => x.classList.toggle('on', x === b));
      ['isi', 'meta', 'fakta', 'ai', 'kolab', 'rev', 'stat'].forEach(t => { const el = document.getElementById('tab-' + t); if (el) el.style.display = t === b.dataset.tab ? 'block' : 'none'; });
      if (b.dataset.tab === 'stat') drawStat();
    });

    /* AI tab */
    const agents = (await NR.get('/ai/agents')).agents;
    $('#agentGrid').innerHTML = agents.map(g => `
      <div class="agent-card">
        <div class="h"><span style="color:${g.color}">${g.icon}</span>${esc(g.name)}</div>
        <p>${esc(g.role)}</p>
        <button class="cms-btn" data-runagent="${g.id}" style="width:100%">Jalankan</button>
      </div>`).join('');
    $('#agentGrid').addEventListener('click', async e => {
      const b = e.target.closest('[data-runagent]'); if (!b) return;
      b.disabled = true; b.textContent = '…';
      try {
        const r = await NR.post('/ai/run', { article_id: detail.article.id, agent: b.dataset.runagent });
        $('#aiMsg').textContent = `Selesai: ${r.findings} temuan (${r.runs[0].duration_ms} ms)`;
        $('#aiResults').innerHTML = r.runs.map(x => `
          <div class="cms-panel"><h3>${esc(x.agent)} <span class="cms-sub">${x.duration_ms} ms</span></h3>
          <pre class="ai-out">${esc(JSON.stringify(x.output, null, 2))}</pre>
          ${x.findings.length ? `<div class="cms-list" style="margin-top:.4rem">${x.findings.map(f => `<div class="cms-item sev-${f.severity}"><b>${esc(f.title)}</b><div class="cms-sub">${esc(f.detail || '')}</div></div>`).join('')}</div>` : ''}</div>`).join('');
      } catch (err) { toast(err.message); }
      finally { b.disabled = false; b.textContent = 'Jalankan'; }
    });
    $('#runAll').addEventListener('click', async e => {
      e.target.disabled = true; e.target.textContent = 'Menjalankan 9 agen…';
      try {
        const r = await NR.post('/ai/pipeline', { article_id: detail.article.id });
        $('#aiMsg').textContent = `${r.runs.length} agen selesai · ${r.findings} temuan baru tersimpan`;
        $('#aiResults').innerHTML = r.runs.map(x => `
          <div class="cms-panel"><h3><span style="color:var(--red2)">${esc(x.agent)}</span> <span class="cms-sub">${x.duration_ms} ms</span></h3>
          <pre class="ai-out">${esc(JSON.stringify(x.output, null, 2))}</pre>
          ${x.findings.map(f => `<div class="cms-item sev-${f.severity}" style="margin-top:.3rem"><b>${esc(f.title)}</b><div class="cms-sub">${esc(f.detail || '')}</div></div>`).join('')}</div>`).join('');
      } catch (err) { toast(err.message); }
      finally { e.target.disabled = false; e.target.textContent = '▶ Jalankan 9 agen sekaligus'; }
    });

    /* kolaborasi tab */
    const drawNotes = () => {
      $('#noteList').innerHTML = detail.notes.length ? detail.notes.map(n => `
        <div class="cms-item"><b>${esc(n.author)}</b> <span class="cms-chip">${esc(n.kind)}</span> ${n.resolved ? '<span class="cms-chip" style="color:#2fd27a">selesai</span>' : `<button class="cms-chip" data-resolve="${n.id}" style="cursor:pointer">tandai selesai</button>`}
        <div style="margin-top:.15rem">${esc(n.body)}</div><div class="cms-sub">${dt(n.created_at)}</div></div>`).join('')
        : `<div class="cms-empty">Belum ada catatan.</div>`;
    };
    drawNotes();
    $('#addNote').addEventListener('click', async () => {
      const body = $('#noteBody').value.trim(); if (!body) return toast('Isi catatan dulu');
      try {
        await NR.post(`/articles/${detail.article.id}/notes`, { body, kind: $('#noteKind').value });
        toast('Catatan ditambahkan'); openEditor(id);
      } catch (e) { toast(e.message); }
    });
    $('#noteList').addEventListener('click', async e => {
      const b = e.target.closest('[data-resolve]'); if (!b) return;
      await NR.patch('/notes/' + b.dataset.resolve, { resolved: true });
      toast('Catatan diselesaikan'); openEditor(id);
    });
    $('#apprList').innerHTML = detail.approvals.length ? detail.approvals.map(x => `
      <div class="cms-item"><b>${esc(x.stage)}</b> ${pill(x.status, x.status === 'disetujui' ? '#2fd27a' : x.status === 'menunggu' ? '#f2c14e' : '#ff5245')}
      <div class="cms-sub">${esc(x.actor || '—')} · ${dt(x.decided_at || x.created_at)} ${x.note ? '· ' + esc(x.note) : ''}</div></div>`).join('')
      : `<div class="cms-empty">Belum ada riwayat persetujuan.</div>`;

    const decide = async decision => {
      try {
        const r = await NR.post(`/articles/${detail.article.id}/approvals`, { stage: $('#apprStage').value, decision, note: '' });
        toast(`Keputusan ${decision} dicatat — status artikel: ${STATUS_LABEL[r.status] || r.status}`);
        openEditor(id);
      } catch (e) { toast(e.message); }
    };
    $('#doApprove').addEventListener('click', () => decide('disetujui'));
    $('#doRevisi').addEventListener('click', () => decide('revisi'));
    $('#doReject').addEventListener('click', () => decide('ditolak'));

    /* riwayat */
    $('#revList').innerHTML = detail.revisions.length ? detail.revisions.map(r => `
      <div class="cms-item"><b>v${r.version}</b> — ${esc(r.title)}<div class="cms-sub">${esc(r.edited_by || '')} · ${dt(r.created_at)} · ${esc(r.note || '')}</div></div>`).join('')
      : `<div class="cms-empty">Belum ada revisi.</div>`;

    /* performa */
    const drawStat = () => {
      const an = detail.analytics || [];
      const total = an.reduce((a, x) => a + x.views, 0);
      const max = Math.max(1, ...an.map(x => x.views));
      $('#statBox').innerHTML = `
        <div class="cms-kpi"><div><b>${total.toLocaleString('id-ID')}</b><span>Total tayangan 14 hari</span></div>
        <div><b>${an.length ? Math.round(an.reduce((a, x) => a + (x.read_complete / (x.views || 1)), 0) / an.length * 100) : 0}%</b><span>Rata-rata selesai baca</span></div>
        <div><b>${an.reduce((a, x) => a + x.shares, 0)}</b><span>Dibagikan</span></div>
        <div><b>${an.length ? Math.round(an.reduce((a, x) => a + x.avg_scroll, 0) / an.length) : 0}%</b><span>Rata-rata scroll</span></div></div>
        <div class="cms-panel"><h3>Tayangan harian</h3>${an.map(x => `<div class="bar-row"><span class="n">${new Date(x.day).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span><span class="b"><i style="width:${Math.round(x.views / max * 100)}%;background:linear-gradient(90deg,#ff5245,#b81d14)"></i></span><span class="v">${x.views}</span></div>`).join('') || '<div class="cms-empty">Belum ada data.</div>'}</div>`;
    };
  }

  /* simpan */
  $('#saveArt').addEventListener('click', async () => {
    const data = collect();
    if (!data.title) return toast('Judul wajib diisi');
    try {
      if (isNew) {
        const r = await NR.post('/articles', data);
        toast('Artikel dibuat'); closeModal(); navTo('articles'); openEditor(r.article.id);
      } else {
        await NR.patch('/articles/' + id, data);
        toast('Tersimpan'); if (msg) msg.textContent = 'Tersimpan ' + new Date().toLocaleTimeString('id-ID');
      }
    } catch (e) { toast(e.message); }
  });

  if (detail) {
    $('#goStatus').addEventListener('click', async () => {
      const next = (FLOW_MAP[detail.article.status] || [])[0];
      if (!next) return toast('Tidak ada tahap berikutnya');
      try {
        await NR.post(`/articles/${id}/status`, { status: next, note: '' });
        toast(`Status → ${STATUS_LABEL[next]}`); openEditor(id);
      } catch (e) { toast(e.message); }
    });
    $('#dupArt').addEventListener('click', async () => {
      try { const r = await NR.post(`/articles/${id}/duplicate`); toast('Duplikat dibuat'); closeModal(); navTo('articles'); }
      catch (e) { toast(e.message); }
    });
    $('#delArt').addEventListener('click', async () => {
      if (!confirm('Hapus artikel ini? Tindakan tercatat di audit.')) return;
      try { await NR.del('/articles/' + id); toast('Dihapus'); closeModal(); navTo('articles'); }
      catch (e) { toast(e.message); }
    });
  }
}

const FLOW_MAP = {
  ide: ['draft'], draft: ['review', 'ide'], review: ['fakta', 'draft'], fakta: ['hukum', 'review', 'siap'],
  hukum: ['siap', 'fakta'], siap: ['terjadwal', 'tayang', 'hukum'], terjadwal: ['tayang', 'siap'],
  tayang: ['arsip', 'ditarik'], arsip: ['draft'], ditarik: ['draft']
};

/* ══════════════ 3. MEJA REDAKSI (desk) ══════════════ */
async function viewDesk(root) {
  root.innerHTML = `<div class="cms-empty">Memuat meja redaksi…</div>`;
  const d = await NR.get('/desk');
  const sc = d.status_counts;
  const sevColor = { kritis: '#ff5245', peringatan: '#f2c14e', saran: '#8ab4ff', info: '#94a0b8' };

  root.innerHTML = `
  <div class="cms-kpi">
    <div><b>${sc.tayang || 0}</b><span>Tayang</span></div>
    <div><b>${(sc.review || 0) + (sc.fakta || 0) + (sc.hukum || 0) + (sc.siap || 0)}</b><span>Di meja redaksi</span></div>
    <div><b>${d.pending_approvals.length}</b><span>Menunggu persetujuan</span></div>
    <div><b>${d.open_notes.length}</b><span>Catatan terbuka</span></div>
    <div><b>${d.new_findings.length}</b><span>Temuan AI</span></div>
  </div>
  <div class="cms-cols">
    <div>
      <div class="cms-panel"><h3>Jadwal &amp; tugas hari ini <button class="cms-btn ghost" id="quickTask">+ Tugas</button></h3>
        <div class="cms-list">${d.tasks.length ? d.tasks.map(t => `
          <div class="cms-item" style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
            <div><b>${esc(t.title)}</b><div class="cms-sub">${new Date(t.plan_date).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })} · ${esc(t.slot)} · ${esc(t.assignee || '—')}</div>
            ${t.angle ? `<div class="cms-sub">Sudut: ${esc(t.angle)}</div>` : ''}</div>
            <div style="display:flex;gap:.3rem;align-items:flex-start">
              ${pill(t.status, t.status === 'selesai' ? '#2fd27a' : t.status === 'dikerjakan' ? '#f2c14e' : '#94a0b8')}
              ${t.status !== 'selesai' ? `<button class="cms-btn ghost" data-task="${t.id}" data-next="${t.status === 'rencana' ? 'dikerjakan' : 'selesai'}">→</button>` : ''}
            </div>
          </div>`).join('') : '<div class="cms-empty">Belum ada tugas terjadwal.</div>'}</div>
      </div>
      <div class="cms-panel"><h3>Menunggu persetujuan</h3>
        <div class="cms-list">${d.pending_approvals.length ? d.pending_approvals.map(a => `
          <div class="cms-item"><b>${esc(a.title)}</b> ${pill(a.stage, '#f2c14e')}
          <div class="cms-sub">Status artikel: ${STATUS_LABEL[a.article_status] || a.article_status} · ${dt(a.created_at)}</div>
          <button class="cms-btn ghost" style="margin-top:.3rem" data-openart="${a.article_id}">Buka & putuskan →</button></div>`).join('')
        : '<div class="cms-empty">Tidak ada yang menunggu. 🎉</div>'}</div>
      </div>
    </div>
    <div>
      <div class="cms-panel"><h3>Temuan AI terbaru <button class="cms-btn ghost" data-goto="findings">Semua →</button></h3>
        <div class="cms-list">${d.new_findings.length ? d.new_findings.slice(0, 6).map(f => `
          <div class="cms-item" style="border-left:3px solid ${sevColor[f.severity] || '#94a0b8'}"><b>${esc(f.title)}</b>
          <div class="cms-sub">${esc(f.article_title)} · ${esc(f.severity)}</div></div>`).join('') : '<div class="cms-empty">Belum ada temuan.</div>'}</div>
      </div>
      <div class="cms-panel"><h3>Catatan redaksi terbuka</h3>
        <div class="cms-list">${d.open_notes.length ? d.open_notes.slice(0, 6).map(n => `
          <div class="cms-item"><b>${esc(n.author)}</b> <span class="cms-chip">${esc(n.kind)}</span>
          <div style="margin-top:.12rem">${esc(n.body)}</div><div class="cms-sub">${esc(n.title)}</div></div>`).join('') : '<div class="cms-empty">Tidak ada catatan terbuka.</div>'}</div>
      </div>
    </div>
  </div>`;

  root.addEventListener('click', async e => {
    const t = e.target.closest('[data-task]');
    if (t) {
      try { await NR.patch('/tasks/' + t.dataset.task, { status: t.dataset.next }); toast('Tugas diperbarui'); navTo('desk'); } catch (err) { toast(err.message); }
    }
    const o = e.target.closest('[data-openart]');
    if (o) openEditor(o.dataset.openart);
    const g = e.target.closest('[data-goto]');
    if (g) navTo(g.dataset.goto);
    if (e.target.id === 'quickTask') openTaskModal();
  }, { once: false });
}

async function openTaskModal() {
  const tax = NR.cache.taxonomy || await NR.get('/taxonomy');
  NR.cache.taxonomy = tax;
  openModal(`
    <h3 style="font-size:1rem;margin-bottom:.6rem">Tugas editorial baru</h3>
    <div class="cms-field"><label>Judul tugas</label><input id="tTitle" placeholder="mis. Laporan lapangan banjir"></div>
    <div class="cms-2">
      <div class="cms-field"><label>Penanggung jawab</label><select id="tWho">${tax.staff.map(s => `<option value="${esc(s.user_email)}">${esc(s.display_name)}</option>`).join('')}</select></div>
      <div class="cms-field"><label>Tanggal</label><input id="tDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
    </div>
    <div class="cms-3">
      <div class="cms-field"><label>Slot</label><select id="tSlot"><option>pagi</option><option>siang</option><option>sore</option><option>malam</option></select></div>
      <div class="cms-field"><label>Kanal</label><select id="tCh"><option value="">—</option>${tax.channels.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
    </div>
    <div class="cms-field"><label>Sudut / arahan</label><input id="tAngle" placeholder="Arahan singkat untuk jurnalis"></div>
    <div class="cms-bar"><button class="cms-btn primary" id="tSave">Simpan tugas</button><button class="cms-btn ghost" onclick="closeModal()">Batal</button></div>`);
  $('#tSave').addEventListener('click', async () => {
    try {
      await NR.post('/tasks', { title: $('#tTitle').value.trim(), assignee: $('#tWho').value, plan_date: $('#tDate').value, slot: $('#tSlot').value, channel_id: $('#tCh').value || null, angle: $('#tAngle').value });
      toast('Tugas ditambahkan'); closeModal(); navTo('desk');
    } catch (e) { toast(e.message); }
  });
}

/* ══════════════ 4. KALENDER EDITORIAL ══════════════ */
async function viewCalendar(root) {
  root.innerHTML = `<div class="cms-empty">Memuat kalender…</div>`;
  const [desk, list] = await Promise.all([NR.get('/desk'), NR.get('/articles?limit=200')]);
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  const iso = d => d.toISOString().slice(0, 10);
  const slotOrder = { pagi: 0, siang: 1, sore: 2, malam: 3 };

  root.innerHTML = `
  <div class="cms-bar"><button class="cms-btn primary" id="addTask2">+ Tugas editorial</button>
    <span class="cms-sub">Tujuh hari ke depan · geser jadwal dengan mengubah status tugas</span></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem">
    ${days.map(d => {
      const t = desk.tasks.filter(x => x.plan_date.slice(0, 10) === iso(d)).sort((a, b) => slotOrder[a.slot] - slotOrder[b.slot]);
      const sched = list.articles.filter(a => a.scheduled_at && a.scheduled_at.slice(0, 10) === iso(d));
      return `<div class="cms-panel" style="margin:0;min-height:130px">
        <h3 style="font-size:.72rem;color:${iso(d) === iso(new Date()) ? 'var(--red2)' : 'var(--muted)'}">${d.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}</h3>
        ${t.map(x => `<div class="cms-item" style="margin-bottom:.3rem;padding:.35rem .45rem"><b style="font-size:.72rem">${esc(x.title.slice(0, 42))}</b>
          <div class="cms-sub">${esc(x.slot)} · ${esc((x.assignee || '').split('@')[0])}</div></div>`).join('')}
        ${sched.map(a => `<div class="cms-item" style="margin-bottom:.3rem;padding:.35rem .45rem;border-color:rgba(242,193,78,.4)"><b style="font-size:.72rem">📅 ${esc(a.title.slice(0, 38))}</b><div class="cms-sub">jadwal tayang</div></div>`).join('')}
        ${!t.length && !sched.length ? '<div class="cms-sub">—</div>' : ''}
      </div>`;
    }).join('')}
  </div>
  <div class="cms-panel" style="margin-top:.9rem"><h3>Artikel terjadwal</h3>
    <div class="cms-list">${list.articles.filter(a => a.scheduled_at && ['siap', 'terjadwal'].includes(a.status)).map(a => `
      <div class="cms-item"><b>${esc(a.title)}</b> ${pill(STATUS_LABEL[a.status], STATUS_COLOR[a.status])}
      <div class="cms-sub">Tayang ${dt(a.scheduled_at)} · ${esc(a.author_name || '')}</div></div>`).join('') || '<div class="cms-empty">Belum ada artikel terjadwal.</div>'}</div>
  </div>`;
  $('#addTask2').addEventListener('click', openTaskModal);
}

/* ══════════════ 5. TEMUAN AI (inbox) ══════════════ */
let FINDING_FILTER = { status: 'baru', severity: '', agent: '' };
async function viewFindings(root) {
  root.innerHTML = `<div class="cms-empty">Memuat temuan AI…</div>`;
  const [agents, data] = await Promise.all([NR.get('/ai/agents'), NR.get('/ai/findings?status=' + FINDING_FILTER.status + (FINDING_FILTER.severity ? '&severity=' + FINDING_FILTER.severity : '') + (FINDING_FILTER.agent ? '&agent=' + FINDING_FILTER.agent : ''))]);
  const bySeverity = data.findings.reduce((a, f) => { a[f.severity] = (a[f.severity] || 0) + 1; return a; }, {});
  root.innerHTML = `
  <div class="cms-kpi">
    <div><b style="color:#ff5245">${bySeverity.kritis || 0}</b><span>Kritis</span></div>
    <div><b style="color:#f2c14e">${bySeverity.peringatan || 0}</b><span>Peringatan</span></div>
    <div><b style="color:#8ab4ff">${bySeverity.saran || 0}</b><span>Saran</span></div>
    <div><b>${bySeverity.info || 0}</b><span>Info</span></div>
    <div><b>${agents.agents.reduce((a, g) => a + g.run_count, 0)}</b><span>Total run agen</span></div>
  </div>
  <div class="cms-bar">
    <select id="ffStatus">${['baru', 'dibaca', 'diterapkan', 'diabaikan', 'semua'].map(s => `<option value="${s}"${FINDING_FILTER.status === s ? ' selected' : ''}>status: ${s}</option>`).join('')}</select>
    <select id="ffSev"><option value="">semua severity</option>${['kritis', 'peringatan', 'saran', 'info'].map(s => `<option value="${s}"${FINDING_FILTER.severity === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
    <select id="ffAgent"><option value="">semua agen</option>${agents.agents.map(g => `<option value="${g.id}"${FINDING_FILTER.agent === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
  </div>
  <div class="cms-panel"><div class="cms-list" id="findList">${renderFindings(data.findings)}</div></div>`;
  const reload = () => navTo('findings');
  $('#ffStatus').onchange = e => { FINDING_FILTER.status = e.target.value; reload(); };
  $('#ffSev').onchange = e => { FINDING_FILTER.severity = e.target.value; reload(); };
  $('#ffAgent').onchange = e => { FINDING_FILTER.agent = e.target.value; reload(); };
  $('#findList').addEventListener('click', async e => {
    const b = e.target.closest('[data-fstatus]');
    if (b) { await NR.patch('/ai/findings/' + b.dataset.id, { status: b.dataset.fstatus }); toast('Temuan diperbarui'); reload(); return; }
    const o = e.target.closest('[data-openart]'); if (o) openEditor(o.dataset.openart);
  });
}
function renderFindings(fs) {
  if (!fs.length) return `<div class="cms-empty">Tidak ada temuan pada filter ini. Jalankan AI Sweep dari menu Artikel.</div>`;
  return fs.map(f => `
    <div class="cms-item sev-${f.severity}">
      <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <b>${esc(f.title)}</b> ${f.status !== 'baru' ? `<span class="cms-chip">${esc(f.status)}</span>` : ''}
          <div class="cms-sub">${esc(f.agent_name)} · ${esc(f.article_title)} · ${dt(f.created_at)}</div>
          ${f.detail ? `<div style="margin-top:.2rem;color:#cfd8e8">${esc(f.detail)}</div>` : ''}
        </div>
        <div style="display:flex;gap:.25rem;align-items:flex-start;flex-wrap:wrap">
          <span style="font-size:.62rem;font-weight:700;text-transform:uppercase;color:${SEV_COLOR[f.severity]}">${esc(f.severity)}</span>
          <button class="cms-btn ghost" data-openart="${f.article_id}">Artikel</button>
          ${f.status === 'baru' ? `<button class="cms-btn ghost" data-id="${f.id}" data-fstatus="dibaca">Baca</button>` : ''}
          <button class="cms-btn ghost" data-id="${f.id}" data-fstatus="diterapkan" title="Tandai sudah ditindaklanjuti">✓</button>
          <button class="cms-btn ghost" data-id="${f.id}" data-fstatus="diabaikan">Abaikan</button>
        </div>
      </div>
    </div>`).join('');
}

/* ══════════════ 6. MEDIA LIBRARY ══════════════ */
async function viewMedia(root) {
  root.innerHTML = `<div class="cms-empty">Memuat media…</div>`;
  const d = await NR.get('/media');
  NR.cache.media = d.media;
  root.innerHTML = `
  <div class="cms-bar"><input id="mq" placeholder="Cari nama aset…" style="flex:1;min-width:180px">
    <span class="cms-sub">${d.media.length} aset · ${(d.total_kb / 1024).toFixed(1)} MB terpakai (contoh)</span></div>
  <div id="mediaGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.6rem">
    ${d.media.map(m => `
      <div class="cms-panel" style="margin:0;padding:.5rem" data-name="${esc(m.name)}">
        <img src="${esc(m.path)}" alt="${esc(m.name)}" loading="lazy" style="width:100%;height:100px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">
        <div style="font-size:.74rem;color:#fff;margin-top:.35rem;font-weight:600;word-break:break-all">${esc(m.name)}</div>
        <div class="cms-sub">${esc(m.kind)} · ${m.size_kb} KB · ${esc(m.credit || '')}</div>
        <div style="margin:.25rem 0">${(m.tags || []).map(t => `<span class="cms-chip">${esc(t)}</span>`).join('')}</div>
        <button class="cms-btn ghost" data-copy="${esc(m.path)}" style="width:100%">Salin path</button>
      </div>`).join('')}
  </div>`;
  $('#mq').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    [...$('#mediaGrid').children].forEach(c => c.style.display = c.dataset.name.toLowerCase().includes(q) ? '' : 'none');
  });
  $('#mediaGrid').addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Path disalin: ' + b.dataset.copy); } catch { toast(b.dataset.copy); }
  });
}

/* ══════════════ 7. MODERASI KOMENTAR ══════════════ */
async function viewModeration(root) {
  root.innerHTML = `<div class="cms-empty">Memuat komentar…</div>`;
  const d = await NR.get('/moderation');
  const menunggu = d.comments.filter(c => c.status === 'menunggu').length;
  root.innerHTML = `
  <div class="cms-kpi">
    <div><b style="color:#f2c14e">${menunggu}</b><span>Menunggu moderasi</span></div>
    <div><b>${d.comments.filter(c => c.status === 'tayang').length}</b><span>Tayang</span></div>
    <div><b>${d.comments.filter(c => c.status === 'sembunyi').length}</b><span>Disembunyikan</span></div>
    <div><b>${d.comments.filter(c => c.status === 'spam').length}</b><span>Spam</span></div>
  </div>
  <div class="cms-panel"><div class="cms-list" id="modList">
    ${d.comments.length ? d.comments.map(c => `
      <div class="cms-item">
        <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
          <div style="flex:1;min-width:180px"><b>${esc(c.author)}</b> <span class="cms-chip">${esc(c.program_id)}</span>
            <div style="margin-top:.15rem">${esc(c.body)}</div>
            <div class="cms-sub">${dt(c.created_at)} ${c.moderated_by ? '· dimoderasi ' + esc(c.moderated_by) : ''} ${c.reason ? '· ' + esc(c.reason) : ''}</div></div>
          <div style="display:flex;gap:.25rem;align-items:flex-start;flex-wrap:wrap">
            ${pill(c.status, c.status === 'tayang' ? '#2fd27a' : c.status === 'spam' ? '#ff5245' : '#f2c14e')}
            <button class="cms-btn ghost" data-mod="tayang" data-id="${c.id}">Tayangkan</button>
            <button class="cms-btn ghost" data-mod="sembunyi" data-id="${c.id}">Sembunyikan</button>
            <button class="cms-btn ghost" data-mod="spam" data-id="${c.id}" style="color:#ff8a80">Spam</button>
          </div>
        </div>
      </div>`).join('') : '<div class="cms-empty">Belum ada komentar publik.</div>'}
  </div></div>`;
  $('#modList').addEventListener('click', async e => {
    const b = e.target.closest('[data-mod]'); if (!b) return;
    try { await NR.post('/moderation/' + b.dataset.id, { status: b.dataset.mod }); toast('Komentar → ' + b.dataset.mod); navTo('moderation'); }
    catch (err) { toast(err.message); }
  });
}

/* ══════════════ 8. ANALITIK KONTEN ══════════════ */
async function viewContentAnalytics(root) {
  root.innerHTML = `<div class="cms-empty">Menghitung analitik…</div>`;
  const d = await NR.get('/analytics');
  const maxDaily = Math.max(1, ...d.daily.map(x => x.views));
  const maxCh = Math.max(1, ...d.by_channel.map(x => x.views));
  const totalViews = d.daily.reduce((a, x) => a + x.views, 0);
  const completes = d.daily.reduce((a, x) => a + x.read_complete, 0);
  root.innerHTML = `
  <div class="cms-kpi">
    <div><b>${totalViews.toLocaleString('id-ID')}</b><span>Tayangan 14 hari</span></div>
    <div><b>${Math.round(completes / (totalViews || 1) * 100)}%</b><span>Selesai baca</span></div>
    <div><b>${d.daily.reduce((a, x) => a + x.shares, 0)}</b><span>Dibagikan</span></div>
    <div><b>${d.summary.tayang}</b><span>Artikel tayang</span></div>
    <div><b>${d.summary.pipeline}</b><span>Dalam proses</span></div>
  </div>
  <div class="cms-cols">
    <div class="cms-panel"><h3>Tren tayangan harian</h3>
      <svg viewBox="0 0 ${d.daily.length * 34} 130" style="width:100%;height:150px" role="img" aria-label="Grafik tayangan harian">
        <polyline fill="none" stroke="#ff5245" stroke-width="2.2" points="${d.daily.map((x, i) => `${i * 34 + 12},${120 - Math.round(x.views / maxDaily * 100)}`).join(' ')}"/>
        ${d.daily.map((x, i) => `<circle cx="${i * 34 + 12}" cy="${120 - Math.round(x.views / maxDaily * 100)}" r="2.6" fill="#ffd166"/><text x="${i * 34 + 12}" y="129" font-size="7" fill="#8b97b3" text-anchor="middle">${new Date(x.day).getDate()}</text>`).join('')}
      </svg>
    </div>
    <div class="cms-panel"><h3>Tayangan per kanal</h3>
      ${d.by_channel.map(c => `<div class="bar-row"><span class="n">${esc(c.channel)}</span><span class="b"><i style="width:${Math.round(c.views / maxCh * 100)}%;background:${c.color}"></i></span><span class="v">${c.views}</span></div>`).join('')}
    </div>
  </div>
  <div class="cms-panel"><h3>Artikel teratas</h3>
    <table class="cms-table"><thead><tr><th>Judul</th><th>Tayangan</th><th>Selesai baca</th><th>Scroll</th></tr></thead><tbody>
    ${d.top_articles.map(a => `<tr><td>${esc(a.title)}</td><td>${a.views}</td><td>${a.completion || 0}%</td><td>${a.avg_scroll || 0}%</td></tr>`).join('')}
    </tbody></table>
  </div>`;
}

/* ══════════════ 9. STUDIO AI (dasbor agen) ══════════════ */
async function viewAIStudio(root) {
  root.innerHTML = `<div class="cms-empty">Memuat studio AI…</div>`;
  const [ov, agents] = await Promise.all([NR.get('/overview'), NR.get('/ai/agents')]);
  root.innerHTML = `
  <div class="cms-panel">
    <h3>Multi-Agent AI Newsroom <span class="cms-sub">${agents.agents.length} agen · pustaka rujukan ${agents.library_size} sumber</span></h3>
    <p class="cms-sub" style="margin-bottom:.7rem">Semua agen berjalan <b>di server MBC sendiri</b> — naskah tidak dikirim ke layanan AI pihak ketiga. Hasil deterministik &amp; dapat diaudit, sehingga cocok untuk kepatuhan editorial.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.55rem">
      ${agents.agents.map(g => `
        <div class="agent-card">
          <div class="h"><span style="color:${g.color};font-size:1rem">${g.icon}</span> ${esc(g.name)}</div>
          <p>${esc(g.description)}</p>
          <div class="cms-sub">${g.run_count} run · ${g.open_findings} temuan terbuka ${g.last_run_at ? '· terakhir ' + dt(g.last_run_at) : ''}</div>
        </div>`).join('')}
    </div>
    <div class="cms-bar" style="margin-top:.7rem">
      <button class="cms-btn primary" id="sweepAll">⚡ Jalankan sweep seluruh newsroom</button>
      <button class="cms-btn" id="processJobs">Proses antrean tugas</button>
      <span class="cms-sub" id="aiStudioMsg"></span>
    </div>
  </div>
  <div class="cms-cols">
    <div class="cms-panel"><h3>Temuan per tingkat</h3>
      <div class="bar-row"><span class="n">Kritis</span><span class="b"><i style="width:${Math.min(100, (ov.findings_by_severity.kritis || 0) * 12)}%;background:#ff5245"></i></span><span class="v">${ov.findings_by_severity.kritis || 0}</span></div>
      <div class="bar-row"><span class="n">Peringatan</span><span class="b"><i style="width:${Math.min(100, (ov.findings_by_severity.peringatan || 0) * 12)}%;background:#f2c14e"></i></span><span class="v">${ov.findings_by_severity.peringatan || 0}</span></div>
      <div class="bar-row"><span class="n">Saran</span><span class="b"><i style="width:${Math.min(100, (ov.findings_by_severity.saran || 0) * 12)}%;background:#8ab4ff"></i></span><span class="v">${ov.findings_by_severity.saran || 0}</span></div>
      <div class="bar-row"><span class="n">Info</span><span class="b"><i style="width:${Math.min(100, (ov.findings_by_severity.info || 0) * 12)}%;background:#94a0b8"></i></span><span class="v">${ov.findings_by_severity.info || 0}</span></div>
      <button class="cms-btn ghost" style="margin-top:.5rem" data-goto="findings">Buka kotak temuan →</button>
    </div>
    <div class="cms-panel"><h3>Tentang cara kerja</h3>
      <ul style="font-size:.76rem;color:var(--muted);line-height:1.7;padding-left:1rem">
        <li><b>Ringkas</b> & <b>SEO</b> menyiapkan ringkasan, meta, kata kunci.</li>
        <li><b>Nada</b> mengukur sentimen & keseimbangan narasumber.</li>
        <li><b>Fakta</b> menandai klaim berangka & kelengkapan sumber.</li>
        <li><b>Etika</b> memeriksa clickbait, atribusi kabur, data sensitif.</li>
        <li><b>Hukum</b> memeriksa praduga tak bersalah & UU PDP.</li>
        <li><b>Literasi</b> mencocokkan rujukan dengan pustaka kurasi.</li>
        <li><b>Social</b> membuat takarir & judul push.</li>
        <li><b>Peliputan</b> mengusulkan sudut lanjutan & narasumber.</li>
      </ul>
      <p class="cms-sub" style="margin-top:.4rem">Keputusan akhir tetap manusia: agen tidak pernah menerbitkan artikel sendiri.</p>
    </div>
  </div>`;
  $('#sweepAll').addEventListener('click', async e => {
    e.target.disabled = true; e.target.textContent = 'Menjalankan…';
    try { const r = await NR.post('/ai/sweep'); $('#aiStudioMsg').textContent = `${r.articles} artikel · ${r.findings} temuan`; toast('Sweep selesai'); }
    catch (err) { toast(err.message); }
    finally { e.target.disabled = false; e.target.textContent = '⚡ Jalankan sweep seluruh newsroom'; }
  });
  $('#processJobs').addEventListener('click', async () => {
    try { const r = await NR.post('/ai/jobs/process'); toast(`${r.processed} tugas antrean diproses`); } catch (e) { toast(e.message); }
  });
  root.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) navTo(g.dataset.goto); });
}

/* ---------- ekspos modul ke window (dipakai router newsroom/index.html) ---------- */
if (typeof window !== 'undefined') {
  Object.assign(window, {
    NR, STATUS_LABEL, STATUS_COLOR, FLOW_MAP,
    viewDesk, viewArticles, viewCalendar, viewFindings, viewModeration,
    viewMedia, viewContentAnalytics, viewAIStudio,
    openEditor, openTaskModal, runAgentQuick
  });
}
