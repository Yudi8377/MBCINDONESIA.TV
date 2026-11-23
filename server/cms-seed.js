/* cms-seed.js — data contoh Newsroom (idempotent; aman dijalankan berulang).
   Jalankan: node cms-seed.js   (butuh schema.sql + cms-schema.sql sudah dimuat) */
'use strict';
const { AGENTS } = require('./agents');
const { pool } = require('./db');

const CHANNELS = [
  ['nasional', 'Nasional', 'nasional', 'Politik, hukum, dan kebijakan publik', '#e63329', 1],
  ['ekonomi', 'Ekonomi', 'ekonomi', 'Makro, pasar, UMKM, dan ketenagakerjaan', '#f2c14e', 2],
  ['lingkungan', 'Lingkungan', 'lingkungan', 'Iklim, bencana, dan konservasi', '#2fd27a', 3],
  ['teknologi', 'Teknologi', 'teknologi', 'AI, digital, dan transformasi', '#8ab4ff', 4],
  ['budaya', 'Budaya', 'budaya', 'Seni, tradisi, dan kuliner Nusantara', '#c792ea', 5],
  ['pendidikan', 'Pendidikan', 'pendidikan', 'Sekolah, kampus, dan literasi', '#5eead4', 6]
];

const STAFF = [
  ['direktur@mbcindonesia.tv', 'Budi Santoso', 'Direktur Utama / Pemimpin Redaksi', 'Menetapkan arah editorial dan memberi persetujuan akhir.', '#e63329'],
  ['redaksi@mbcindonesia.tv', 'Sari Wulandari', 'Kepala Redaksi', 'Memimpin rapat editorial harian dan mengelola penugasan peliputan.', '#ff5245'],
  ['finance@mbcindonesia.tv', 'Dewi Anggraini', 'Redaktur Ekonomi', 'Mengelola desk ekonomi, ketenagakerjaan, dan UMKM.', '#f2c14e'],
  ['sales@mbcindonesia.tv', 'Rangga Saputra', 'Jurnalis Multiplatform', 'Meliput lapangan, menulis, dan memproduksi konten sosial.', '#8ab4ff']
];

const ARTICLES = [
  {
    slug: 'bmkg-peringatkan-hujan-ekstrem-jatim',
    title: 'BMKG Peringatkan Hujan Ekstrem Sepekan ke Depan di Jawa Timur',
    deck: 'Curah hujan di wilayah Kediri dan sekitarnya diprediksi 40 persen di atas normal, warga diimbau bersiap menghadapi genangan dan potensi banjir.',
    channel: 'lingkungan', author: 'redaksi@mbcindonesia.tv', editor: 'redaksi@mbcindonesia.tv',
    status: 'tayang', priority: 'tinggi', breaking: true,
    tags: ['BMKG', 'cuaca ekstrem', 'banjir', 'Kediri', 'mitigasi'],
    hero: 'assets/img/hero.jpg',
    body: `Badan Meteorologi, Klimatologi, dan Geofisika (BMKG) mengeluarkan peringatan dini cuaca ekstrem untuk wilayah Jawa Timur selama sepekan ke depan. Curah hujan di Kediri, Blitar, dan Trenggalek diperkirakan 30 hingga 40 persen di atas rata-rata normal.

Kepala Stasiun Klimatologi Jawa Timur menyebut potensi banjir dan genangan meningkat pada sore hingga malam hari. Pemerintah Kota Kediri mengimbau warga membersihkan saluran air serta menyiapkan tas siaga bencana berisi dokumen penting, obat-obatan, dan air minum.

Tahun lalu, wilayah Kota Kediri sempat dilanda genangan setinggi 60 sentimeter akibat hujan deras selama enam jam. Pemerintah kota mencatat sekitar 1.200 rumah terdampak dan kerugian ekonomi ditaksir Rp 4,7 miliar.

Pengamat hidrologi mengingatkan bahwa kapasitas drainase kota perlu dievaluasi, terutama pada kawasan padat permukiman di bantaran sungai. "Genangan tidak hanya soal curah hujan, tetapi juga daya tampung saluran," katanya.

MBC INDONESIA akan menyiarkan pembaruan cuaca setiap dua jam melalui kanal Live TV serta laporan langsung dari posko kelurahan jika status darurat diaktifkan.`,
    sources: [
      { title: 'BMKG — Peringatan Dini Cuaca', url: 'https://www.bmkg.go.id/', type: 'organisasi', note: 'Rilis resmi peringatan cuaca.' },
      { title: 'BNPB — Data Bencana', url: 'https://bnpb.go.id/', type: 'data', note: 'Data kejadian dan dampak bencana.' }
    ],
    fact_checks: [
      { claim: 'Curah hujan 30–40% di atas normal', status: 'terverifikasi', source: 'Rilis BMKG (dokumen internal)', by: 'Sari Wulandari', at: '2026-11-21 09:10' },
      { claim: 'Kerugian tahun lalu Rp 4,7 miliar', status: 'menunggu', source: '', by: '', at: '' }
    ],
    scheduled: null, published: '2026-11-21 06:30'
  },
  {
    slug: 'umk-kediri-2027-usulan-6-5-persen',
    title: 'Upah Minimum Kota Kediri 2027 Diusulkan Naik 6,5 Persen',
    deck: 'Dewan Pengupahan Kota mengusulkan kenaikan berdasarkan inflasi dan pertumbuhan ekonomi daerah, sementara pengusaha meminta penyesuaian bertahap.',
    channel: 'ekonomi', author: 'finance@mbcindonesia.tv', editor: 'redaksi@mbcindonesia.tv',
    status: 'review', priority: 'tinggi', breaking: false,
    tags: ['UMK', 'upah minimum', 'tenaga kerja', 'Apindo', 'Kediri'],
    hero: 'assets/img/kabar-nusantara.jpg',
    body: `Dewan Pengupahan Kota Kediri mengusulkan kenaikan Upah Minimum Kota (UMK) tahun 2027 sebesar 6,5 persen. Usulan disusun mempertimbangkan inflasi kota, pertumbuhan ekonomi, dan indeks pembangunan manusia.

Sekretaris Asosiasi Pengusaha Indonesia (Apindo) Jawa Timur meminta pemerintah mempertimbangkan daya tahan usaha kecil. "Kenaikan 6,5 persen masih dapat dicerna industri besar, tetapi sektor mikro butuh penyesuaian bertahap," katanya dalam panel MBC Ruang Bisnis.

Perwakilan serikat pekerja menyebut usulan masih di bawah kebutuhan hidup layak. Serikat menuntut survei pasar diperbarui setiap kuartal sebagai acuan evaluasi.

Penetapan UMK dijadwalkan pertengahan Desember 2026. Selisih antara kebutuhan hidup layak dan usulan masih menjadi titik perdebatan utama.`,
    sources: [{ title: 'Kemnaker — Pedoman Upah Minimum', url: 'https://kemnaker.go.id/', type: 'regulasi', note: 'Dasar formula penetapan upah.' }],
    fact_checks: [{ claim: 'Usulan 6,5 persen', status: 'terverifikasi', source: 'Risalah rapat Dewan Pengupahan', by: 'Dewi Anggraini', at: '2026-11-20 14:20' }],
    scheduled: null, published: null
  },
  {
    slug: 'kopi-robusta-kediri-tembus-eropa',
    title: 'Kopi Robusta Kediri Tembus Pasar Eropa Lewat Koperasi Petani',
    deck: 'Koperasi petani mengirim kontainer perdana ke Belanda setelah dua tahun pendampingan mutu dan sertifikasi.',
    channel: 'ekonomi', author: 'finance@mbcindonesia.tv', editor: 'redaksi@mbcindonesia.tv',
    status: 'tayang', priority: 'normal', breaking: false,
    tags: ['kopi', 'robusta', 'ekspor', 'koperasi', 'UMKM'],
    hero: 'assets/img/dapur-rempah.jpg',
    body: `Koperasi Tani Makmur mengirim kontainer kopi robusta perdana ke Belanda dengan total 18 ton green bean. Ekspor ini menandai masuknya petani kecil ke rantai pasok lintas negara melalui skema kolektif.

Pendampingan berlangsung dua tahun meliputi fermentasi terkontrol, pengeringan hingga kadar air 12 persen, serta sertifikasi dasar sehingga mutu lebih konsisten dan harga tawar meningkat 22 persen.

Pemerintah kabupaten menyatakan akan mengalokasikan bantuan peralatan pengolahan kolektif dan memperluas akses pasar digital agar model koperasi dapat direplikasi di desa lain.

Nilai tambah terbesar sesungguhnya berada pada pengolahan sekunder seperti roasting dan pengemasan, bukan hanya penjualan bahan mentah. Tanpa peningkatan kapasitas roastery lokal, sebagian besar margin tetap tertinggal di luar wilayah.`,
    sources: [
      { title: 'Kementerian Koperasi — Panduan UMKM Ekspor', url: 'https://kemenkopukm.go.id/', type: 'regulasi', note: 'Skema fasilitasi ekspor.' },
      { title: 'BPS — Data Ekspor Kopi', url: 'https://www.bps.go.id/', type: 'data', note: 'Volume & nilai ekspor kopi.' }
    ],
    fact_checks: [{ claim: 'Ekspor 18 ton', status: 'terverifikasi', source: 'Dokumen koperasi', by: 'Dewi Anggraini', at: '2026-11-17 11:05' }],
    scheduled: null, published: '2026-11-17 08:00'
  },
  {
    slug: 'ai-di-ruang-redaksi-lokal',
    title: 'Redaksi Media Lokal Mulai Mengadopsi AI untuk Riset dan Verifikasi',
    deck: 'Ruang redaksi memakai kecerdasan artifisial untuk mempercepat riset latar, namun verifikasi tetap di tangan manusia.',
    channel: 'teknologi', author: 'redaksi@mbcindonesia.tv', editor: 'direktur@mbcindonesia.tv',
    status: 'fakta', priority: 'normal', breaking: false,
    tags: ['AI', 'jurnalisme', 'redaksi', 'verifikasi', 'literasi digital'],
    hero: 'assets/img/bicara-petang.jpg',
    body: `Sekitar 42 persen ruang redaksi media lokal di Indonesia sudah menggunakan alat kecerdasan artifisial untuk penelusuran latar, menurut survei sebuah lembaga riset media. Penggunaan terbanyak ada pada peringkasan dokumen dan pencarian arsip.

Praktisi jurnalisme mengingatkan risiko halusinasi, yaitu keluaran yang terdengar meyakinkan tetapi salah. Alur kerja diubah agar AI hanya berperan pada tahap prapenulisan, bukan menjadi sumber fakta tunggal.

Sejumlah media mulai menuliskan kebijakan AI di newsroom, misalnya kewajiban menyebutkan penggunaan alat bantu AI dan larangan memasukkan data narasumber sensitif ke layanan pihak ketiga.

Guru besar jurnalistik menyebut transparansi sebagai kunci. "Pembaca tidak menolak teknologi, yang ditolak adalah sikap membiarkan otomatisasi tanpa tanggung jawab editorial," ujarnya.`,
    sources: [{ title: 'UU No. 27/2022 — Pelindungan Data Pribadi', url: 'https://peraturan.bpk.go.id/', type: 'regulasi', note: 'Batas pemrosesan data pribadi.' }],
    fact_checks: [{ claim: 'Survei 42 persen', status: 'menunggu', source: '', by: '', at: '' }],
    scheduled: null, published: null
  },
  {
    slug: 'dokumenter-brantas-tahap-akhir',
    title: 'Produksi Dokumenter Kali Brantas Masuk Tahap Penyuntingan Akhir',
    deck: 'Dokumenter yang mengangkat kehidupan warga bantaran Sungai Brantas memasuki tahap akhir sebelum tayang Desember.',
    channel: 'budaya', author: 'redaksi@mbcindonesia.tv', editor: 'direktur@mbcindonesia.tv',
    status: 'siap', priority: 'normal', breaking: false,
    tags: ['dokumenter', 'Sungai Brantas', 'produksi', 'lingkungan'],
    hero: 'assets/img/jejak-nusantara.jpg',
    body: `Tim produksi MBC INDONESIA menyebut dokumenter perjalanan Sungai Brantas telah rampung 80 persen dalam proses penyuntingan. Pengambilan gambar dilakukan di lima titik mulai sumber mata air di Malang hingga hilir di Surabaya.

Produser eksekutif menjelaskan film ini menonjolkan suara warga setempat, mulai petani, pengrajin, hingga relawan lingkungan. Narasi mengikuti percakapan asli agar penonton merasa dekat.

Dokumenter dijadwalkan tayang pada slot prime time dan dilengkapi artikel pendukung serta diskusi di kampus-kampus Kediri.`,
    sources: [], fact_checks: [], scheduled: '2026-11-25 19:00', published: null
  },
  {
    slug: 'partisipasi-kuliah-jatim-naik',
    title: 'Angka Partisipasi Kuliah di Jawa Timur Naik, Kesiapan Digital Jadi Sorotan',
    deck: 'Angka partisipasi naik tiga poin, tetapi kesenjangan keterampilan digital antarwilayah masih lebar.',
    channel: 'pendidikan', author: 'redaksi@mbcindonesia.tv', editor: 'redaksi@mbcindonesia.tv',
    status: 'draft', priority: 'rendah', breaking: false,
    tags: ['pendidikan', 'perguruan tinggi', 'literasi digital'],
    hero: 'assets/img/panggung-musik.jpg',
    body: `Data dinas pendidikan mencatat angka partisipasi kasar pendidikan tinggi di Jawa Timur naik tiga poin dalam dua tahun terakhir. Namun sebarannya masih terkonsentrasi di kota besar seperti Surabaya dan Malang.

Kesiapan digital lulusan dinilai belum merata. Kampus di wilayah dengan akses internet terbatas menghadapi keterbatasan laboratorium dan pengajar praktik.

Pengamat pendidikan menilai kolaborasi kampus, industri, dan media lokal dapat mempercepat transfer keterampilan tanpa menunggu anggaran besar.`,
    sources: [], fact_checks: [], scheduled: null, published: null
  },
  {
    slug: 'ide-liputan-banjir-hulu',
    title: '[IDE] Banjir di kawasan hulu: siapa yang menanggung biaya mitigasi?',
    deck: 'Usulan liputan: membandingkan kontribusi anggaran mitigasi kabupaten hulu dan kota hilir.',
    channel: 'lingkungan', author: 'sales@mbcindonesia.tv', editor: null,
    status: 'ide', priority: 'normal', breaking: false,
    tags: ['banjir', 'mitigasi', 'anggaran'],
    hero: '', body: 'Catatan rapat: perlu data APBD tiga kabupaten hulu dan wawancara BPBD. Target tayang pekan depan.', sources: [], fact_checks: [], scheduled: null, published: null
  }
];

const TASKS = [
  ['Cek drainase kota setelah peringatan BMKG', 'redaksi@mbcindonesia.tv', '2026-11-22', 'pagi', 'lingkungan', 'rencana', 'Laporan lapangan + wawancara warga'],
  ['Wawancara buruh dengan UMK terendah', 'finance@mbcindonesia.tv', '2026-11-22', 'siang', 'ekonomi', 'dikerjakan', 'Sudut daya beli, bukan sekadar angka'],
  ['Verifikasi data survei AI 42%', 'redaksi@mbcindonesia.tv', '2026-11-22', 'sore', 'teknologi', 'dikerjakan', 'Minta metodologi ke lembaga riset'],
  ['Sunting akhir dokumenter Brantas', 'direktur@mbcindonesia.tv', '2026-11-23', 'malam', 'budaya', 'rencana', 'Cek musik & kredit'],
  ['Kurasi foto bantaran Brantas', 'sales@mbcindonesia.tv', '2026-11-23', 'pagi', 'budaya', 'rencana', 'Pilih 8 aset dari media library'],
  ['Panel Ruang Bisnis: upah & produktivitas', 'finance@mbcindonesia.tv', '2026-11-24', 'malam', 'ekonomi', 'rencana', 'Undang Apindo + serikat + akademisi']
];

const MEDIA = [
  ['hero-jakarta-malam.jpg', 'gambar', 'assets/img/hero.jpg', 1840, ['kota', 'studio', 'malam'], 'Dokumentasi MBC'],
  ['kabar-nusantara-studio.jpg', 'gambar', 'assets/img/kabar-nusantara.jpg', 1210, ['studio', 'berita'], 'Dokumentasi MBC'],
  ['jejak-nusantara-brantas.jpg', 'gambar', 'assets/img/jejak-nusantara.jpg', 1530, ['sungai', 'dokumenter'], 'Dokumentasi MBC'],
  ['dapur-rempah-kopi.jpg', 'gambar', 'assets/img/dapur-rempah.jpg', 990, ['kopi', 'kuliner'], 'Dokumentasi MBC'],
  ['bicara-petang-podcast.jpg', 'gambar', 'assets/img/bicara-petang.jpg', 1080, ['podcast', 'studio'], 'Dokumentasi MBC'],
  ['selasar-budaya.jpg', 'gambar', 'assets/img/selasar-budaya.jpg', 1140, ['budaya'], 'Dokumentasi MBC'],
  ['ruang-bisnis.jpg', 'gambar', 'assets/img/ruang-bisnis.jpg', 1020, ['ekonomi'], 'Dokumentasi MBC'],
  ['panggung-musik.jpg', 'gambar', 'assets/img/panggung-musik.jpg', 1330, ['musik', 'panggung'], 'Dokumentasi MBC'],
  ['kamera-komunitas.jpg', 'gambar', 'assets/img/kamera-komunitas.jpg', 870, ['komunitas'], 'Dokumentasi MBC']
];

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [id, name, slug, desc, color, ord] of CHANNELS) {
      await client.query(`INSERT INTO channels(id,name,slug,description,color,sort_order) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, color=EXCLUDED.color, sort_order=EXCLUDED.sort_order`,
        [id, name, slug, desc, color, ord]);
    }
    for (const [email, name, title, bio, color] of STAFF) {
      await client.query(`INSERT INTO staff(user_email,display_name,title,bio,avatar_color) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT (user_email) DO UPDATE SET display_name=EXCLUDED.display_name, title=EXCLUDED.title, bio=EXCLUDED.bio, avatar_color=EXCLUDED.avatar_color`,
        [email, name, title, bio, color]);
    }

    // tag usage
    await client.query('DELETE FROM tags');
    const tagCount = {};
    ARTICLES.forEach(a => a.tags.forEach(t => tagCount[t] = (tagCount[t] || 0) + 1));
    for (const [name, count] of Object.entries(tagCount)) {
      await client.query(`INSERT INTO tags(name,slug,usage_count) VALUES($1,$2,$3) ON CONFLICT (name) DO UPDATE SET usage_count=EXCLUDED.usage_count`,
        [name, name.toLowerCase().replace(/[^\w]+/g, '-'), count]);
    }

    // artikel (hapus lalu isi ulang agar idempotent)
    await client.query('DELETE FROM articles');
    const ids = {};
    for (const a of ARTICLES) {
      const wc = a.body.trim().split(/\s+/).length;
      const { rows } = await client.query(
        `INSERT INTO articles(slug,title,deck,body,channel_id,author_email,editor_email,status,priority,is_breaking,tags,hero_image,seo_title,seo_desc,
            fact_checks,sources,scheduled_at,published_at,word_count,read_time_min,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18,$19,$20,now() - interval '3 days', now())
         RETURNING id`,
        [a.slug, a.title, a.deck, a.body, a.channel, a.author, a.editor, a.status, a.priority, a.breaking, a.tags, a.hero,
         a.title.slice(0, 60), a.deck.slice(0, 155), JSON.stringify(a.fact_checks), JSON.stringify(a.sources),
         a.scheduled, a.published, wc, Math.max(1, Math.round(wc / 220))]);
      ids[a.slug] = rows[0].id;
    }

    // revisi (2 versi untuk 2 artikel)
    await client.query('DELETE FROM article_revisions');
    const rev = [
      ['bmkg-peringatkan-hujan-ekstrem-jatim', 1, 'BMKG: Hujan Ekstrem Sepekan di Jatim', 'Versi awal', 'Draf awal tanpa data kerugian.', 'redaksi@mbcindonesia.tv', 'Draf pertama'],
      ['bmkg-peringatkan-hujan-ekstrem-jatim', 2, ARTICLES[0].title, ARTICLES[0].deck, ARTICLES[0].body, 'redaksi@mbcindonesia.tv', 'Tambah data kerugian & kutipan pengamat'],
      ['umk-kediri-2027-usulan-6-5-persen', 1, 'Usulan UMK Kediri Naik', 'Versi awal', 'Catatan rapat singkat.', 'finance@mbcindonesia.tv', 'Draf awal'],
      ['umk-kediri-2027-usulan-6-5-persen', 2, ARTICLES[1].title, ARTICLES[1].deck, ARTICLES[1].body, 'finance@mbcindonesia.tv', 'Tambah respons serikat pekerja']
    ];
    for (const [slug, v, t, d, b, by, note] of rev) {
      await client.query(`INSERT INTO article_revisions(article_id,version,title,deck,body,edited_by,note) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [ids[slug], v, t, d, b, by, note]);
    }

    // catatan editorial
    await client.query('DELETE FROM editorial_notes');
    const notes = [
      ['bmkg-peringatkan-hujan-ekstrem-jatim', 'Sari Wulandari', 'Angka kerugian Rp 4,7 miliar belum ada dokumen resmi — jangan tayang sebelum dikonfirmasi BPBD.', 'permintaan', false],
      ['bmkg-peringatkan-hujan-ekstrem-jatim', 'Budi Santoso', 'Tambahkan nomor posko darurat di paragraf akhir.', 'catatan', false],
      ['ai-di-ruang-redaksi-lokal', 'Sari Wulandari', 'Sebutkan nama lembaga survei atau ubah menjadi "menurut sejumlah praktisi".', 'koreksi', false],
      ['umk-kediri-2027-usulan-6-5-persen', 'Budi Santoso', 'Pastikan hak jawab Apindo dan serikat seimbang panjangnya.', 'catatan', true],
      ['kopi-robusta-kediri-tembus-eropa', 'Dewi Anggraini', 'Cek ejaan nama koperasi: "Koperasi Tani Makmur" (bukan Makmur Jaya).', 'koreksi', true]
    ];
    for (const [slug, by, body, kind, resolved] of notes) {
      await client.query('INSERT INTO editorial_notes(article_id,author,body,kind,resolved) VALUES($1,$2,$3,$4,$5)', [ids[slug], by, body, kind, resolved]);
    }

    // persetujuan editorial
    await client.query('DELETE FROM editorial_approvals');
    const appr = [
      ['umk-kediri-2027-usulan-6-5-persen', 'redaktur', 'disetujui', 'Sari Wulandari', 'Struktur sudah baik', '2026-11-20 15:00'],
      ['umk-kediri-2027-usulan-6-5-persen', 'fakta', 'menunggu', null, '', null],
      ['ai-di-ruang-redaksi-lokal', 'redaktur', 'disetujui', 'Sari Wulandari', 'Lanjut ke verifikasi fakta', '2026-11-19 10:00'],
      ['ai-di-ruang-redaksi-lokal', 'fakta', 'revisi', 'Sari Wulandari', 'Sumber survei harus disebut', '2026-11-20 11:30'],
      ['dokumenter-brantas-tahap-akhir', 'redaktur', 'disetujui', 'Sari Wulandari', 'OK', '2026-11-19 09:00'],
      ['dokumenter-brantas-tahap-akhir', 'fakta', 'disetujui', 'Sari Wulandari', 'Tidak ada klaim berangka', '2026-11-19 09:30'],
      ['dokumenter-brantas-tahap-akhir', 'hukum', 'menunggu', null, '', null],
      ['bmkg-peringatkan-hujan-ekstrem-jatim', 'pemimpin', 'disetujui', 'Budi Santoso', 'Tayang dengan catatan verifikasi kerugian', '2026-11-21 05:50']
    ];
    for (const [slug, stage, status, actor, note, at] of appr) {
      await client.query(`INSERT INTO editorial_approvals(article_id,stage,status,actor,note,created_at,decided_at) VALUES($1,$2,$3,$4,$5,now() - interval '1 day',$6)`,
        [ids[slug], stage, status, actor, note, at]);
    }

    // tugas editorial
    await client.query('DELETE FROM editorial_tasks');
    for (const [title, assignee, date, slot, ch, status, angle] of TASKS) {
      await client.query('INSERT INTO editorial_tasks(title,assignee,plan_date,slot,channel_id,status,angle) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [title, assignee, date, slot, ch, status, angle]);
    }

    // media library
    await client.query('DELETE FROM media_assets');
    for (const [name, kind, path, size, tags, credit] of MEDIA) {
      await client.query('INSERT INTO media_assets(name,kind,path,size_kb,tags,credit,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [name, kind, path, size, tags, credit, 'redaksi@mbcindonesia.tv']);
    }

    // analitik 14 hari
    await client.query('DELETE FROM content_analytics');
    const liveSlugs = Object.keys(ids);
    for (const slug of liveSlugs) {
      for (let d = 13; d >= 0; d--) {
        const base = 40 + Math.round(Math.random() * 260);
        await client.query(`INSERT INTO content_analytics(article_id,day,views,read_complete,shares,avg_scroll)
          VALUES($1, (CURRENT_DATE - $2::int), $3, $4, $5, $6) ON CONFLICT (article_id, day) DO NOTHING`,
          [ids[slug], d, base, Math.round(base * (0.35 + Math.random() * 0.3)), Math.round(base * 0.06), Math.round(55 + Math.random() * 35)]);
      }
    }

    // registry agen
    for (const a of Object.values(AGENTS)) {
      await client.query(`INSERT INTO ai_agents(id,name,role,description,icon,color) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, description=EXCLUDED.description, icon=EXCLUDED.icon, color=EXCLUDED.color`,
        [a.id, a.name, a.role, a.description, a.icon, a.color]);
    }

    // moderasi komentar
    await client.query(`INSERT INTO comment_moderation(comment_id,status)
      SELECT c.id, 'tayang' FROM comments c ON CONFLICT (comment_id) DO NOTHING`);
    await client.query(`UPDATE comment_moderation SET status='menunggu' WHERE comment_id IN (SELECT id FROM comments ORDER BY id DESC LIMIT 1)`);

    await client.query('COMMIT');
    const c = await client.query(`SELECT (SELECT count(*) FROM articles) a, (SELECT count(*) FROM editorial_tasks) t,
      (SELECT count(*) FROM media_assets) m, (SELECT count(*) FROM ai_agents) g, (SELECT count(*) FROM channels) ch`);
    console.log('✅ Seed newsroom selesai:', c.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Seed newsroom gagal:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
