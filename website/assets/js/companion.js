/* ============================================================
   companion.js — "Nusa", AI Companion untuk pengunjung
   ------------------------------------------------------------
   • Panduan situs (navigasi, cara menonton, jam tayang, akun)
   • Pemaham konteks: mengikuti berita/program yang sedang dibuka
   • Analisis berita (ringkasan, sentimen, entitas, kata kunci)
   • Pencarian literasi/rujukan terkait berita yang sedang dimuat
   • Semua berjalan lokal di perangkat pengunjung (tanpa kunci API,
     tanpa mengirim data pribadi) — lihat PRIVASI di README.
   ============================================================ */
'use strict';

(function () {
  if (typeof window.MBC_NEWS === 'undefined') { console.warn('[companion] ai-news.js belum dimuat'); return; }

  const N = window.MBC_NEWS;
  const KEY = { open: 'mbc_guide_open', hist: 'mbc_guide_hist' };

  /* ---------- Konteks halaman ---------- */
  function pageContext() {
    const qs = new URLSearchParams(location.search);
    const art = qs.get('artikel') || qs.get('id');
    const title = document.title.split('—')[0].trim();
    let article = null;
    if (art) article = N.articles.find(a => a.id === art) || null;
    if (!article && /berita\.html$/.test(location.pathname)) article = N.articles[0] || null;   // halaman berita: anggap berita teratas sedang dibaca
    return { article, programId: qs.get('id'), page: title, isWatch: /watch\.html$/.test(location.pathname), isNews: /berita\.html$/.test(location.pathname) };
  }

  /* ---------- Balasan ---------- */
  function reply(kind, ctx, text) {
    const R = [];
    const push = (html) => R.push(html);

    if (kind === 'greet') {
      push(`Halo! 👋 Saya <b>Nusa</b>, pemandu MBC INDONESIA. Saya bisa menjelaskan isi berita, menerjemahkan istilah, dan mencarikan <b>rujukan/literasi</b> terkait berita yang sedang Anda baca.`);
      if (ctx.article) push(`Anda sedang membaca: <b>${esc(ctx.article.title)}</b>. Tanya “ringkas berita ini” atau “carikan referensinya”.`);
      else push(`Coba: <i>“apa itu UMK?”</i> · <i>“ringkas berita banjir”</i> · <i>“carikan referensi soal AI”</i>.`);
      return R;
    }

    if (kind === 'help') {
      push(`<b>Yang bisa saya lakukan</b>`);
      push(`• <b>Menjelaskan berita</b>: ringkasan, siapa &amp; di mana, angka penting, dan nada pemberitaan.<br>• <b>Mencari literasi</b>: regulasi, data statistik, kajian akademik, dan episode MBC terkait.<br>• <b>Memandu situs</b>: cara menonton live, jadwal, podcast, dan cara menghubungi redaksi.`);
      push(`<span class="cg-note">Saya bukan pengganti verifikasi redaksi. Untuk keputusan penting, rujuk sumber resmi yang saya cantumkan.</span>`);
      return R;
    }

    if (kind === 'watch') {
      push(`<b>Menonton MBC INDONESIA</b>`);
      push(`• <a href="live.html">Live TV</a> — siaran berjalan + jadwal hari ini.<br>• <a href="index.html#katalog">Katalog program</a> — 8 program: berita, dokumenter, podcast, budaya, kuliner, musik.<br>• <a href="live.html">Jadwal</a> diperbarui harian; slot prime time 19.00–21.00 WIB.`);
      push(`Tips: pasang sebagai aplikasi (buka menu peramban → <i>Install app</i>) agar tayang lebih lancar dan bisa dibuka saat koneksi buruk.`);
      return R;
    }

    if (kind === 'contact') {
      push(`<b>Kontak</b>`);
      push(`• Redaksi &amp; koreksi berita: <a href="mailto:redaksi@mbcindonesia.tv">redaksi@mbcindonesia.tv</a><br>• Iklan &amp; sponsorship: <a href="mailto:iklan@mbcindonesia.tv">iklan@mbcindonesia.tv</a><br>• Privasi/data pribadi: <a href="mailto:privasi@mbcindonesia.tv">privasi@mbcindonesia.tv</a>`);
      push(`Newsroom internal adalah area terbatas untuk staf redaksi — tidak dibuka untuk umum.`);
      return R;
    }

    if (kind === 'literacy') {
      const q = (ctx.article ? ctx.article.tags.join(' ') + ' ' + text : text);
      const res = N.searchLiteracy(q);
      push(`<b>Literasi &amp; rujukan</b> untuk “<i>${esc(text)}</i>”:`);
      if (!res.length) push(`Belum ada rujukan yang cocok di pustaka kurasi kami. Coba kata kunci lain, mis. <i>“upah minimum”</i>, <i>“data bencana”</i>, atau <i>“privasi data”</i>.`);
      else push(`<ul class="cg-list">${res.map(r => `<li><b>${esc(r.t)}</b> <span class="cg-tag">${esc(r.typLabel)}</span> <span class="cg-match">${r.match}% cocok</span><br><span class="cg-sub">${esc(r.note)}</span>${r.url ? `<br><a href="${esc(r.url)}" ${r.url.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>Buka sumber →</a>` : ''}</li>`).join('')}</ul>`);
      return R;
    }

    if (kind === 'analysis') {
      // jika pengunjung tidak menyebut topik, gunakan berita yang sedang dibuka
      const explicit = N.searchArticles(text, 1);
      const hasTopic = explicit.length && explicit[0].sim > 0.12 && !/^(ringkas|rangkum|ringkasan|analisis|analisa)/i.test(text.trim());
      const target = hasTopic ? explicit[0] : (ctx.article || pickArticle(text));
      if (!target) {
        push(`Saya belum yakin berita mana yang Anda maksud. Sebutkan topiknya (mis. <i>“banjir Kediri”</i>, <i>“UMK 2027”</i>, <i>“kopi ekspor”</i>) atau buka halaman beritanya lebih dulu.`);
        return R;
      }
      const a = N.analyze(target.id);
      push(`<div class="cg-card"><div class="cg-kicker">${esc(target.kicker)} · ${esc(target.place)} · ${esc(target.date)}</div><div class="cg-title">${esc(target.title)}</div></div>`);
      push(`<b>Ringkasan</b><br>${esc(a.summary)}`);
      push(`<b>Nada pemberitaan:</b> ${toneBadge(a.sentiment)} <span class="cg-sub">(${a.sentiment.pos} penanda positif / ${a.sentiment.neg} negatif)</span>`);
      if (a.entities.organizations.length || a.entities.places.length) {
        push(`<b>Pihak &amp; lokasi:</b> ${esc([...a.entities.organizations, ...a.entities.places].join(', '))}`);
      }
      if (a.entities.numbers.length) push(`<b>Angka penting:</b> ${esc(a.entities.numbers.join(' · '))}`);
      const lib = N.searchLiteracy(target.tags.join(' '));
      if (lib.length) push(`<b>Literasi terkait</b><ul class="cg-list">${lib.slice(0, 3).map(r => `<li><a href="${esc(r.url || '#')}" ${String(r.url).startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(r.t)}</a> <span class="cg-tag">${esc(r.typLabel)}</span></li>`).join('')}</ul>`);
      if (target.claims && target.claims.length) push(`<span class="cg-note">⚠️ Perlu verifikasi lanjutan: ${esc(target.claims.join(' · '))}</span>`);
      push(`<a class="cg-btn" href="berita.html?artikel=${encodeURIComponent(target.id)}">Baca berita lengkap →</a>`);
      return R;
    }

    /* default: search */
    const arts = N.searchArticles(text, 3);
    const lib = N.searchLiteracy(text, 'semua');
    push(`Saya carikan yang paling relevan dengan “<i>${esc(text)}</i>”:`);
    if (arts.length) push(`<ul class="cg-list">${arts.map(x => `<li><a href="berita.html?artikel=${encodeURIComponent(x.id)}">${esc(x.title)}</a><br><span class="cg-sub">${esc(x.kicker)} · ${esc(x.date)}</span></li>`).join('')}</ul>`);
    else push(`<span class="cg-sub">Tidak ada berita yang benar-benar cocok. Coba kata kunci lain.</span>`);
    if (lib.length) push(`<b>Rujukan pendukung</b><ul class="cg-list">${lib.slice(0, 3).map(r => `<li>${esc(r.t)} <span class="cg-tag">${esc(r.typLabel)}</span></li>`).join('')}</ul>`);
    return R;
  }

  function pickArticle(text) {
    const hits = N.searchArticles(text, 1);
    return hits.length && hits[0].sim > 0.02 ? hits[0] : null;
  }
  function toneBadge(s) {
    const cls = s.label === 'positif' ? 'cg-pos' : s.label === 'negatif' ? 'cg-neg' : 'cg-neu';
    return `<span class="cg-tone ${cls}">${esc(s.tone)}</span>`;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- UI ---------- */
  function mount() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <button id="cgFab" aria-label="Buka pemandu Nusa" aria-expanded="false">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3a7 7 0 0 1 7 7v3a5 5 0 0 1-5 5h-1l-3.5 3v-3H10a5 5 0 0 1-5-5v-3a7 7 0 0 1 7-7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="9.5" cy="10.5" r=".9" fill="currentColor"/><circle cx="14.5" cy="10.5" r=".9" fill="currentColor"/><path d="M9.5 14h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
    </button>
    <section id="cgPanel" role="dialog" aria-label="Pemandu Nusa" aria-hidden="true">
      <header><div><b>Nusa</b><span>Pemandu &amp; analis berita</span></div>
        <button id="cgClose" aria-label="Tutup pemandu">✕</button></header>
      <div id="cgBody" aria-live="polite"></div>
      <div id="cgChips"></div>
      <form id="cgForm"><input id="cgInput" placeholder="Tanya soal berita, istilah, atau situs…" aria-label="Pertanyaan untuk Nusa" autocomplete="off"><button type="submit" aria-label="Kirim">➤</button></form>
      <div class="cg-foot">Analisis berjalan di perangkat Anda · tanpa data pribadi dikirim</div>
    </section>`;
    document.body.appendChild(wrap);

    const fab = document.getElementById('cgFab');
    const panel = document.getElementById('cgPanel');
    const body = document.getElementById('cgBody');
    const chips = document.getElementById('cgChips');
    const input = document.getElementById('cgInput');

    const add = (html, who) => {
      const d = document.createElement('div');
      d.className = 'cg-msg ' + (who || 'bot');
      d.innerHTML = html;
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
    };
    const say = (arrs) => arrs.forEach(h => add(h, 'bot'));

    function renderChips(ctx) {
      const base = ctx.article
        ? ['Ringkas berita ini', 'Carikan referensinya', 'Apa dampaknya?', 'Siapa pihak terkait?']
        : ['Apa itu UMK?', 'Ringkas berita banjir', 'Referensi soal AI', 'Jadwal live'];
      chips.innerHTML = base.map(t => `<button type="button" data-q="${esc(t)}">${esc(t)}</button>`).join('');
    }

    function welcome() {
      const ctx = pageContext();
      add(`Halo! Saya <b>Nusa</b> — pemandu MBC INDONESIA. ${ctx.article ? `Saya sudah membaca konteks berita <b>${esc(ctx.article.title)}</b>.` : 'Tanya apa saja soal tayangan, istilah, atau berita kami.'}`, 'bot');
      renderChips(ctx);
    }

    function handle(text) {
      const ctx = pageContext();
      add(esc(text), 'user');
      const kind = N.route(text);
      setTimeout(() => say(reply(kind, ctx, text)), 220);
    }

    fab.addEventListener('click', () => {
      const open = panel.classList.toggle('open');
      panel.setAttribute('aria-hidden', String(!open));
      fab.setAttribute('aria-expanded', String(open));
      localStorage.setItem(KEY.open, open ? '1' : '0');
      if (open && !body.childElementCount) welcome();
      if (open) input.focus();
    });
    document.getElementById('cgClose').addEventListener('click', () => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); fab.focus(); });
    chips.addEventListener('click', e => { const b = e.target.closest('button[data-q]'); if (b) handle(b.dataset.q); });
    document.getElementById('cgForm').addEventListener('submit', e => { e.preventDefault(); const t = input.value.trim(); if (!t) return; input.value = ''; handle(t); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); fab.focus(); } });

    // konteks berita aktif → tawarkan analisis sekali
    const ctx = pageContext();
    if (ctx.article && !sessionStorage.getItem('cg_seen_' + ctx.article.id)) {
      sessionStorage.setItem('cg_seen_' + ctx.article.id, '1');
      setTimeout(() => {
        if (!panel.classList.contains('open')) {
          fab.classList.add('cg-pulse');
          const tip = document.createElement('div');
          tip.className = 'cg-tip'; tip.id = 'cgTip';
          tip.innerHTML = `Butuh ringkasan berita ini? <button type="button">Tanya Nusa</button>`;
          document.body.appendChild(tip);
          tip.querySelector('button').addEventListener('click', () => { tip.remove(); fab.click(); handle('Ringkas berita ini'); });
          setTimeout(() => tip.remove(), 12000);
        }
      }, 3500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
