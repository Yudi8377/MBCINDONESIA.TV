/* ============================================================
   agen-ai.js — Lapisan AI hibrida untuk 6 agen spesialis editorial
   ------------------------------------------------------------
   Prinsip:
     1. MESIN LOKAL SELALU JALAN. Tanpa kunci API pun keenam agen
        menghasilkan keluaran lengkap & deterministik (bisa diaudit,
        naskah tidak keluar dari server MBC).
     2. LLM OPSIONAL. Bila LLM_PROVIDER + kunci diisi, hasil agen
        diperkaya oleh model (ringkasan, klarifikasi, usulan sudut).
        Bila LLM gagal/timeout, otomatis jatuh ke mesin lokal —
        tidak pernah membuat halaman error.
     3. Semua keluaran LLM DIBATASI: JSON terstruktur, ukuran kecil,
        tidak boleh mengarang kutipan/sumber (dilarang eksplisit di prompt),
        ditandai sumbernya: "lokal" / "llm" / "hibrida".

   Endpoint LLM yang didukung (semua gaya OpenAI chat/completions):
     - OpenAI          LLM_PROVIDER=openai     LLM_API_KEY=sk-...
     - Groq            LLM_PROVIDER=groq       LLM_API_KEY=gsk_...
     - OpenRouter      LLM_PROVIDER=openrouter LLM_API_KEY=sk-or-...
     - Together        LLM_PROVIDER=together
     - DeepSeek        LLM_PROVIDER=deepseek
     - Ollama lokal    LLM_PROVIDER=ollama     LLM_BASE_URL=http://127.0.0.1:11434/v1
   Variabel opsional: LLM_MODEL, LLM_BASE_URL, LLM_TIMEOUT_MS,
   LLM_BATAS_HARIAN (kuota panggilan/hari, default 200).
   ============================================================ */
'use strict';

/* ---------- util teks (dipakai mesin lokal) ---------- */
const STOP = new Set(['yang','dan','di','ke','dari','untuk','dengan','pada','dalam','adalah','ini','itu','akan','juga','tidak','bisa','ada','agar','karena','serta','oleh','sebagai','para','atau','lebih','telah','masih','bagi','saat','tahun','kata','ujar','menurut','sebut','secara','hal','dapat','sebuah','dua','satu','jika','bila','serta','maupun','namun','tetapi','sedang','sudah','belum','sangat','serta']);
const norm = s => String(s || '').toLowerCase().replace(/[^\w\sà-ÿ.,%-]/g, ' ').replace(/\s+/g, ' ').trim();
const kata = s => norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w));
const kalimat = s => String(s || '').split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 20);
const jumlahKata = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
/* stemming ringan: jangan memotong bila sisa kata jadi terlalu pendek
   (dulu "hujan" → "huj" sehingga kata kunci jadi tidak bermakna) */
const akar = w => {
  const asli = String(w);
  let x = asli.replace(/^(mem|men|meng|meny|pen|pem|peng|per|ber|ter|di|me)/, '');
  if (x.length < 4) x = asli;
  const tanpaAkhir = x.replace(/(kannya|annya|nya|kan|an|i|lah)$/, '');
  return tanpaAkhir.length >= 4 ? tanpaAkhir : x;
};

const ANGKA = /(\d[\d.,]*)\s*(persen|%|juta|miliar|triliun|ton|ribu|orang|rumah|hektare|ha|km|kilometer|sentimeter|cm|poin|hari|jam|bulan|tahun|kontainer|desa|unit|siswa|mahasiswa|petani|keluarga)/gi;
const ATRIBUSI = /(menurut|kata|ujar|sebut|data|survei|rilis|laporan|menurut\s+\w+|dasarkan|mengacu|merujuk)/i;
const KABUR = /\b(dilaporkan|disebutkan|diketahui|sumber\s+menyebut|konon|kabarnya|katanya|beredar|viral\s+di\s+media\s+sosial)\b/gi;
const RAGU = /\b(diduga|kemungkinan|sepertinya|mungkin|tampaknya|berpotensi|diperkirakan|diharapkan|bisa\s+jadi)\b/gi;
const CLICKBAIT = /\b(heboh|geger|viral|mengejutkan|bikin\s+geram|wajib\s+tahu|ternyata\s+ini|jangan\s+sampai|auto\s+sultan|no\s*1|bikin\s+syaraf|menggemparkan|sensasional)\b/gi;
const SENSITIF = /\b(korban|tersangka|pelaku|anak\s+di\s+bawah\s+umur|identitas|almarhum|pemerkosaan|narkoba|bunuh\s+diri|NIK|KTP|nomor\s+rekening|nomor\s+telepon|alamat\s+lengkap)\b/i;
const PRAduga = /\b(praduga\s+tak\s+bersalah|belum\s+dibuktikan|putusan\s+pengadilan|berhak\s+didampingi|masih\s+proses\s+hukum)\b/i;
const TEMPAT = /\b(Kediri|Blitar|Trenggalek|Tulungagung|Nganjuk|Madiun|Bojonegoro|Surabaya|Malang|Jember|Banyuwangi|Sidoarjo|Gresik|Jawa\s+Timur|Jatim|Jakarta|Bandung|Indonesia|Hong\s+Kong|Malaysia|Singapura|Eropa|Belanda|ASEAN|Brantas|Bromo)\b/g;
const ORGANISASI = /\b(PT|CV|Bank|Pemkot|Pemkab|Pemerintah|Kementerian|Kemenpora|Dinas|Badan|BMKG|BPS|Bappenas|Koperasi|Asosiasi|Universitas|Kampus|Polres|Polda|Kejaksaan|KPK|DPRD|BPBD|Apindo|OJK|KPU)\b/;

/* korpus rujukan ringkas untuk mesin lokal (boleh ditambah tim redaksi) */
const RUJUKAN = [
  { topik: ['cuaca', 'banjir', 'bencana', 'iklim', 'lingkungan'], nama: 'BMKG — Prakiraan & Peringatan Dini', url: 'https://www.bmkg.go.id/', jenis: 'data resmi', catatan: 'Cek peringatan dini, curah hujan, dan analisis iklim per wilayah sebelum menulis soal cuaca.' },
  { topik: ['bencana', 'banjir', 'evakuasi'], nama: 'BNPB — DIBI (Data Informasi Bencana Indonesia)', url: 'https://dibi.bnpb.go.id/', jenis: 'data resmi', catatan: 'Bandingkan jumlah terdampak/pengungsi dengan catatan resmi, bukan klaim lisan.' },
  { topik: ['statistik', 'data', 'ekonomi', 'pendidikan', 'upah'], nama: 'BPS — Statistik Indonesia & Jawa Timur', url: 'https://www.bps.go.id/', jenis: 'data resmi', catatan: 'Angka makro (inflasi, UMP, partisipasi sekolah) wajib disandingkan dengan rilis BPS.' },
  { topik: ['upah', 'tenaga kerja', 'umk'], nama: 'Kemnaker — Pengupahan', url: 'https://kemnaker.go.id/', jenis: 'regulasi', catatan: 'Dasar hukum upah minimum: PP 36/2021 dan turunannya; sebut nomor aturan, bukan hanya angka.' },
  { topik: ['kopi', 'ekspor', 'koperasi', 'umkm', 'pasar'], nama: 'Kementan / Kemendag — Data ekspor komoditas', url: 'https://kemendag.go.id/', jenis: 'data resmi', catatan: 'Volume & nilai ekspor per komoditas tersedia per bulan; hindari menyebut angka tanpa periode.' },
  { topik: ['teknologi', 'ai', 'digital', 'data pribadi'], nama: 'UU PDP No. 27/2022', url: 'https://peraturan.bpk.go.id/', jenis: 'regulasi', catatan: 'Setiap penyebutan data pribadi wajib punya dasar & tujuan yang jelas.' },
  { topik: ['pers', 'redaksi', 'etika', 'jurnalistik'], nama: 'Kode Etik Jurnalistik (Dewan Pers)', url: 'https://dewanpers.or.id/', jenis: 'kode etik', catatan: 'Uji praduga tak bersalah, hak jawab, dan larangan plagiarisme terhadap naskah.' },
  { topik: ['pemilu', 'politik', 'pilkada'], nama: 'KPU — Data pemilu & pilkada', url: 'https://www.kpu.go.id/', jenis: 'data resmi', catatan: 'Sebutkan periode dan tingkat kontestasi; hindari menyamakan survei dengan hasil resmi.' },
  { topik: ['pendidikan', 'kuliah', 'sekolah', 'kampus'], nama: 'Kemendikbudristek / PDDikti', url: 'https://pddikti.kemdikbud.go.id/', jenis: 'data resmi', catatan: 'Data partisipasi & akreditasi tersedia publik; cocok untuk berita pendidikan.' },
  { topik: ['hukum', 'korupsi', 'pidana'], nama: 'Mahkamah Agung — Direktori Putusan', url: 'https://putusan3.mahkamahagung.go.id/', jenis: 'dokumen hukum', catatan: 'Cek status perkara pada putusan resmi sebelum menyebut status hukum seseorang.' }
];

/* ---------- konfigurasi LLM ---------- */
const PROVIDER = {
  openai:     { base: 'https://api.openai.com/v1',              model: 'gpt-4o-mini' },
  groq:       { base: 'https://api.groq.com/openai/v1',         model: 'llama-3.1-8b-instant' },
  openrouter: { base: 'https://openrouter.ai/api/v1',           model: 'openai/gpt-4o-mini' },
  together:   { base: 'https://api.together.xyz/v1',            model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  deepseek:   { base: 'https://api.deepseek.com/v1',            model: 'deepseek-chat' },
  ollama:     { base: 'http://127.0.0.1:11434/v1',              model: 'llama3.1' }
};

const llm = {
  get provider() { return String(process.env.LLM_PROVIDER || '').toLowerCase().trim(); },
  get kunci() { return process.env.LLM_API_KEY || ''; },
  get aktif() {
    const p = this.provider;
    if (!PROVIDER[p]) return false;
    if (p === 'ollama') return true;                 /* lokal, tanpa kunci */
    return !!this.kunci;
  },
  get model() { return process.env.LLM_MODEL || (PROVIDER[this.provider] || {}).model || ''; },
  get base() { return (process.env.LLM_BASE_URL || (PROVIDER[this.provider] || {}).base || '').replace(/\/$/, ''); },
  get timeout() { return Number(process.env.LLM_TIMEOUT_MS || 20000); },
  batasHarian: Number(process.env.LLM_BATAS_HARIAN || 200),
  catatan: { hari: '', dipakai: 0 }
};

function kuotaTersisa() {
  const hariIni = new Date().toISOString().slice(0, 10);
  if (llm.catatan.hari !== hariIni) { llm.catatan = { hari: hariIni, dipakai: 0 }; }
  return Math.max(0, llm.batasHarian - llm.catatan.dipakai);
}

/* status untuk ditampilkan di UI/dokumentasi (tanpa membocorkan kunci) */
function statusLLM() {
  return {
    aktif: llm.aktif,
    provider: llm.provider || null,
    model: llm.aktif ? llm.model : null,
    base_url_terisi: !!llm.base,
    kunci_terisi: !!llm.kunci,
    kuota_harian: llm.batasHarian,
    sisa_hari_ini: kuotaTersisa(),
    catatan: llm.aktif
      ? 'Agen memakai LLM untuk pengayaan; mesin lokal tetap menjadi cadangan otomatis.'
      : 'Belum ada LLM_API_KEY untuk provider yang didukung — keenam agen berjalan 100% dengan mesin lokal (gratis, deterministik).'
  };
}

/* panggil LLM bergaya OpenAI chat/completions. Mengembalikan { ok, data } — tidak pernah melempar. */
async function panggilLLM({ system, user, json = true, maxTokens = 900 }) {
  if (!llm.aktif) return { ok: false, alasan: 'llm_tidak_aktif' };
  if (kuotaTersisa() <= 0) return { ok: false, alasan: 'kuota_harian_habis' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), llm.timeout);
  try {
    const r = await fetch(llm.base + '/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(llm.kunci ? { Authorization: 'Bearer ' + llm.kunci } : {}),
        'HTTP-Referer': 'https://mbcindonesia-tv.vercel.app',
        'X-Title': 'MBC Newsroom Agents'
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.2,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
      })
    });
    llm.catatan.dipakai++;
    if (!r.ok) return { ok: false, alasan: 'http_' + r.status };
    const d = await r.json();
    const teks = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    if (!teks) return { ok: false, alasan: 'balasan_kosong' };
    if (!json) return { ok: true, data: teks };
    try { return { ok: true, data: JSON.parse(teks) }; }
    catch (_) { return { ok: false, alasan: 'balasan_bukan_json' }; }
  } catch (e) {
    return { ok: false, alasan: e.name === 'AbortError' ? 'timeout' : 'jaringan' };
  } finally { clearTimeout(t); }
}

/* ---------- konteks artikel untuk prompt (dipotong, hemat token) ---------- */
function konteksArtikel(a, maksKata = 700) {
  const isi = String(a.body || '').split(/\s+/).slice(0, maksKata).join(' ');
  return [
    'JUDUL: ' + (a.title || ''),
    'DEK: ' + (a.deck || ''),
    'KANAL: ' + (a.channel || a.channel_name || '-'),
    'TAG: ' + (Array.isArray(a.tags) ? a.tags.join(', ') : '-'),
    'SUMBER TERCATAT: ' + (Array.isArray(a.sources) ? a.sources.map(s => s.title || s.url || '-').join(' | ') : 'tidak ada'),
    'ISI: ' + isi
  ].join('\n');
}

const ATURAN_PROMPT = [
  'Anda asisten redaksi MBC Indonesia. Bekerja HANYA untuk staf editorial internal.',
  'JANGAN mengarang kutipan, nama narasumber, angka, atau tautan yang tidak ada di naskah.',
  'Bila data tidak ada di naskah, tulis "perlu konfirmasi" alih-alih menebak.',
  'Jawab dalam bahasa Indonesia, ringkas, dan patuhi skema JSON yang diminta.',
  'Anda tidak menerbitkan apa pun; keputusan akhir manusia.'
].join(' ');

/* ---------- 6 AGEN SPESIALIS ----------
   Setiap agen: id, nama, peran, ikon, warna, deskripsi,
   lokal(artikel) → { ringkas, data, temuan[] },
   prompt(artikel)  → { system, user } untuk pengayaan LLM,
   gabung(lokal, llmData) → keluaran akhir.
------------------------------------------ */
const AGEN = {

  /* 1. PENCARI BERITA — radar bahan liputan baru */
  riset: {
    id: 'riset', nama: 'Pencari Berita', peran: 'Riset & radar isu', ikon: '🔎', warna: '#60a5fa',
    deskripsi: 'Memetakan isu, sudut yang belum digarap, kata kunci pemantauan, dan pertanyaan riset dari naskah/isu.',
    lokal(a) {
      const teks = [a.title, a.deck, a.body, (a.tags || []).join(' ')].join(' ');
      const kunci = [...new Set(kata(teks).map(akar))].slice(0, 12);
      const tempat = [...new Set(teks.match(TEMPAT) || [])];
      const angka = [...new Set((teks.match(ANGKA) || []).map(s => s.trim()))].slice(0, 8);
      const sudut = [];
      if (/banjir|cuaca|hujan/i.test(teks)) sudut.push('Bandingkan prakiraan BMKG dengan kondisi lapangan 48 jam setelah peringatan.');
      if (/upah|umk|tenaga\s+kerja/i.test(teks)) sudut.push('Uji daya beli: upah baru vs harga kebutuhan pokok sebulan terakhir.');
      if (/kopi|ekspor|koperasi/i.test(teks)) sudut.push('Hitung margin petani vs eksportir; tampilkan harga di tingkat petani.');
      if (/ai|teknologi|digital/i.test(teks)) sudut.push('Minta bukti uji akurasi alat AI, bukan klaim vendor.');
      if (/pendidikan|kuliah|kampus/i.test(teks)) sudut.push('Bandingkan biaya kuliah dengan upah awal lulusan di kota yang sama.');
      if (/pasar|umkm|dagang/i.test(teks)) sudut.push('Cek omzet harian pedagang sebelum vs sesudah program.');
      if (!sudut.length) sudut.push('Cari pembanding periode sebelumnya untuk melihat arah tren.');
      const pemantau = [...new Set([...kunci.slice(0, 6), ...tempat.map(t => t.toLowerCase())])].slice(0, 8);
      return {
        ringkas: `${kata(teks).length ? 'Isu utama' : 'Naskah'} terdeteksi pada ${tempat.length ? tempat.join(', ') : 'lingkup umum'} dengan ${kunci.length} kata kunci riset.`,
        data: { kata_kunci: kunci, wilayah: tempat, angka_penting: angka, sudut_belum_digarap: sudut, pantau: pemantau,
          pertanyaan_riset: [
            'Apa angka paling dasar pada isu ini dan siapa yang merilisnya?',
            'Siapa pihak paling terdampak yang belum diwawancarai?',
            'Apa pembanding periode/wilayah lain untuk isu yang sama?'
          ] },
        temuan: sudut[0] ? [{ tingkat: 'info', judul: `${sudut.length} sudut liputan belum digarap`, rincian: sudut.join(' ') }] : []
      };
    },
    prompt: a => ({ user: `Naskah:\n${konteksArtikel(a)}\n\nSkema JSON: {"ringkas":string,"sudut_belum_digarap":[string],"kata_kunci":[string],"pertanyaan_riset":[string],"pemantau":[string]}` }),
    gabung(l, d) {
      if (!d) return l;
      return { ...l, ringkas: d.ringkas || l.ringkas,
        data: { ...l.data,
          sudut_belum_digarap: Array.isArray(d.sudut_belum_digarap) && d.sudut_belum_digarap.length ? d.sudut_belum_digarap.slice(0, 6) : l.data.sudut_belum_digarap,
          kata_kunci: Array.isArray(d.kata_kunci) && d.kata_kunci.length ? d.kata_kunci.slice(0, 12) : l.data.kata_kunci,
          pertanyaan_riset: Array.isArray(d.pertanyaan_riset) && d.pertanyaan_riset.length ? d.pertanyaan_riset.slice(0, 6) : l.data.pertanyaan_riset,
          pemantau: Array.isArray(d.pemantau) && d.pemantau.length ? d.pemantau.slice(0, 10) : l.data.pemantau } };
    }
  },

  /* 2. VERIFIKATOR & KLARIFIKASI */
  klarifikasi: {
    id: 'klarifikasi', nama: 'Verifikator & Klarifikasi', peran: 'Cek fakta & hak jawab', ikon: '🛡️', warna: '#ff5245',
    deskripsi: 'Memilah klaim berangka/atributif, menilai kelengkapan sumber, menyusun langkah klarifikasi & hak jawab.',
    lokal(a) {
      const teks = [a.title, a.deck, a.body].join(' ');
      const kal = kalimat(a.body || '');
      const klaim = [];
      kal.forEach(s => {
        const angka = s.match(ANGKA);
        if (angka && angka.length) klaim.push({ jenis: 'angka', klaim: s.slice(0, 200), bukti_diminta: `Rilis resmi untuk angka: ${angka.slice(0, 3).join(', ')}` });
        else if (ATRIBUSI.test(s)) klaim.push({ jenis: 'atribusi', klaim: s.slice(0, 200), bukti_diminta: 'Nama, jabatan, dan dokumen/kutipan resmi narasumber' });
        else if (KABUR.test(s)) klaim.push({ jenis: 'kabur', klaim: s.slice(0, 200), bukti_diminta: 'Ganti "dilaporkan/disebutkan" dengan sumber yang bisa disebut' });
      });
      const sumber = Array.isArray(a.sources) ? a.sources : [];
      const cek = Array.isArray(a.fact_checks) ? a.fact_checks : [];
      const tertunda = cek.filter(c => !c.status || c.status === 'menunggu');
      const langkah = [];
      if (!sumber.length) langkah.push('Tambahkan minimal 2 sumber tertulis (dokumen resmi/kutipan) sebelum lolos tahap fakta.');
      else if (sumber.length < 2) langkah.push('Sumber masih tunggal — cari satu sumber independen pembanding.');
      if (klaim.filter(k => k.jenis === 'angka').length) langkah.push('Cocokkan setiap angka dengan rilis resmi dan sebutkan periode datanya.');
      if (klaim.filter(k => k.jenis === 'kabur').length) langkah.push('Ganti atribusi kabur ("dilaporkan", "beredar") dengan sumber bernama atau hapus.');
      if (!/hak\s+jawab|dihubungi|konfirmasi/i.test(teks)) langkah.push('Hubungi pihak yang diberitakan untuk hak jawab dan catat waktu serta responsnya.');
      if (!langkah.length) langkah.push('Klaim utama sudah bersumber; cukup lengkapi tanggal akses dokumen.');
      const skor = Math.max(0, Math.min(100, 100 - klaim.filter(k => k.jenis === 'kabur').length * 15 - (sumber.length ? 0 : 35) - tertunda.length * 10));
      return {
        ringkas: `${klaim.length} klaim perlu bukti; ${sumber.length} sumber tercatat; ${tertunda.length} klaim belum diverifikasi.`,
        data: { klaim: klaim.slice(0, 8), sumber_tercatat: sumber.length, klaim_tertunda: tertunda.length, langkah_klarifikasi: langkah, skor_kesiapan: skor,
          status: skor >= 80 ? 'siap' : skor >= 55 ? 'perlu perbaikan' : 'belum layak tayang' },
        temuan: [
          ...(sumber.length ? [] : [{ tingkat: 'kritis', judul: 'Belum ada sumber tercatat', rincian: 'Artikel tanpa sumber tidak boleh lolos tahap fakta.' }]),
          ...(klaim.filter(k => k.jenis === 'kabur').length ? [{ tingkat: 'peringatan', judul: 'Atribusi kabur terdeteksi', rincian: klaim.filter(k => k.jenis === 'kabur').map(k => k.klaim).join(' · '), bukti: klaim.filter(k => k.jenis === 'kabur').map(k => k.klaim) }] : []),
          ...(tertunda.length ? [{ tingkat: 'peringatan', judul: `${tertunda.length} klaim belum diverifikasi`, rincian: 'Isi status tiap klaim pada panel Verifikasi Fakta.' }] : [])
        ]
      };
    },
    prompt: a => ({ user: `Naskah:\n${konteksArtikel(a)}\n\nTugas: daftar klaim yang WAJIB diklarifikasi dan langkahnya. Jangan mengarang sumber.\nSkema JSON: {"ringkas":string,"klaim":[{"klaim":string,"jenis":"angka|atribusi|kabur","bukti_diminta":string}],"langkah_klarifikasi":[string],"status":"siap|perlu perbaikan|belum layak tayang"}` }),
    gabung(l, d) {
      if (!d) return l;
      const klaimLLM = Array.isArray(d.klaim) ? d.klaim.filter(k => k && k.klaim).slice(0, 8) : [];
      const gab = [...l.data.klaim];
      klaimLLM.forEach(k => { if (!gab.some(g => String(g.klaim).slice(0, 60) === String(k.klaim).slice(0, 60))) gab.push({ jenis: k.jenis || 'atribusi', klaim: k.klaim, bukti_diminta: k.bukti_diminta || 'perlu konfirmasi', oleh: 'llm' }); });
      return { ...l, ringkas: d.ringkas || l.ringkas,
        data: { ...l.data, klaim: gab.slice(0, 10),
          langkah_klarifikasi: Array.isArray(d.langkah_klarifikasi) && d.langkah_klarifikasi.length ? d.langkah_klarifikasi.slice(0, 8) : l.data.langkah_klarifikasi,
          status: ['siap', 'perlu perbaikan', 'belum layak tayang'].includes(d.status) ? d.status : l.data.status } };
    }
  },

  /* 3. PENYUNTING NASKAH */
  penyunting: {
    id: 'penyunting', nama: 'Penyunting Naskah', peran: 'Suntingan & struktur', ikon: '✍️', warna: '#2fd27a',
    deskripsi: 'Menilai struktur (lead, konteks, kutipan, tindak lanjut), panjang kalimat/paragraf, dan memberi suntingan konkret.',
    lokal(a) {
      const isi = String(a.body || '');
      const par = isi.split(/\n{2,}/).filter(Boolean);
      const kal = kalimat(isi);
      const panjangKal = kal.filter(s => jumlahKata(s) > 32);
      const panjangPar = par.filter(p => jumlahKata(p) > 90);
      const kataTotal = jumlahKata(isi);
      const saran = [];
      if (!par.length || jumlahKata(par[0] || '') > 60) saran.push('Lead terlalu panjang — pecah menjadi 2 kalimat: apa yang terjadi + mengapa penting.');
      if (!/["“”]/.test(isi)) saran.push('Belum ada kutipan langsung. Tambahkan minimal satu kutipan bernama untuk menghidupkan naskah.');
      if (!/selanjutnya|ke depan|langkah|rencana|target/i.test(isi)) saran.push('Belum ada tindak lanjut ("apa selanjutnya") di penutup.');
      if (panjangKal.length) saran.push(`${panjangKal.length} kalimat melebihi 32 kata — pecah agar mudah dibaca di ponsel.`);
      if (panjangPar.length) saran.push(`${panjangPar.length} paragraf melebihi 90 kata — pecah per ide.`);
      if (kataTotal < 250) saran.push(`Naskah ${kataTotal} kata — berita utilitas biasanya 300–500 kata.`);
      if (!saran.length) saran.push('Struktur sudah baik: lead ringkas, ada kutipan, dan tindak lanjut jelas.');
      const lead = par[0] ? par[0].slice(0, 220) : '';
      return {
        ringkas: `${kataTotal} kata · ${par.length} paragraf · ${kal.length} kalimat.`,
        data: { kata: kataTotal, paragraf: par.length, kalimat: kal.length, rata_kata_per_kalimat: kal.length ? +(kataTotal / kal.length).toFixed(1) : 0,
          kalimat_panjang: panjangKal.length, paragraf_panjang: panjangPar.length, lead_saat_ini: lead, suntingan: saran,
          waktu_baca_menit: Math.max(1, Math.round(kataTotal / 220)) },
        temuan: saran.filter(s => !/sudah baik/i.test(s)).slice(0, 3).map(s => ({ tingkat: 'saran', judul: 'Suntingan naskah', rincian: s }))
      };
    },
    prompt: a => ({ user: `Naskah:\n${konteksArtikel(a)}\n\nTugas: suntingan konkret (bukan menulis ulang seluruh naskah). Jangan menambah fakta baru.\nSkema JSON: {"ringkas":string,"lead_usulan":string,"suntingan":[string],"judul_usulan":[string]}` }),
    gabung(l, d) {
      if (!d) return l;
      return { ...l, ringkas: d.ringkas || l.ringkas,
        data: { ...l.data,
          lead_usulan: d.lead_usulan || l.data.lead_saat_ini,
          suntingan: Array.isArray(d.suntingan) && d.suntingan.length ? d.suntingan.slice(0, 8) : l.data.suntingan,
          judul_usulan: Array.isArray(d.judul_usulan) ? d.judul_usulan.slice(0, 3) : [] } };
    }
  },

  /* 4. SEO & JUDUL */
  seo: {
    id: 'seo', nama: 'SEO & Judul', peran: 'Penemuan & distribusi', ikon: '⌕', warna: '#a3e635',
    deskripsi: 'Menyusun judul & meta description, menilai kepadatan kata kunci, dan menyiapkan judul push/sosial.',
    lokal(a) {
      const teks = [a.title, a.deck, a.body].join(' ');
      const freq = {};
      kata(teks).forEach(w => { const s = akar(w); freq[s] = (freq[s] || 0) + 1; });
      const kataKunci = Object.entries(freq).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k]) => k);
      const utama = kataKunci[0] || '';
      const total = jumlahKata(teks) || 1;
      const kepadatan = utama ? +(((teks.toLowerCase().split(utama).length - 1) / total) * 100).toFixed(2) : 0;
      const judul = String(a.title || '');
      const seoJudul = judul.length > 60 ? judul.slice(0, 57).trim() + '…' : judul;
      const meta = (a.deck || String(a.body || '').slice(0, 150)).slice(0, 155);
      const pushJudul = judul.length > 55 ? judul.slice(0, 52) + '…' : judul;
      const temuan = [];
      if (judul.length > 70) temuan.push({ tingkat: 'peringatan', judul: 'Judul terlalu panjang', rincian: `${judul.length} karakter; mesin pencari memotong ±60. Usulan: “${seoJudul}”.` });
      if (kepadatan > 4) temuan.push({ tingkat: 'peringatan', judul: 'Kepadatan kata kunci terlalu tinggi', rincian: `“${utama}” ${kepadatan}% (ideal < 3%). Variasikan sinonimi.` });
      if (!a.seo_desc) temuan.push({ tingkat: 'saran', judul: 'Meta description belum diisi', rincian: `Usulan: “${meta}” (${meta.length} karakter, target 120–158).` });
      if ((a.tags || []).length < 3) temuan.push({ tingkat: 'saran', judul: 'Tag terlalu sedikit', rincian: `${(a.tags || []).length} tag. Tambahkan minimal 3 agar mudah ditemukan.` });
      return {
        ringkas: `Kata kunci utama “${utama || '-'}” · ${kepadatan}% kepadatan · ${(a.tags || []).length} tag.`,
        data: { kata_kunci: kataKunci, kata_kunci_utama: utama, kepadatan_persen: kepadatan, judul_seo: seoJudul, meta_description: meta,
          judul_push: pushJudul, hashtag: (a.tags || []).slice(0, 4).map(t => '#' + String(t).replace(/\s+/g, '')), panjang_judul: judul.length },
        temuan
      };
    },
    prompt: a => ({ user: `Naskah:\n${konteksArtikel(a)}\n\nSkema JSON: {"ringkas":string,"judul_usulan":[string],"meta_description":string,"kata_kunci":[string],"catatan_seo":[string]}` }),
    gabung(l, d) {
      if (!d) return l;
      return { ...l, ringkas: d.ringkas || l.ringkas,
        data: { ...l.data,
          judul_usulan: Array.isArray(d.judul_usulan) ? d.judul_usulan.slice(0, 3) : [],
          meta_description: d.meta_description ? String(d.meta_description).slice(0, 158) : l.data.meta_description,
          kata_kunci: Array.isArray(d.kata_kunci) && d.kata_kunci.length ? d.kata_kunci.slice(0, 8) : l.data.kata_kunci,
          catatan_seo: Array.isArray(d.catatan_seo) ? d.catatan_seo.slice(0, 6) : [] } };
    }
  },

  /* 5. HUKUM & ETIKA */
  etika: {
    id: 'etika', nama: 'Hukum & Etika', peran: 'Kepatuhan & risiko', ikon: '⚖️', warna: '#c792ea',
    deskripsi: 'Memeriksa clickbait, praduga tak bersalah, data pribadi (UU PDP), dan kewajiban hak jawab.',
    lokal(a) {
      const teks = [a.title, a.deck, a.body].join(' ');
      const temuan = [];
      const cb = [...new Set((teks.match(CLICKBAIT) || []).map(s => s.toLowerCase()))];
      if (cb.length) temuan.push({ tingkat: 'kritis', judul: 'Frasa clickbait', rincian: `Ganti: ${cb.join(', ')}. Judul harus informatif, bukan memancing klik.`, bukti: cb });
      const pidana = /\b(tersangka|pelaku|korupsi|mencuri|menipu|memerkosa|membunuh|narkoba)\b/i.test(teks);
      if (pidana && !PRAduga.test(teks)) temuan.push({ tingkat: 'kritis', judul: 'Praduga tak bersalah belum disebut', rincian: 'Berita dugaan pidana wajib memuat frasa praduga tak bersalah & status proses hukum.' });
      const pribadi = (teks.match(SENSITIF) || [])[0];
      if (pribadi) temuan.push({ tingkat: 'kritis', judul: 'Potensi pelanggaran UU PDP No. 27/2022', rincian: `Data sensitif terdeteksi (“${pribadi}”). Hapus/samarkan sebelum tayang.` });
      if (!/hak\s+jawab|dihubungi|konfirmasi/i.test(teks) && /\b(dituduh|diduga|dilaporkan|dituding)\b/i.test(teks)) temuan.push({ tingkat: 'peringatan', judul: 'Belum ada jejak hak jawab', rincian: 'Tambahkan kalimat bahwa pihak terkait telah dihubungi beserta responsnya.' });
      const superlatif = /\b(satu-satunya|terbaik|terburuk|paling)\b/i.test(teks) && !ATRIBUSI.test(teks);
      if (superlatif) temuan.push({ tingkat: 'saran', judul: 'Klaim superlatif tanpa dasar', rincian: 'Sertakan rujukan data atau ubah menjadi pernyataan bersumber.' });
      const skor = Math.max(0, 100 - temuan.filter(t => t.tingkat === 'kritis').length * 30 - temuan.filter(t => t.tingkat === 'peringatan').length * 12 - temuan.filter(t => t.tingkat === 'saran').length * 4);
      return {
        ringkas: `${temuan.length} catatan kepatuhan · skor ${skor}/100.`,
        data: { skor_kepatuhan: skor, clickbait: cb, data_pribadi: pribadi || null, praduga_tak_bersalah: pidana ? PRAduga.test(teks) : null,
          rekomendasi: temuan.length ? temuan.map(t => t.judul) : ['Tidak ada pelanggaran etika/hukum yang terdeteksi pada pemeriksaan otomatis.'] },
        temuan
      };
    },
    prompt: a => ({ user: `Naskah:\n${konteksArtikel(a)}\n\nSkema JSON: {"ringkas":string,"risiko":[{"judul":string,"tingkat":"kritis|peringatan|saran","rincian":string}],"rekomendasi":[string],"skor_kepatuhan":number}` }),
    gabung(l, d) {
      if (!d) return l;
      const risiko = Array.isArray(d.risiko) ? d.risiko.filter(r => r && r.judul).slice(0, 6) : [];
      const tambahan = risiko.map(r => ({ tingkat: ['kritis', 'peringatan', 'saran'].includes(r.tingkat) ? r.tingkat : 'saran', judul: r.judul, rincian: r.rincian || '', oleh: 'llm' }));
      return { ...l, ringkas: d.ringkas || l.ringkas,
        data: { ...l.data,
          rekomendasi: Array.isArray(d.rekomendasi) && d.rekomendasi.length ? d.rekomendasi.slice(0, 6) : l.data.rekomendasi,
          skor_kepatuhan: Number.isFinite(d.skor_kepatuhan) ? Math.max(0, Math.min(100, d.skor_kepatuhan)) : l.data.skor_kepatuhan },
        temuan: [...l.temuan, ...tambahan] };
    }
  },

  /* 6. ANALIS DATA & PEMBANDING */
  data: {
    id: 'data', nama: 'Analis Data', peran: 'Angka & pembanding', ikon: '📊', warna: '#f2c14e',
    deskripsi: 'Menghimpun angka penting, menandai klaim tanpa periode/pembanding, dan menyarankan data pembanding resmi.',
    lokal(a) {
      const teks = [a.title, a.deck, a.body].join(' ');
      const angka = [...new Set((teks.match(ANGKA) || []).map(s => s.trim()))];
      const adaPersen = angka.filter(x => /%|persen/i.test(x));
      const satuan = {};
      angka.forEach(x => { const u = (x.match(/[a-zA-Z%]+/) || ['lain'])[0].toLowerCase(); satuan[u] = (satuan[u] || 0) + 1; });
      const tanpaPeriode = angka.filter(x => !/(20\d\d|tahun|bulan|triwulan|semester|kuartal|periode)/i.test(teks));
      const temuan = [];
      if (angka.length && tanpaPeriode.length) temuan.push({ tingkat: 'peringatan', judul: 'Angka tanpa periode jelas', rincian: `${tanpaPeriode.length} dari ${angka.length} angka tidak disertai periode/tahun. Sebutkan rentang waktu data.` });
      if (adaPersen.length && !/dibanding|naik|turun|dari\s+\d|vs|sebelumnya|pembanding/i.test(teks)) temuan.push({ tingkat: 'saran', judul: 'Persentase tanpa pembanding', rincian: 'Angka persen tanpa basis pembanding sulit dinilai pembaca. Tambahkan angka sebelumnya atau basisnya.' });
      const rujukan = RUJUKAN.filter(r => r.topik.some(t => teks.toLowerCase().includes(t))).slice(0, 4)
        .map(r => ({ nama: r.nama, url: r.url, jenis: r.jenis, catatan: r.catatan }));
      if (!angka.length) temuan.push({ tingkat: 'info', judul: 'Tidak ada angka terdeteksi', rincian: 'Berita berbasis data akan lebih kuat bila memuat minimal satu angka bersumber.' });
      const ringkas = angka.length ? `${angka.length} angka penting (${adaPersen.length} persen) · ${rujukan.length} sumber data pembanding.` : 'Belum ada angka terukur pada naskah.';
      return { ringkas, data: { angka_penting: angka.slice(0, 12), satuan, persen: adaPersen, angka_tanpa_periode: tanpaPeriode.length, sumber_pembanding: rujukan },
        temuan };
    },
    prompt: a => ({ user: `Naskah:\n${konteksArtikel(a)}\n\nSkema JSON: {"ringkas":string,"angka_penting":[string],"pembanding_disarankan":[string],"catatan_data":[string]}` }),
    gabung(l, d) {
      if (!d) return l;
      return { ...l, ringkas: d.ringkas || l.ringkas,
        data: { ...l.data,
          angka_penting: Array.isArray(d.angka_penting) && d.angka_penting.length ? d.angka_penting.slice(0, 12) : l.data.angka_penting,
          pembanding_disarankan: Array.isArray(d.pembanding_disarankan) ? d.pembanding_disarankan.slice(0, 6) : [],
          catatan_data: Array.isArray(d.catatan_data) ? d.catatan_data.slice(0, 6) : [] } };
    }
  }
};

const DAFTAR_AGEN = Object.values(AGEN).map(a => ({
  id: a.id, nama: a.nama, peran: a.peran, ikon: a.ikon, warna: a.warna, deskripsi: a.deskripsi
}));

/* ---------- jalankan satu agen (hibrida) ---------- */
async function jalankanAgen(agentId, artikel, opsi = {}) {
  const agen = AGEN[agentId];
  if (!agen) throw new Error('Agen tidak dikenal: ' + agentId);
  const t0 = Date.now();
  const lokal = agen.lokal(artikel || {});
  let hasil = lokal, sumber = 'lokal', catatanLLM = null, llmData = null;

  const mauLLM = opsi.pakaiLLM !== false && llm.aktif;
  if (mauLLM) {
    const p = agen.prompt(artikel || {});
    const r = await panggilLLM({
      system: ATURAN_PROMPT + ` Peran Anda: ${agen.nama} (${agen.peran}).`,
      user: p.user,
      maxTokens: opsi.maxTokens || 900
    });
    if (r.ok && r.data && typeof r.data === 'object') {
      llmData = r.data;
      hasil = agen.gabung(lokal, llmData) || lokal;
      sumber = 'hibrida';
    } else {
      catatanLLM = r.alasan || 'gagal';
      sumber = 'lokal';
    }
  }
  return {
    agent: agen.id, nama: agen.nama, ikon: agen.ikon, warna: agen.warna,
    ringkas: hasil.ringkas, data: hasil.data, temuan: hasil.temuan || [],
    sumber, catatan_llm: catatanLLM, durasi_ms: Date.now() - t0
  };
}

/* ---------- jalankan beberapa agen sekaligus (paralel, dibatasi) ---------- */
async function jalankanBanyak(agentIds, artikel, opsi = {}) {
  const ids = (agentIds && agentIds.length ? agentIds : DAFTAR_AGEN.map(a => a.id)).filter(id => AGEN[id]);
  const batas = Math.max(1, Math.min(6, Number(opsi.paralel || (llm.aktif ? 2 : 6))));
  const hasil = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(batas, ids.length) }, async () => {
    while (i < ids.length) {
      const id = ids[i++];
      try { hasil.push(await jalankanAgen(id, artikel, opsi)); }
      catch (e) { hasil.push({ agent: id, error: e.message, sumber: 'lokal', temuan: [], durasi_ms: 0 }); }
    }
  }));
  const urut = ids.map(id => hasil.find(h => h.agent === id)).filter(Boolean);
  return urut;
}

/* ---------- pencarian cepat di korpus internal (dipakai agen & UI) ---------- */
function cariArtikel(korpus, kueri, batas = 8) {
  const q = kata(kueri).map(akar);
  if (!q.length) return [];
  return (korpus || []).map(a => {
    const teks = [a.title, a.deck, a.body, (a.tags || []).join(' '), a.channel].join(' ');
    const hay = new Set(kata(teks).map(akar));
    const skor = q.reduce((n, w) => n + (hay.has(w) ? 1 : 0), 0);
    return { artikel: a, skor };
  }).filter(x => x.skor > 0).sort((a, b) => b.skor - a.skor).slice(0, batas)
    .map(x => ({ id: x.artikel.id, slug: x.artikel.slug, judul: x.artikel.title, status: x.artikel.status, skor: x.skor }));
}

module.exports = {
  AGEN, DAFTAR_AGEN, jalankanAgen, jalankanBanyak, statusLLM, cariArtikel,
  RUJUKAN, konteksArtikel, ATURAN_PROMPT
};
