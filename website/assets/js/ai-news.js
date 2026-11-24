/* ============================================================
   ai-news.js — Mesin analisis berita MBC INDONESIA
   ------------------------------------------------------------
   Berjalan SEPENUHNYA DI SISI KLIEN (tanpa kunci API, tanpa kirim
   data pengunjung ke pihak ketiga — sesuai UU PDP). Isinya:
     1. Korpus berita (data terstruktur) + indeks pencarian
     2. Analisis: ringkasan extractive, entitas, sentimen, topik,
        kata kunci, pembaca-tokoh, kronologi, klaim perlu verifikasi
     3. Pencarian literasi/rujukan (multi-bahasa, per-tipe sumber)
     4. Klasifikasi pertanyaan pengunjung (intent router)
   Dipakai oleh companion pengunjung (index.html) dan Newsroom.
   ============================================================ */
'use strict';

const MBC_NEWS = (() => {

  /* ---------- 1. KORPUS ---------- */
  const articles = [
    {
      id: 'n-bmkg-kediri-banjir',
      title: 'BMKG Peringatkan Hujan Ekstrem Sepekan ke Depan di Jawa Timur',
      kicker: 'Kebencanaan',
      topic: 'lingkungan',
      place: 'Kediri, Jawa Timur',
      date: '2026-11-21',
      author: 'Tim MBC Newsroom',
      video: 'jejak-nusantara',
      img: 'assets/img/hero.jpg',
      deck: 'Curah hujan di wilayah Kediri dan sekitarnya diprediksi 40% di atas normal, warga diimbau bersiap menghadapi genangan dan potensi banjir.',
      body: [
        'Badan Meteorologi, Klimatologi, dan Geofisika (BMKG) mengeluarkan peringatan dini cuaca ekstrem untuk wilayah Jawa Timur selama sepekan ke depan. Menurut analisis BMKG, curah hujan di Kediri, Blitar, dan Trenggalek diperkirakan 30 hingga 40 persen di atas rata-rata normal.',
        'Kepala Stasiun Klimatologi Jawa Timur menyebut potensi banjir dan genangan meningkat pada sore hingga malam hari. Pemerintah Kota Kediri mengimbau warga membersihkan saluran air serta menyiapkan tas siaga bencana berisi dokumen penting, obat-obatan, dan air minum.',
        'Tahun lalu, wilayah Kota Kediri sempat dilanda genangan setinggi 60 sentimeter akibat hujan deras selama enam jam. Pemkot mencatat sekitar 1.200 rumah terdampak dan kerugian ekonomi ditaksir Rp 4,7 miliar.',
        'MBC INDONESIA akan menyiarkan pembaruan cuaca setiap dua jam melalui kanal Live TV serta laporan langsung dari posko kelurahan jika status darurat diaktifkan.'
      ],
      claims: [
        'Curah hujan 30–40% di atas normal (sumber: BMKG, perlu dikonfirmasi laporan resmi tertulis)',
        'Kerugian tahun lalu Rp 4,7 miliar (sumber internal redaksi — perlu dokumen BPBD)'
      ],
      tags: ['BMKG', 'cuaca ekstrem', 'banjir', 'Kediri', 'Jawa Timur', 'mitigasi bencana']
    },
    {
      id: 'n-umk-jatim',
      title: 'Upah Minimum Kota Kediri 2027 Diusulkan Naik 6,5 Persen',
      kicker: 'Ekonomi',
      topic: 'ekonomi',
      place: 'Kediri, Jawa Timur',
      date: '2026-11-20',
      author: 'Redaksi Ekonomi',
      video: 'ruang-bisnis',
      img: 'assets/img/kabar-nusantara.jpg',
      deck: 'Dewan Pengupahan Kota mengusulkan kenaikan UMK berdasarkan inflasi dan pertumbuhan ekonomi daerah, sementara kalangan pengusaha meminta penyesuaian bertahap.',
      body: [
        'Dewan Pengupahan Kota Kediri mengusulkan kenaikan Upah Minimum Kota (UMK) tahun 2027 sebesar 6,5 persen. Usulan ini disusun berdasarkan formula yang mempertimbangkan inflasi kota, pertumbuhan ekonomi, serta indeks pembangunan manusia.',
        'Sekretaris Asosiasi Pengusaha Indonesia (Apindo) Jawa Timur meminta pemerintah mempertimbangkan daya tahan usaha kecil. "Kenaikan 6,5 persen masih dapat dicerna industri besar, tetapi sektor mikro butuh penyesuaian bertahap," katanya dalam panel MBC Ruang Bisnis.',
        'Perwakilan serikat pekerja menyebut usulan tersebut masih di bawah kebutuhan hidup layak. Serikat menuntut acuan evaluasi berupa survei pasar yang diperbarui setiap kuartal, seperti yang sudah dilakukan beberapa kabupaten.',
        'Penetapan UMK dijadwalkan pertengahan Desember 2026 melalui rapat final Dewan Pengupahan. Selisih antara kebutuhan hidup layak dan usulan masih menjadi titik perdebatan utama.',
        'Analisis MBC: kenaikan upah berpotensi menambah daya beli rumah tangga kota, namun tanpa pertumbuhan produktivitas akan menekan margin sektor padat karya seperti garmen dan pengolahan makanan.'
      ],
      claims: [
        'Usulan 6,5 persen (perlu dokumen rapat Dewan Pengupahan)',
        'Selisih KHL vs usulan (perlu angka resmi survei pasar terbaru)'
      ],
      tags: ['UMK', 'upah minimum', 'tenaga kerja', 'Apindo', 'serikat pekerja', 'Kediri']
    },
    {
      id: 'n-produksi-dokumenter',
      title: 'Produksi Dokumenter Kali Brantas Masuk Tahap Penyuntingan Akhir',
      kicker: 'Produksi',
      topic: 'budaya',
      place: 'Kediri',
      date: '2026-11-19',
      author: 'Desk Produksi',
      video: 'jejak-nusantara',
      img: 'assets/img/jejak-nusantara.jpg',
      deck: 'Dokumenter yang mengangkat kehidupan warga di bantaran Sungai Brantas memasuki tahap akhir penyuntingan sebelum tayang awal Desember.',
      body: [
        'Tim produksi MBC INDONESIA menyebut dokumenter perjalanan Sungai Brantas telah rampung 80 persen dalam proses penyuntingan. Pengambilan gambar dilakukan di lima titik mulai dari sumber mata air di Malang hingga hilir di Surabaya.',
        'Produser eksekutif menjelaskan bahwa film ini menonjolkan suara warga setempat, mulai dari petani, pengrajin, hingga relawan lingkungan. Narasi tidak dioverlap dengan narator untuk berjarak, melainkan mengikuti percakapan asli.',
        'Pengambilan gambar drone di bendungan menambah kesulitan teknis karena kondisi angin kencang. Kru juga mengandalkan sinar alami untuk menjaga warna khas musim kemarau.',
        'Dokumenter dijadwalkan tayang di slot prime time dan akan dilengkapi artikel pendukung serta pemutaran diskusi di kampus-kampus di Kediri.'
      ],
      claims: ['Progres 80 persen (sumber: desk produksi internal)'],
      tags: ['dokumenter', 'Sungai Brantas', 'produksi', 'Kediri', 'lingkungan']
    },
    {
      id: 'n-ai-redaksi',
      title: 'Redaksi Media Lokal Mulai Mengadopsi AI untuk Riset dan Verifikasi',
      kicker: 'Teknologi',
      topic: 'teknologi',
      place: 'Jakarta',
      date: '2026-11-18',
      author: 'Redaksi Teknologi',
      video: 'bicara-petang',
      img: 'assets/img/bicara-petang.jpg',
      deck: 'Sejumlah ruang redaksi memakai kecerdasan artifisial untuk mempercepat riset latar dan penelusuran dokumen, namun tetap menempatkan verifikasi pada manusia.',
      body: [
        'Sekitar 42 persen ruang redaksi media lokal di Indonesia sudah menggunakan alat kecerdasan artifisial untuk penelusuran latar, menurut survei yang dirilis sebuah lembaga riset media pekan ini. Penggunaan terbanyak ada pada peringkasan dokumen dan pencarian arsip.',
        'Praktisi jurnalisme mengingatkan risiko halusinasi, yaitu keluaran yang terdengar meyakinkan tetapi salah. Karena itu, alur kerja diubah agar AI hanya berperan pada tahap prapenulisan, bukan menjadi sumber fakta tunggal.',
        'Sejumlah media mulai menuliskan kebijakan AI di newsroom, misalnya kewajiban menyebutkan penggunaan alat bantu AI dan larangan memasukkan data narasumber sensitif ke layanan pihak ketiga.',
        'Guru besar jurnalistik menyebut transparansi sebagai kunci. "Pembaca tidak menolak teknologi, yang ditolak adalah sikap membiarkan otomatisasi tanpa tanggung jawab editorial," ujarnya dalam diskusi Bicara Petang.'
      ],
      claims: [
        'Survei 42 persen (perlu keterangan metodologi survei yang dikutip)',
        'Nama lembaga riset belum disebutkan secara spesifik — perlu verifikasi'
      ],
      tags: ['AI', 'jurnalisme', 'redaksi', 'survei', 'literasi digital', 'verifikasi']
    },
    {
      id: 'n-kopi-kediri',
      title: 'Kopi Robusta Kediri Tembus Pasar Eropa Lewat Koperasi Petani',
      kicker: 'Ekonomi Kreatif',
      topic: 'ekonomi',
      place: 'Kediri–Kertosono',
      date: '2026-11-17',
      author: 'Redaksi Ekonomi',
      video: 'dapur-rempah',
      img: 'assets/img/dapur-rempah.jpg',
      deck: 'Koperasi petani kopi robusta Kediri mengirim kontainer perdana ke Belanda setelah dua tahun pendampingan mutu dan sertifikasi.',
      body: [
        'Koperasi Tani Makmur mengirim kontainer kopi robusta perdana ke Belanda dengan total 18 ton green bean. Ekspor ini menjadi penanda masuknya petani kecil ke rantai pasok lintas negara melalui skema kolektif.',
        'Pendampingan berlangsung dua tahun meliputi fermentasi terkontrol, pengeringan kadar air 12 persen, serta sertifikasi dasar sehingga mutu lebih konsisten dan harga tawar meningkat 22 persen.',
        'Pemerintah kabupaten menyatakan akan mengalokasikan bantuan peralatan pengolahan kolektif dan memperluas akses pasar digital, agar model koperasi dapat direplikasi di desa lain.',
        'Analisis MBC: nilai tambah terbesar ada pada pengolahan sekunder (roasting dan pengemasan), bukan hanya bahan mentah. Tanpa peningkatan kapasitas roastery lokal, sebagian besar margin tetap tertinggal di luar wilayah.'
      ],
      claims: [
        'Ekspor 18 ton (perlu dokumen koperasi)',
        'Kenaikan harga 22 persen (perlu pembanding harga periode sebelumnya)'
      ],
      tags: ['kopi', 'robusta', 'ekspor', 'koperasi', 'Kediri', 'UMKM', 'pasar Eropa']
    },
    {
      id: 'n-diaspora-hongkong',
      title: 'Diaspora Indonesia di Hong Kong Buka Kelas Bahasa untuk Pekerja Migran',
      kicker: 'Internasional',
      topic: 'internasional',
      wilayah: 'internasional',
      place: 'Hong Kong SAR',
      date: '2026-11-20',
      author: 'Koresponden MBC Asia',
      video: 'bicara-petang',
      img: 'assets/img/bicara-petang.jpg',
      deck: 'Komunitas diaspora Indonesia di Hong Kong menggelar kelas bahasa, literasi keuangan, dan pendampingan hukum gratis setiap akhir pekan.',
      body: [
        'Sejumlah organisasi diaspora Indonesia di Hong Kong SAR membuka kelas bahasa dan literasi keuangan bagi pekerja migran Indonesia setiap Sabtu dan Minggu. Kegiatan ini diikuti sekitar 180 peserta pada gelaran terakhir.',
        'Materi kelas mencakup penyusunan anggaran keluarga, pemahaman kontrak kerja, dan jalur pelaporan jika menghadapi masalah ketenagakerjaan. Pengajar berasal dari kalangan diaspora yang berlatar pendidikan hukum dan akuntansi.',
        'Konsulat Jenderal RI di Hong Kong menyambut baik inisiatif tersebut dan menawarkan kanal pendampingan hukum bagi peserta yang membutuhkan bantuan lanjutan.',
        'MBC INDONESIA akan menghadirkan laporan lanjutan dari jaringan koresponden Asia pada kanal Internasional serta program Bicara Petang.'
      ],
      claims: [
        'Jumlah peserta 180 orang (sumber: panitia komunitas, perlu konfirmasi tertulis)',
        'Pendampingan hukum oleh KJRI (perlu konfirmasi siaran pers)'
      ],
      tags: ['diaspora', 'pekerja migran', 'Hong Kong', 'literasi keuangan', 'internasional']
    },
    {
      id: 'n-pasar-pahing',
      title: 'Pasar Pahing Kediri Tambah Zona UMKM Digital dan Layanan Pembayaran Nontunai',
      kicker: 'Daerah',
      topic: 'ekonomi',
      wilayah: 'kediri',
      place: 'Kediri, Jawa Timur',
      date: '2026-11-19',
      author: 'Redaksi Daerah',
      video: 'kamera-komunitas',
      img: 'assets/img/kamera-komunitas.jpg',
      deck: 'Pedagang Pasar Pahing mendapat pendampingan QRIS dan pencatatan stok digital; 240 lapak mengikuti program percontohan.',
      body: [
        'Pemerintah Kota Kediri bersama penyedia jasa pembayaran meluncurkan zona UMKM digital di Pasar Pahing. Sebanyak 240 lapak mengikuti program percontohan dengan dukungan QRIS, pencatatan stok sederhana, dan pelatihan foto produk.',
        'Pedagang menyebut transaksi nontunai mempermudah pembeli muda, meski sebagian masih membutuhkan pendampingan teknis pada pekan pertama. Tim pendamping berjaga setiap hari pasar.',
        'Dinas perdagangan menargetkan seluruh lapak terhubung sistem pembayaran nontunai pada pertengahan 2027, disertai pemantauan harga bahan pokok harian.',
        'MBC INDONESIA melalui program Kamera Komunitas akan meliput perkembangan program ini setiap bulan dari pasar-pasar tradisional di Kediri dan sekitarnya.'
      ],
      claims: [
        'Jumlah 240 lapak (sumber: dinas perdagangan, perlu daftar resmi)',
        'Target 2027 (pernyataan pejabat, perlu dokumen perencanaan)'
      ],
      tags: ['Pasar Pahing', 'UMKM', 'QRIS', 'Kediri', 'daerah', 'ekonomi digital']
    },
    {
      id: 'n-data-pendidikan',
      title: 'Angka Partisipasi Kuliah di Jawa Timur Naik, Kesiapan Digital Jadi Sorotan',
      kicker: 'Pendidikan',
      topic: 'pendidikan',
      place: 'Jawa Timur',
      date: '2026-11-16',
      author: 'Redaksi Pendidikan',
      video: 'panggung-musik',
      img: 'assets/img/panggung-musik.jpg',
      deck: 'Angka partisipasi kuliah naik tiga poin, tetapi kesenjangan keterampilan digital antarwilayah masih lebar.',
      body: [
        'Data dinas pendidikan mencatat angka partisipasi kasar pendidikan tinggi di Jawa Timur naik tiga poin dalam dua tahun terakhir. Namun sebarannya masih terkonsentrasi di kota besar seperti Surabaya dan Malang.',
        'Kesiapan digital lulusan dinilai belum merata. Kampus yang berada di wilayah dengan akses internet terbatas menghadapi keterbatasan laboratorium dan pengajar praktik.',
        'Program pelatihan gratis yang dipelopori pemerintah menjadi instrumen utama pemerataan, dengan fokus pada keterampilan analisis data, literasi media, dan produksi konten.',
        'Pengamat pendidikan menilai kolaborasi kampus, industri, dan media lokal seperti MBC dapat mempercepat transfer keterampilan tanpa harus selalu menunggu anggaran besar.'
      ],
      claims: ['Kenaikan tiga poin (perlu tabulasi resmi)'],
      tags: ['pendidikan', 'perguruan tinggi', 'literasi digital', 'Jawa Timur']
    }
  ];

  /* ---------- 2. INDEKS & UTIL ---------- */
  const STOP = new Set(['yang','dan','di','ke','dari','untuk','dengan','pada','dalam','adalah','ini','itu','akan','juga','tidak','bisa','ada','agar','karena','serta','oleh','sebagai','para','atau','lebih','telah','masih','bagi','saat','tahun','kata','ujar','menurut','sebut']);
  const norm = s => String(s || '').toLowerCase().replace(/[^\w\sà-ÿ-]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = s => norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w));

  function stem(w) {
    // stemming ringan bahasa Indonesia (cukup untuk pencarian)
    return w.replace(/^(me|mem|men|meng|pen|pem|di|ber|ter)/, '').replace(/(kannya|annya|nya|kan|an|i|lah)$/, '');
  }

  // TF-IDF sederhana untuk kemiripan & kata kunci
  const docs = articles.map(a => ({ id: a.id, text: norm([a.title, a.deck, a.body.join(' '), (a.tags || []).join(' ')].join(' ')) }));
  const df = {};
  docs.forEach(d => { new Set(tokens(d.text).map(stem)).forEach(t => df[t] = (df[t] || 0) + 1); });
  const idf = t => Math.log((docs.length + 1) / ((df[t] || 0) + 1)) + 1;

  // peta stem → bentuk permukaan yang paling sering muncul (untuk ditampilkan)
  const SURFACE = {};
  docs.forEach(d => tokens(d.text).forEach(w => { const st = stem(w); SURFACE[st] = SURFACE[st] || {}; SURFACE[st][w] = (SURFACE[st][w] || 0) + 1; }));
  function surface(st) {
    const cands = SURFACE[st];
    if (!cands) return st;
    return Object.entries(cands).sort((a, b) => b[1] - a[1])[0][0];
  }
  function tfidf(text) {
    const tf = {}; tokens(text).map(stem).forEach(t => tf[t] = (tf[t] || 0) + 1);
    return Object.entries(tf).map(([t, n]) => [t, n * idf(t)]).sort((a, b) => b[1] - a[1]);
  }
  const vec = text => { const v = {}; tfidf(text).forEach(([t, w]) => v[t] = w); return v; };
  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (const k in a) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; }
    for (const k in b) nb += b[k] * b[k];
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }

  /* ---------- 3. SENTIMEN ---------- */
  const POS = ['naik','untung','tumbuh','berhasil','sukses','baik','positif','menang','apresiasi','naikkan','cerah','terbantu','meningkat','tembus','perluas','bangga','harapan','dorong','pulih','aman','stabil','terpuji'];
  const NEG = ['turun','rugi','gagal','buruk','krisis','ancaman','rawan','bahaya','konflik','sengketa','tekan','terdampak','kerugian','peringatan','tuntut','masalah','kekurangan','terbatas','menurun','risiko','dilarang','lonjakan'];
  function sentiment(text) {
    const t = tokens(text);
    let pos = 0, neg = 0;
    t.forEach(w => {
      const s = stem(w);
      if (POS.some(p => s.startsWith(stem(p)))) pos++;
      else if (NEG.some(n => s.startsWith(stem(n)))) neg++;
    });
    const total = pos + neg || 1;
    const score = (pos - neg) / total;
    const label = score > 0.25 ? 'positif' : score < -0.25 ? 'negatif' : 'netral';
    return { label, score: Math.round(score * 100), pos, neg, tone: `${label.toUpperCase()} ${score > 0 ? '+' : ''}${Math.round(score * 100)}` };
  }

  /* ---------- 4. ENTITAS ---------- */
  const ORG = ['BMKG','Pemkot','Pemerintah','Apindo','Koperasi Tani Makmur','Dewan Pengupahan','MBC INDONESIA','BPBD','Dinas Pendidikan','Serikat Pekerja','Asosiasi Pengusaha'];
  const LOC = ['Kediri','Blitar','Trenggalek','Jawa Timur','Malang','Surabaya','Kertosono','Nganjuk','Belanda','Jakarta','Indonesia','Eropa'];
  const NUM = /\b(\d+([.,]\d+)?\s?(persen|%|ton|sentimeter|rumah|miliar|juta|orang|poin|hari|jam|kontainer|desa|kota))\b/gi;
  function entities(text) {
    const found = { organizations: [], places: [], numbers: [] };
    ORG.forEach(o => { if (text.includes(o)) found.organizations.push(o); });
    LOC.forEach(l => { if (text.includes(l)) found.places.push(l); });
    [...text.matchAll(NUM)].forEach(m => found.numbers.push(m[1].trim()));
    return found;
  }

  /* ---------- 5. RINGKASAN EKSTRAKTIF ---------- */
  function summarize(text, maxSent = 3) {
    const sents = String(text).split(/(?<=[.!?])\s+/)
      .map(s => s.trim()).filter(s => s.split(' ').length > 6 && !/[|—]$/.test(s));
    if (!sents.length) return String(text).slice(0, 240);
    const scored = sents.map((s, i) => {
      const t = tokens(s);
      let score = t.length ? t.reduce((acc, w) => acc + idf(stem(w)), 0) / Math.sqrt(t.length) : 0;
      if (i === 0) score *= 1.25;                        // kalimat pembuka biasanya ringkasan
      if (/\d/.test(s)) score *= 1.08;                   // kalimat berangka lebih informatif
      if (/menurut|kata|ujar|sebut/i.test(s)) score *= 0.95; // atribusi netral
      return { s, i, score };
    }).sort((a, b) => b.score - a.score).slice(0, maxSent).sort((a, b) => a.i - b.i);
    return scored.map(x => x.s).join(' ');
  }

  /* ---------- 6. ANALISIS LENGKAP ---------- */
  function analyze(idOrText) {
    const isId = typeof idOrText === 'string' && articles.some(a => a.id === idOrText);
    const a = isId ? articles.find(x => x.id === idOrText) : null;
    const text = a ? a.body.join(' ') : String(idOrText || '');
    const fullText = a ? [a.title, a.deck, ...a.body].join(' ') : text;
    const t0 = performance.now ? performance.now() : Date.now();
    const result = {
      article: a ? { id: a.id, title: a.title, kicker: a.kicker, topic: a.topic, place: a.place, date: a.date, author: a.author } : null,
      summary: summarize(a ? a.body.join(' ') : text, 3),
      sentiment: sentiment(fullText),
      entities: entities(fullText),
      keywords: tfidf(fullText).slice(0, 8).map(([t]) => surface(t)),
      claims: a ? a.claims : [],
      readingTime: Math.max(1, Math.round(String(text).split(' ').length / 220)) + ' menit',
      related: a ? articles.filter(x => x.id !== a.id)
        .map(x => ({ id: x.id, title: x.title, sim: +cosine(vec(fullText), vec([x.title, x.deck, x.body.join(' ')].join(' '))).toFixed(3) }))
        .sort((x, y) => y.sim - x.sim).slice(0, 3) : [],
      timeline: a ? a.date : null,
      engine: 'lokal-deterministik',
      ms: Math.round((performance.now ? performance.now() : Date.now()) - t0),
      notes: 'Analisis dijalankan di perangkat pengunjung; tidak ada data yang dikirim ke server.'
    };
    return result;
  }

  /* ---------- 7. PENCARIAN LITERASI / RUJUKAN ---------- */
  const SOURCE_TYPES = [
    { id: 'semua', label: 'Semua' },
    { id: 'regulasi', label: 'Regulasi' },
    { id: 'data', label: 'Data & Statistik' },
    { id: 'akademik', label: 'Akademik' },
    { id: 'episode', label: 'Episode MBC' },
    { id: 'organisasi', label: 'Lembaga' }
  ];
  // Basis rujukan (kurasi redaksi). URL opsional — tautan situs resmi.
  const LIBRARY = [
    { id:'bmkg', t:'BMKG — Meteorologi, Klimatologi & Geofisika', typ:'organisasi', topics:['lingkungan','cuaca ekstrem','banjir'], note:'Peringatan dini cuaca, data curah hujan, dan analisis iklim per wilayah.', url:'https://www.bmkg.go.id/' },
    { id:'bnpb', t:'BNPB — Data Informasi Bencana Indonesia', typ:'data', topics:['banjir','mitigasi bencana','lingkungan'], note:'Catatan kejadian bencana, korban, dan kerugian per kabupaten/kota.', url:'https://bnpb.go.id/' },
    { id:'bps', t:'BPS — Badan Pusat Statistik', typ:'data', topics:['ekonomi','upah minimum','tenaga kerja','pendidikan'], note:'Inflasi, upah, ketenagakerjaan, indikator pendidikan per provinsi.', url:'https://www.bps.go.id/' },
    { id:'kemnaker', t:'Kemnaker — Pedoman Upah Minimum', typ:'regulasi', topics:['UMK','upah minimum','tenaga kerja'], note:'Formula penetapan UMK/UMP, PP pengupahan, dan aturan turunannya.', url:'https://kemnaker.go.id/' },
    { id:'ojk', t:'OJK — Literasi Keuangan', typ:'organisasi', topics:['ekonomi','keuangan'], note:'Panduan literasi dan perlindungan konsumen keuangan.', url:'https://www.ojk.go.id/' },
    { id:'kemendikbud', t:'Kemendikbudristek — Statistik Pendidikan', typ:'data', topics:['pendidikan','literasi digital'], note:'Angka partisipasi, rasio dosen, dan program pemerataan pendidikan.', url:'https://www.kemdikbud.go.id/' },
    { id:'pdp', t:'UU No. 27/2022 — Perlindungan Data Pribadi', typ:'regulasi', topics:['privasi','teknologi','AI'], note:'Dasar hukum pemrosesan data, hak subjek data, dan kewajiban pengendali.', url:'https://peraturan.bpk.go.id/' },
    { id:'kemenkop', t:'Kementerian Koperasi — Panduan UMKM Ekspor', typ:'regulasi', topics:['kopi','koperasi','ekspor','UMKM'], note:'Skema sertifikasi, penguatan koperasi, dan fasilitasi ekspor UMKM.', url:'https://kemenkopukm.go.id/' },
    { id:'jurnal-jurnalisme', t:'Studi: Adopsi AI di Ruang Redaksi Lokal', typ:'akademik', topics:['AI','jurnalisme','redaksi','verifikasi'], note:'Kajian empiris tentang alur kerja redaksi berbantuan AI dan risiko halusinasi.', url:'' },
    { id:'jurnal-iklim', t:'Studi: Pola Hujan Ekstrem Jawa Timur', typ:'akademik', topics:['lingkungan','cuaca ekstrem','banjir','Jawa Timur'], note:'Analisis tren curah hujan ekstrem dan implikasinya bagi kota sedang.', url:'' },
    { id:'ep-nusantara', t:'Episode: Jejak Nusantara — Sungai Brantas', typ:'episode', topics:['dokumenter','Sungai Brantas','budaya','lingkungan'], note:'Dokumenter MBC INDONESIA tentang kehidupan warga bantaran Brantas.', url:'watch.html?id=jejak-nusantara' },
    { id:'ep-rempah', t:'Episode: Dapur Rempah — Kopi Kediri', typ:'episode', topics:['kopi','Kediri','UMKM','ekonomi'], note:'Laporan perjalanan rantai nilai kopi robusta dari kebun ke pasar.', url:'watch.html?id=dapur-rempah' },
    { id:'ep-petang', t:'Episode: Bicara Petang — AI & Jurnalisme', typ:'episode', topics:['AI','jurnalisme','teknologi','redaksi'], note:'Diskusi praktisi soal adopsi AI, transparansi, dan etika editorial.', url:'watch.html?id=bicara-petang' }
  ];

  function searchLiteracy(query, type = 'semua') {
    const qVec = vec(query);
    const qt = new Set(tokens(query).map(stem));
    return LIBRARY
      .map(item => {
        const hay = new Set([...tokens(item.t + ' ' + item.note + ' ' + item.topics.join(' ')).map(stem)]);
        let overlap = 0; qt.forEach(t => { if (hay.has(t)) overlap++; });
        const topicBoost = item.topics.some(tp => norm(query).includes(norm(tp))) ? 0.35 : 0;
        const sim = cosine(qVec, vec(item.t + ' ' + item.note + ' ' + item.topics.join(' ')));
        return { ...item, sim: +(sim + topicBoost + overlap * 0.05).toFixed(3) };
      })
      .filter(x => (type === 'semua' ? true : x.typ === type))
      .filter(x => x.sim > 0.02)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 6)
      .map(x => ({ ...x, typLabel: (SOURCE_TYPES.find(s => s.id === x.typ) || {}).label || x.typ, match: Math.min(99, Math.round(x.sim * 100)) }));
  }

  /* ---------- 8. CARI ARTIKEL ---------- */
  function searchArticles(query, limit = 5) {
    const qVec = vec(query);
    return articles.map(a => ({ ...a, sim: +cosine(qVec, vec([a.title, a.deck, ...a.body, a.tags.join(' ')].join(' '))).toFixed(3) }))
      .filter(a => a.sim > 0.01 || norm(a.title).includes(norm(query)))
      .sort((a, b) => b.sim - a.sim).slice(0, limit);
  }

  /* ---------- 9. ROUTER NIAT PENGUNJUNG ---------- */
  function route(query) {
    const q = norm(query);
    if (/^(hai|halo|hi|selamat|pagi|siang|malam|assalam)/.test(q)) return 'greet';
    if (/(bantuan|bisa apa|fitur|cara pakai|help)/.test(q)) return 'help';
    if (/(tonton|live|siaran|jadwal|streaming|channel)/.test(q)) return 'watch';
    if (/(pengunjung|redaksi|newsroom|kerja sama|iklan|kontak|karier)/.test(q)) return 'contact';
    if (/(referensi|literasi|sumber|jurnal|regulasi|peraturan|rujukan|bacaan)/.test(q)) return 'literacy';
    if (/(analisis|analisa|sentimen|ringkas|rangkum|ringkasan|entitas|kata kunci|siapa|apa itu|kenapa|mengapa|dampak)/.test(q)) return 'analysis';
    return 'search';
  }

  return {
    articles, LIBRARY, SOURCE_TYPES,
    analyze, summarize, sentiment, entities, searchLiteracy, searchArticles, route,
    /* Pemetaan rubrik (URL: berita.html?rubrik=daerah) ke topik artikel */
    RUBRIK_TOPIC: {
      daerah: ['ekonomi', 'lingkungan', 'budaya', 'pendidikan'],
      nasional: ['ekonomi', 'lingkungan', 'teknologi', 'pendidikan'],
      internasional: ['internasional'],
      budaya: ['budaya'],
      teknologi: ['teknologi'],
      ekonomi: ['ekonomi'],
      pendidikan: ['pendidikan']
    },
    articlesByRubrik: function (rubrik) {
      var t = this.RUBRIK_TOPIC[rubrik];
      if (!t) return this.articles.slice();
      return this.articles.filter(function (a) { return t.indexOf(a.topic) >= 0; });
    },
    articlesByWilayah: function (wilayah) {
      if (!wilayah) return this.articles.slice();
      return this.articles.filter(function (a) {
        if (a.wilayah) return a.wilayah === wilayah;
        return (a.place || '').toLowerCase().indexOf(wilayah) >= 0;
      });
    },
    topics: [...new Set(articles.map(a => a.topic))],
    topicsLabel: { lingkungan: 'Lingkungan', ekonomi: 'Ekonomi', budaya: 'Budaya', teknologi: 'Teknologi', pendidikan: 'Pendidikan', internasional: 'Internasional' }
  };
})();

if (typeof window !== 'undefined') window.MBC_NEWS = MBC_NEWS;
