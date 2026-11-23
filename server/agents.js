/* ============================================================
   agents.js — Mesin Multi-Agent AI Newsroom (deterministik)
   ------------------------------------------------------------
   9 agen dengan tugas berbeda. Semua analisis berjalan lokal di
   server: tanpa kunci API, tanpa mengirim naskah ke pihak ketiga,
   hasil dapat diulang (reproducible) dan boleh diaudit.

   Agen bisa dijalankan:
     • manual per agen         → POST /api/newsroom/ai/run {agent, article_id}
     • satu artikel penuh       → POST /api/newsroom/ai/pipeline {article_id}
     • seluruh newsroom         → POST /api/newsroom/ai/sweep
   Setiap temuan masuk ai_findings (dengan severity) & audit_log.
   ============================================================ */
'use strict';

/* ---------- util teks ---------- */
const STOP = new Set(['yang','dan','di','ke','dari','untuk','dengan','pada','dalam','adalah','ini','itu','akan','juga','tidak','bisa','ada','agar','karena','serta','oleh','sebagai','para','atau','lebih','telah','masih','bagi','saat','tahun','kata','ujar','menurut','sebut','secara','hal','dapat','telah','sebuah','dua','satu']);
const norm = s => String(s || '').toLowerCase().replace(/[^\w\sà-ÿ.,%-]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = s => norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w));
const sentences = s => String(s || '').split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 20);
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean);
const stem = w => w.replace(/^(me|mem|men|meng|pen|pem|di|ber|ter)/, '').replace(/(kannya|annya|nya|kan|an|i|lah)$/, '');

const PASSIVE = /\b(dilaporkan|disebutkan|diketahui|menurut\s+sumber|sumber\s+menyebut|konon|kabarnya|diduga|diharapkan|bisa\s+jadi)\b/gi;
const HEDGE = /\b(diduga|kemungkinan|sepertinya|mungkin|tampaknya|berpotensi)\b/gi;
const CLICKBAIT = /\b(heboh|viral|mengejutkan|bikin\s+geram|jangan\s+sampai\s+kehabisan|wajib\s+tahu|ternyata\s+ini|geger|bikin\s+syaraf|auto\s+sultan|no\s+1)\b/gi;
const NUMERAL = /\b(\d[\d.,]*)\s*(persen|%|juta|miliar|triliun|ton|ribu|orang|rumah|hektare|km|sentimeter|poin|hari|jam|kontainer|desa)\b/gi;
const SENSITIVE = /\b(korban|tersangka|anak\s+di\s+bawah\s+umur|identitas|almarhum|pemerkosaan|narkoba|bunuh\s+diri|KTP|NIK|rekening)\b/i;
const ORG_HINT = /\b(PT|CV|Bank|Pemkot|Pemkab|Pemerintah|Kementerian|Dinas|Badan|BMKG|BPS|Koperasi|Asosiasi|Universitas|Polres|Kejaksaan|DPRD)\b/;
const PLACE = /\b(Kediri|Blitar|Trenggalek|Surabaya|Malang|Jember|Nganjuk|Jawa Timur|Jawa Barat|Jakarta|Indonesia|Belanda|Eropa|ASEAN|Brantas|Bromo)\b/g;

/* ---------- analisis dasar yang dipakai beberapa agen ---------- */
function analyzeText(article) {
  const full = [article.title, article.deck, article.body].join(' ');
  const body = String(article.body || '');
  const w = words(body);
  const tf = {};
  tokens(full).forEach(t => { const s = stem(t); tf[s] = (tf[s] || 0) + 1; });
  const keywords = Object.entries(tf).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);
  const sents = sentences(body);
  // ringkasan ekstraktif: kalimat skor tertinggi (frekuensi kata kunci, panjang wajar, ada angka)
  const scored = sents.map((s, i) => {
    const t = tokens(s);
    let score = t.reduce((a, x) => a + (tf[stem(x)] || 0), 0) / Math.sqrt(t.length || 1);
    if (i === 0) score *= 1.3;
    if (/\d/.test(s)) score *= 1.1;
    if (t.length > 40) score *= 0.85;
    return { s, i, score };
  }).sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.i - b.i);
  const summary = scored.map(x => x.s).join(' ') || body.slice(0, 240);
  // sentimen
  const POS = ['naik','untung','tumbuh','berhasil','sukses','baik','positif','menang','apresiasi','meningkat','tembus','perluas','dorong','pulih','aman','stabil'];
  const NEG = ['turun','rugi','gagal','buruk','krisis','ancaman','rawan','bahaya','konflik','sengketa','terdampak','kerugian','peringatan','tuntut','masalah','kekurangan','terbatas','menurun','risiko','dilarang','diduga','korban'];
  let pos = 0, neg = 0;
  tokens(full).forEach(t => { const s = stem(t); if (POS.some(p => s.startsWith(stem(p)))) pos++; else if (NEG.some(n => s.startsWith(stem(n)))) neg++; });
  const score = Math.round(((pos - neg) / ((pos + neg) || 1)) * 100);
  const sentiment = score > 20 ? 'positif' : score < -20 ? 'negatif' : 'netral';
  // entitas sederhana
  const orgs = [...new Set([...full.matchAll(/\b((?:PT|CV|Bank|Pemkot|Pemkab|Koperasi|Asosiasi|Dinas|Badan|Kementerian)\s+[A-Z][\w]+(?:\s+[A-Z][\w]+){0,3})/g)].map(m => m[1]))];
  const places = [...new Set([...full.matchAll(PLACE)].map(m => m[0]))];
  const numbers = [...new Set([...full.matchAll(NUMERAL)].map(m => m[0].trim()))];
  return { full, body, wordCount: w.length, keywords, summary, sentiment, score, pos, neg, orgs, places, numbers, sentences: sents };
}

/* ---------- 9 AGEN ---------- */
const AGENTS = {

  ringkas: {
    id: 'ringkas', name: 'Ringkas', role: 'Perangkum & SEO', icon: '✳', color: '#2fd27a',
    description: 'Membuat ringkasan ekstraktif, usulan judul SEO, meta deskripsi, dan estimasi waktu baca.',
    run(article) {
      const a = analyzeText(article);
      const metaDesc = (article.deck || a.summary).slice(0, 155);
      const seoTitle = (article.title.length > 62 ? article.title.slice(0, 59).trim() + '…' : article.title);
      const findings = [];
      if (!article.seo_desc) findings.push({ severity: 'saran', title: 'Meta deskripsi belum diisi', detail: `Usulan: “${metaDesc}” (${metaDesc.length} karakter, target 120–158).`, evidence: [metaDesc] });
      if (article.title.length > 70) findings.push({ severity: 'peringatan', title: 'Judul terlalu panjang untuk hasil pencarian', detail: `Judul ${article.title.length} karakter; Google memotong ±60. Usulan: “${seoTitle}”.` });
      if (a.wordCount < 250) findings.push({ severity: 'saran', title: 'Naskah masih pendek', detail: `Hanya ${a.wordCount} kata. Untuk berita utilitas, redaksi biasanya menargetkan 300–500 kata.` });
      return {
        output: { summary: a.summary, seo_title: seoTitle, seo_desc: metaDesc, keywords: a.keywords.slice(0, 6), word_count: a.wordCount, read_time_min: Math.max(1, Math.round(a.wordCount / 220)) },
        findings
      };
    }
  },

  sentimen: {
    id: 'sentimen', name: 'Nada & Sentimen', role: 'Analis bias', icon: '◐', color: '#f2c14e',
    description: 'Mengukur nada pemberitaan, menandai kata bermuatan, dan memeriksa keseimbangan narasumber.',
    run(article) {
      const a = analyzeText(article);
      const findings = [];
      const balance = (a.pos + a.neg) > 0;
      if (a.pos > 0 && a.neg === 0) findings.push({ severity: 'saran', title: 'Nada sangat positif tanpa penyeimbang', detail: 'Tidak ada kalimat kritik/penyeimbang. Pertimbangkan menambahkan sudut pandang lain agar berita tidak terkesan promosi.' });
      if (a.neg > a.pos * 3 && a.neg > 4) findings.push({ severity: 'saran', title: 'Nada sangat negatif', detail: `${a.neg} penanda negatif vs ${a.pos} positif. Pastikan hak jawab pihak yang diberitakan sudah dimuat.` });
      if (!balance) findings.push({ severity: 'info', title: 'Distribusi nada kecil', detail: 'Teks pendek/berita singkat — analisis nada kurang bermakna.' });
      const hedges = [...a.full.matchAll(HEDGE)].map(m => m[0].toLowerCase());
      if (hedges.length >= 4) findings.push({ severity: 'peringatan', title: 'Banyak kata penanda ketidakpastian', detail: `Ditemukan ${hedges.length} kali: ${[...new Set(hedges)].join(', ')}. Konfirmasi ke narasumber agar klaim lebih tegas.` });
      return { output: { sentiment: a.sentiment, score: a.score, positive: a.pos, negative: a.neg, hedges: [...new Set(hedges)] }, findings };
    }
  },

  fakta: {
    id: 'fakta', name: 'Verifikator Fakta', role: 'Fact-check', icon: '✓', color: '#ff5245',
    description: 'Menemukan klaim berangka & klaim atributif yang perlu dikonfirmasi, serta menilai kelengkapan sumber.',
    run(article) {
      const a = analyzeText(article);
      const findings = [];
      const claims = [];
      a.sentences.forEach(s => {
        if (/\d/.test(s) && /(persen|juta|miliar|ton|orang|rumah|poin|km|sentimeter)/i.test(s)) claims.push({ claim: s.slice(0, 220), type: 'angka' });
        else if (/(menurut|kata|ujar|sebut|data|survei|rilis|laporan)/i.test(s)) claims.push({ claim: s.slice(0, 220), type: 'atribusi' });
      });
      const uniq = claims.slice(0, 6);
      if (uniq.length) findings.push({ severity: 'peringatan', title: `${uniq.length} klaim perlu sumber tertulis`, detail: 'Klaim berangka/atributif wajib punya dokumen atau kutipan resmi. Tandai statusnya pada panel Verifikasi Fakta sebelum tayang.', evidence: uniq.map(c => `${c.type.toUpperCase()}: ${c.claim}`) });
      const src = Array.isArray(article.sources) ? article.sources : [];
      if (!src.length) findings.push({ severity: 'kritis', title: 'Belum ada sumber tercatat', detail: 'Artikel tanpa entri sumber tidak boleh lolos tahap fakta. Tambahkan minimal 2 sumber (dokumen/kutipan resmi).' });
      else if (src.length < 2) findings.push({ severity: 'peringatan', title: 'Sumber tunggal', detail: 'Baru 1 sumber tercatat. Standar redaksi: minimal 2 sumber independen untuk klaim kebijakan/angka.' });
      const checks = Array.isArray(article.fact_checks) ? article.fact_checks : [];
      const pending = checks.filter(c => !c.status || c.status === 'menunggu');
      if (pending.length) findings.push({ severity: 'peringatan', title: `${pending.length} klaim belum diverifikasi`, detail: 'Isi status (terverifikasi/tidak akurat/tidak dapat diverifikasi) beserta tautan bukti.' });
      return { output: { claims: uniq, sources_count: src.length, verified: checks.filter(c => c.status === 'terverifikasi').length, pending: pending.length }, findings };
    }
  },

  literasi: {
    id: 'literasi', name: 'Pustakawan Literasi', role: 'Riset & rujukan', icon: '📚', color: '#8ab4ff',
    description: 'Mencarikan rujukan pendukung: regulasi, data statistik, kajian akademik, dan episode MBC terkait.',
    run(article, library) {
      const a = analyzeText(article);
      const qSet = new Set(tokens([article.title, article.deck, (article.tags || []).join(' '), article.body].join(' ')).map(stem));
      const scored = (library || []).map(item => {
        const hay = new Set(tokens([item.title, item.note, (item.topics || []).join(' ')].join(' ')).map(stem));
        let hit = 0; qSet.forEach(t => { if (hay.has(t)) hit++; });
        const exact = (article.tags || []).some(tg => (item.topics || []).some(tp => norm(tp) === norm(tg))) ? 3 : 0;
        return { ...item, match: hit * 12 + exact * 20 };
      }).filter(x => x.match > 0).sort((a, b) => b.match - a.match).slice(0, 5)
        .map(x => ({ title: x.title, type: x.type, note: x.note, url: x.url, match: Math.min(97, x.match) }));
      const findings = [];
      if (scored.length === 0) findings.push({ severity: 'saran', title: 'Belum ada rujukan yang cocok', detail: 'Tambahkan topik/tag yang lebih spesifik pada artikel agar agen dapat mencocokkan pustaka.' });
      else findings.push({ severity: 'info', title: `${scored.length} rujukan ditemukan`, detail: scored.map(s => `${s.title} (${s.match}%)`).join(' · '), evidence: scored.map(s => s.title) });
      return { output: { references: scored, query_terms: [...qSet].slice(0, 12) }, findings };
    }
  },

  etika: {
    id: 'etika', name: 'Editor Etika', role: 'Kepatuhan redaksi', icon: '⚖', color: '#c792ea',
    description: 'Memeriksa clickbait, klaim tanpa atribusi, data pribadi sensitif, dan prinsip hak jawab.',
    run(article) {
      const a = analyzeText(article);
      const findings = [];
      const cb = [...a.full.matchAll(CLICKBAIT)].map(m => m[0]);
      if (cb.length) findings.push({ severity: 'kritis', title: 'Ada frasa clickbait', detail: `Ganti frasa: ${[...new Set(cb)].join(', ')}. Judul harus informatif, bukan memancing klik.` });
      const passive = [...a.full.matchAll(PASSIVE)].map(m => m[0]);
      if (passive.length >= 2) findings.push({ severity: 'peringatan', title: 'Atribusi kabur', detail: `Frasa tanpa sumber jelas: ${[...new Set(passive)].join(', ')}. Sebutkan nama/jabatan narasumber.` });
      if (SENSITIVE.test(a.full)) findings.push({ severity: 'peringatan', title: 'Menyebut data sensitif/pribadi', detail: 'Periksa kebutuhan menyebut identitas korban/tersangka/anak. Anonimisasi bila tidak relevan dengan berita.' });
      const titles = article.title.split(' ');
      if (titles.some(t => t === t.toUpperCase() && t.length > 3)) findings.push({ severity: 'saran', title: 'Huruf kapital berlebihan pada judul', detail: 'Gunakan huruf kapital normal (title case Indonesia) agar terlihat kredibel.' });
      if (/(?:satu-satunya|terbaik|terburuk|paling)/i.test(a.full) && !/(menurut|data|survei)/i.test(a.full)) findings.push({ severity: 'saran', title: 'Klaim superlatif tanpa dasar', detail: 'Kata “paling/terbaik” sebaiknya disertai rujukan data atau diubah menjadi pernyataan bersumber.' });
      return { output: { clickbait: [...new Set(cb)], vague_attribution: [...new Set(passive)], sensitive_terms: (a.full.match(SENSITIVE) || [])[0] || null }, findings };
    }
  },

  hukum: {
    id: 'hukum', name: 'Peninjau Hukum', role: 'Risiko hukum & PDP', icon: '§', color: '#ffb86c',
    description: 'Menandai risiko pencemaran nama baik, praduga tak bersalah, dan pelanggaran pelindungan data pribadi.',
    run(article) {
      const a = analyzeText(article);
      const findings = [];
      if (/\b(tersangka|pelaku|korupsi|mencuri|menipu|memerkosa)\b/i.test(a.full) && !/\b(praduga\s+tak\s+bersalah|belum\s+dibuktikan|putusan\s+pengadilan|berhak\s+didampingi)\b/i.test(a.full)) {
        findings.push({ severity: 'kritis', title: 'Praduga tak bersalah belum disebut', detail: 'Berita yang menyebut dugaan pidana wajib memuat frasa praduga tak bersalah dan status proses hukum.' });
      }
      if (/\b(NIK|KTP|nomor\s+rekening|alamat\s+lengkap|nomor\s+telepon)\b/i.test(a.full)) {
        findings.push({ severity: 'kritis', title: 'Potensi pelanggaran UU PDP No. 27/2022', detail: 'Data pribadi spesifik terdeteksi. Hapus atau samarkan sebelum tayang.' });
      }
      const names = [...a.full.matchAll(/\b(?:Bapak|Ibu|Sdr\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g)].map(m => m[1]);
      if (names.length && /\b(kasus|dugaan|laporan\s+polisi)\b/i.test(a.full)) findings.push({ severity: 'peringatan', title: 'Nama pribadi dalam konteks kasus', detail: `Pertimbangkan inisial untuk: ${[...new Set(names)].join(', ')} bila belum ada putusan berkekuatan hukum tetap.` });
      if (!/\b(hak\s+jawab|konfirmasi|dihubungi)\b/i.test(a.full) && /\b(dituduh|diduga|dilaporkan)\b/i.test(a.full)) findings.push({ severity: 'peringatan', title: 'Belum ada jejak konfirmasi/hak jawab', detail: 'Tambahkan kalimat bahwa pihak terkait telah dihubungi beserta responsnya.' });
      return { output: { risks: findings.map(f => f.title), requires_legal_review: findings.some(f => f.severity === 'kritis') }, findings };
    }
  },

  social: {
    id: 'social', name: 'Social & Distribusi', role: 'Promosi multiplatform', icon: '↗', color: '#5eead4',
    description: 'Menyiapkan takarir media sosial, utas, judul push notification, dan saran thumbnail.',
    run(article) {
      const a = analyzeText(article);
      const tags = (article.tags || []).slice(0, 4).map(t => '#' + String(t).replace(/\s+/g, '')).join(' ');
      const hook = a.summary.split(/(?<=[.!?])\s/)[0] || article.deck || article.title;
      const findings = [];
      if (!article.hero_image) findings.push({ severity: 'saran', title: 'Belum ada gambar utama', detail: 'Sosial media tanpa gambar menurunkan klik ±35%. Pilih aset dari Media Library.' });
      if ((article.tags || []).length < 3) findings.push({ severity: 'saran', title: 'Tag terlalu sedikit', detail: 'Tambahkan minimal 3 tag agar artikel mudah ditemukan & direkomendasikan.' });
      return {
        output: {
          instagram: `${article.title}\n\n${hook.slice(0, 180)}\n\nSelengkapnya di MBCINDONESIA.TV 🔗\n${tags}`,
          x_thread: [hook.slice(0, 220), `Konteks: ${a.summary.slice(0, 200)}`, `Baca & tonton: mbcindonesia.tv/berita`],
          push_title: article.title.length > 55 ? article.title.slice(0, 52) + '…' : article.title,
          push_body: (article.deck || a.summary).slice(0, 110),
          whatsapp: `*${article.title}*\n${hook.slice(0, 150)}\n\nBaca: mbcindonesia.tv`,
          thumbnail_suggestion: `Gunakan foto ${a.places[0] || 'lokasi'} + teks besar 3–5 kata; hindari wajah anak di bawah umur.`
        },
        findings
      };
    }
  },

  seo: {
    id: 'seo', name: 'SEO & Keterbacaan', role: 'Optimasi penemuan', icon: '⌕', color: '#a3e635',
    description: 'Menilai struktur judul, subjudul, panjang paragraf, kata kunci, dan saran internal link.',
    run(article) {
      const a = analyzeText(article);
      const findings = [];
      const paragraphs = String(article.body || '').split(/\n{2,}/).filter(Boolean);
      const longParas = paragraphs.filter(p => words(p).length > 90).length;
      if (longParas) findings.push({ severity: 'saran', title: `${longParas} paragraf terlalu panjang`, detail: 'Pecah paragraf > 90 kata agar nyaman dibaca di ponsel.' });
      if (paragraphs.length < 3) findings.push({ severity: 'saran', title: 'Struktur naskah terlalu pendek', detail: 'Gunakan 4+ paragraf: fakta utama, konteks, kutipan, tindak lanjut.' });
      const kw = a.keywords[0];
      const density = kw ? (a.full.toLowerCase().split(kw).length - 1) / (a.wordCount || 1) * 100 : 0;
      if (kw && density > 4) findings.push({ severity: 'peringatan', title: 'Kata kunci terlalu padat', detail: `“${kw}” muncul ${(density).toFixed(1)}% dari total kata (ideal < 3%). Variasikan sinonimi.` });
      if (!article.seo_title) findings.push({ severity: 'saran', title: 'Judul SEO belum diisi', detail: 'Isi judul 50–60 karakter yang memuat kata kunci utama.' });
      return { output: { primary_keyword: kw, keyword_density: +density.toFixed(2), paragraphs: paragraphs.length, long_paragraphs: longParas, reading_grade: a.wordCount > 400 ? 'menengah' : 'mudah', suggested_internal_links: a.places.slice(0, 3).map(p => `tag:${p}`) }, findings };
    }
  },

  peliputan: {
    id: 'peliputan', name: 'Rencana Peliputan', role: 'Perencana & tindak lanjut', icon: '◈', color: '#60a5fa',
    description: 'Mengusulkan sudut lanjutan, narasumber, pertanyaan wawancara, dan jadwal tindak lanjut.',
    run(article) {
      const a = analyzeText(article);
      const findings = [];
      const followUps = [];
      if (/banjir|cuaca|bencana/i.test(a.full)) followUps.push('Laporan kondisi 48 jam setelah peringatan (dampak nyata vs prediksi).', 'Cek kesiapan posko & jalur evakuasi kelurahan terdampak.');
      if (/upah|UMK|tenaga kerja/i.test(a.full)) followUps.push('Wawancara pekerja berpenghasilan terendah: cukup untuk kebutuhan bulanan?', 'Minta rincian formula & data survei pasar yang dipakai Dewan Pengupahan.');
      if (/kopi|ekspor|koperasi|UMKM/i.test(a.full)) followUps.push('Hitung margin petani vs eksportir; tampilkan harga jual di tingkat petani.', 'Cek kapasitas roastery lokal untuk pengolahan sekunder.');
      if (/AI|teknologi|redaksi/i.test(a.full)) followUps.push('Uji nyata akurasi alat AI pada 5 naskah — minta bukti uji, bukan klaim vendor.', 'Tanyakan kebijakan tertulis soal AI ke dewan pers/kampus jurnalistik.');
      if (/pendidikan|kuliah|digital/i.test(a.full)) followUps.push('Bandingkan biaya kuliah vs upah awal lulusan di kota ini.', 'Cek akses internet mahasiswa di kecamatan pinggiran.');
      if (!followUps.length) followUps.push('Kembangkan sisi data: cari pembanding periode sebelumnya untuk menilai arah tren.');
      const experts = [];
      if (/banjir|cuaca/i.test(a.full)) experts.push('BMKG Stasiun Klimatologi Jatim', 'BPBD Kota/Kabupaten', 'Akademisi hidrologi');
      if (/upah|tenaga kerja/i.test(a.full)) experts.push('Dewan Pengupahan Kota', 'Apindo Jatim', 'Serikat pekerja');
      if (/kopi|ekspor/i.test(a.full)) experts.push('Koperasi petani', 'Dinas Perdagangan', 'Praktisi rantai pasok pangan');
      if (!experts.length) experts.push('Akademisi terkait', 'Otoritas setempat');
      findings.push({ severity: 'info', title: `${followUps.length} sudut lanjutan diusulkan`, detail: followUps.join(' '), evidence: followUps });
      return {
        output: {
          follow_ups: followUps,
          experts,
          interview_questions: [
            'Apa angka paling dasar yang mendasari pernyataan ini, dan dari mana sumbernya?',
            'Siapa yang paling terdampak bila kebijakan/temuan ini berlanjut?',
            'Apa pembandingnya dengan periode atau wilayah lain?',
            'Apa langkah konkret 30 hari ke depan & siapa penanggung jawabnya?'
          ],
          monitor_topics: [...new Set([...(article.tags || []), ...a.places.slice(0, 2)])].slice(0, 6)
        },
        findings
      };
    }
  }
};

/* ---------- orkestrasi ---------- */
function runAgent(agentId, article, library) {
  const agent = AGENTS[agentId];
  if (!agent) throw new Error('Agen tidak dikenal: ' + agentId);
  const t0 = Date.now();
  const { output, findings } = agent.run(article, library);
  return { agent: agentId, output, findings: findings || [], duration_ms: Date.now() - t0 };
}

function runPipeline(article, library, agentIds) {
  const ids = agentIds && agentIds.length ? agentIds : Object.keys(AGENTS);
  return ids.map(id => runAgent(id, article, library));
}

/* agen prioritas untuk "sweep" (hemat waktu): hanya yang berpotensi kritikal */
const SWEEP_ORDER = ['fakta', 'etika', 'hukum', 'ringkas'];

module.exports = { AGENTS, runAgent, runPipeline, SWEEP_ORDER, analyzeText };
