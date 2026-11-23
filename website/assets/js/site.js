/* MBCINDONESIA.TV — util bersama situs publik */
function toast(msg){
  let t = document.querySelector('.toast');
  if(!t){ t = document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2600);
}
function toggleMobileNav(){ const m=document.getElementById('mobileNav'); if(m) m.classList.toggle('open'); }
function initSearch(){
  document.querySelectorAll('[data-search]').forEach(box=>{
    const input = box.querySelector('input');
    input.addEventListener('keydown', e=>{ if(e.key==='Enter' && input.value.trim()){ window.location.href='index.html?q='+encodeURIComponent(input.value.trim())+'#katalog'; } });
  });
}
function cardHTML(p){
  return `<article class="card">
    <a class="thumb" href="watch.html?id=${p.id}" aria-label="Tonton ${p.title}">
      <img src="${p.img}" alt="Poster program ${p.title}" loading="lazy" onerror="this.onerror=null;this.src='assets/img/hero.jpg'">
      <span class="dur">${p.eps[0][1]}</span>
    </a>
    <div class="card-body">
      <span class="card-cat">${p.cat}</span>
      <h3><a href="watch.html?id=${p.id}">${p.title}</a></h3>
      <p>${p.desc}</p>
      <div class="card-meta"><span>★ ${p.rating} · ${p.views} tayang</span><span>${p.cat}</span></div>
    </div>
  </article>`;
}
function initNewsletter(){
  document.querySelectorAll('[data-newsletter]').forEach(form=>{
    form.addEventListener('submit', async e=>{
      e.preventDefault();
      const input = form.querySelector('input[type=email]');
      const email = input.value.trim();
      if(!email) return;
      let msg = null;
      try {
        const res = await fetch('/api/newsletter', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email}) });
        if (res.ok) { const j = await res.json(); msg = j.already ? 'Anda sudah terdaftar di buletin MBC INDONESIA.' : 'Terima kasih! '+email+' terdaftar di buletin MBC INDONESIA.'; }
      } catch(_) { /* offline */ }
      if (!msg) {
        const saved = JSON.parse(localStorage.getItem('mbc_newsletter')||'[]');
        if(!saved.includes(email)) saved.push(email);
        localStorage.setItem('mbc_newsletter', JSON.stringify(saved));
        msg = 'Anda terdaftar (tersimpan lokal — server tidak terjangkau).';
      }
      input.value='';
      toast(msg);
    });
  });
}
document.addEventListener('DOMContentLoaded', ()=>{ initSearch(); initNewsletter(); });

/* Tombol kembali ke atas */
(function backTop(){
  const btn = document.createElement('button');
  btn.id = 'backTop'; btn.setAttribute('aria-label','Kembali ke atas'); btn.textContent = '↑';
  document.body.appendChild(btn);
  const onScroll = () => btn.classList.toggle('show', window.scrollY > 420);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  btn.addEventListener('click', () => window.scrollTo(0, 0));
})();

/* ---- Jaring aman aset: satu aset gagal (mis. jaringan putus sesaat) tidak boleh
   meninggalkan kotak kosong. Gambar dicoba ulang sekali, lalu jatuh ke placeholder lokal. */
(function () {
  const PLACEHOLDER = 'assets/img/hero.jpg';
  function pasang(img) {
    if (img.dataset.jaring) return;
    img.dataset.jaring = '1';
    img.addEventListener('error', function () {
      const coba = Number(img.dataset.coba || 0);
      if (coba < 1) {                    // 1x ulang dengan cache-buster
        img.dataset.coba = String(coba + 1);
        const src = img.getAttribute('src') || '';
        setTimeout(() => { img.src = src.split('?')[0] + '?ulang=' + Date.now(); }, 600);
      } else if (!img.dataset.final) {
        img.dataset.final = '1';
        img.src = PLACEHOLDER;
      }
    });
  }
  const pindai = (akar) => {
    (akar.querySelectorAll ? akar.querySelectorAll('img') : []).forEach(pasang);
    if (akar.tagName === 'IMG') pasang(akar);
  };
  document.addEventListener('DOMContentLoaded', () => pindai(document));
  new MutationObserver(mutasi => mutasi.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && pindai(n))))
    .observe(document.documentElement, { childList: true, subtree: true });
  /* Tandai elemen video yang gagal agar tidak terlihat "hidup" padahal mati */
  document.addEventListener('error', e => {
    const v = e.target;
    if (v && v.tagName === 'VIDEO') { v.dataset.gagal = '1'; v.classList.add('video-gagal'); }
  }, true);
})();

/* ---- Jaring aman aset: satu aset gagal (jaringan putus sesaat) tidak boleh
   meninggalkan kotak kosong. Gambar dicoba ulang sekali, lalu placeholder lokal. ---- */
(function () {
  const PLACEHOLDER = 'assets/img/hero.jpg';
  function pasang(img) {
    if (img.dataset.jaring) return;
    img.dataset.jaring = '1';
    img.addEventListener('error', function () {
      const coba = Number(img.dataset.coba || 0);
      if (coba < 1) {
        img.dataset.coba = String(coba + 1);
        const src = img.getAttribute('src') || '';
        setTimeout(() => { img.src = src.split('?')[0] + '?ulang=' + Date.now(); }, 600);
      } else if (!img.dataset.final) {
        img.dataset.final = '1';
        img.src = PLACEHOLDER;
      }
    });
  }
  const pindai = akar => {
    if (!akar.querySelectorAll) return;
    akar.querySelectorAll('img').forEach(pasang);
    if (akar.tagName === 'IMG') pasang(akar);
  };
  document.addEventListener('DOMContentLoaded', () => pindai(document));
  new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(n => n.nodeType === 1 && pindai(n))))
    .observe(document.documentElement, { childList: true, subtree: true });
})();
