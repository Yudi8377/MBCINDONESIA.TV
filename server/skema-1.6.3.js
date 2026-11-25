/* ============================================================================
   LAPISAN 1.6.3 — siklus hidup per menu + form enterprise
   Dipanggil dari server/skema-modul.js SETELAH semua modul didefinisikan.
   ========================================================================== */
'use strict';

module.exports = function lapisan163(modul, STATUS_LABEL) {

/* ---------- label universal (dipakai bila menu tak punya label sendiri) ---------- */
Object.assign(STATUS_LABEL, {
  ide: 'Ide', riset: 'Riset', penulisan: 'Penulisan', review: 'Review',
  siap: 'Siap terbit', tayang: 'Tayang', koreksi: 'Koreksi', tarik: 'Ditarik',
  terjadwal: 'Terjadwal', berjalan: 'Berjalan', selesai: 'Selesai',
  prospek: 'Prospek', kualifikasi: 'Kualifikasi', penawaran: 'Penawaran',
  negosiasi: 'Negosiasi', menang: 'Menang', kalah: 'Kalah',
  booking: 'Booking', produksi: 'Produksi', batal: 'Batal',
  rencana: 'Rencana', pra: 'Pra produksi', pasca: 'Pasca produksi',
  masuk: 'Masuk', triase: 'Triase', verifikasi: 'Verifikasi',
  dikerjakan: 'Dikerjakan', ditolak: 'Ditolak', spam: 'Spam',
  ditinjau: 'Ditinjau', tampil: 'Tampil', dipakai: 'Dipakai',
  baru: 'Baru', ditindaklanjuti: 'Ditindaklanjuti', ditutup: 'Ditutup',
  aktif: 'Aktif', nonaktif: 'Nonaktif', berlaku: 'Berlaku', dicabut: 'Dicabut',
  antre: 'Antre', proses: 'Diproses', gagal: 'Gagal', diterbitkan: 'Diterbitkan',
  diajukan: 'Diajukan', ditinjau_ulang: 'Tinjau ulang', terkunci: 'Terkunci'
});

/* ---------- pembangun siklus: maju, mundur satu langkah, cabang batal/arsip ---------- */
function siklus(urutan, opsi) {
  const o = opsi || {};
  const alur = {};
  urutan.forEach(function (s, i) {
    const ke = [];
    if (i + 1 < urutan.length) ke.push(urutan[i + 1]);
    if (i > 0) ke.push(urutan[i - 1]);
    if (o.batal && s !== o.batal) ke.push(o.batal);
    if (o.gagal && i > 0) ke.push(o.gagal);
    if (i === urutan.length - 1) ke.push('arsip');
    alur[s] = Array.from(new Set(ke));
  });
  if (o.batal) alur[o.batal] = ['arsip'];
  if (o.gagal) alur[o.gagal] = ['arsip'];
  alur.arsip = [];
  return alur;
}

/* ---------- siklus tiap menu sesuai pekerjaan nyata ---------- */
modul.articles.siklus = siklus(['ide', 'riset', 'penulisan', 'review', 'siap', 'tayang'], { batal: 'tarik' });
modul.articles.labelStatus = { ide: 'Ide', riset: 'Riset', penulisan: 'Penulisan', review: 'Review redaktur', siap: 'Siap terbit', tayang: 'Tayang', tarik: 'Ditarik', arsip: 'Arsip' };
modul.articles.butuhSetuju = ['siap', 'tayang'];
modul.articles.deskripsi = 'Penulisan & penerbitan artikel lengkap: metadata, isi, sumber, verifikasi, aspek hukum, media, dan distribusi.';

modul.desk.siklus = siklus(['usulan', 'riset', 'penulisan', 'review', 'siap'], { batal: 'dibatalkan' });
modul.desk.siklus = siklus(['ide', 'riset', 'penulisan', 'review', 'siap'], { batal: 'dibatalkan' });
modul.desk.labelStatus = { ide: 'Usulan', riset: 'Riset', penulisan: 'Penulisan', review: 'Review', siap: 'Siap terbit', dibatalkan: 'Dibatalkan', arsip: 'Arsip' };

modul.calendar.siklus = siklus(['rencana', 'terjadwal', 'berjalan', 'selesai'], { batal: 'dibatalkan' });
modul.calendar.labelStatus = { rencana: 'Rencana', terjadwal: 'Terjadwal', berjalan: 'Berjalan', selesai: 'Selesai', dibatalkan: 'Dibatalkan', arsip: 'Arsip' };

modul.antrean.siklus = siklus(['masuk', 'triase', 'verifikasi', 'dikerjakan', 'selesai'], { gagal: 'ditolak' });
modul.antrean.labelStatus = { masuk: 'Masuk', triase: 'Triase', verifikasi: 'Verifikasi', dikerjakan: 'Dikerjakan', selesai: 'Selesai', ditolak: 'Ditolak', arsip: 'Arsip' };

modul.findings.siklus = siklus(['baru', 'ditinjau', 'ditindaklanjuti', 'selesai'], { batal: 'ditutup' });
modul.findings.labelStatus = { baru: 'Baru', ditinjau: 'Ditinjau', ditindaklanjuti: 'Ditindaklanjuti', selesai: 'Selesai', ditutup: 'Ditutup', arsip: 'Arsip' };

modul.media.siklus = siklus(['masuk', 'verifikasi', 'siap', 'dipakai'], { gagal: 'ditolak' });
modul.media.labelStatus = { masuk: 'Masuk', verifikasi: 'Cek hak & mutu', siap: 'Siap pakai', dipakai: 'Dipakai', ditolak: 'Ditolak', arsip: 'Arsip' };

modul.moderation.siklus = siklus(['baru', 'ditinjau', 'tampil'], { gagal: 'ditolak' });
modul.moderation.siklus.ditolak = ['arsip'];
modul.moderation.siklus.spam = ['arsip'];
modul.moderation.labelStatus = { baru: 'Baru', ditinjau: 'Ditinjau', tampil: 'Ditampilkan', ditolak: 'Ditolak', spam: 'Spam', arsip: 'Arsip' };

modul.crm.siklus = siklus(['prospek', 'kualifikasi', 'penawaran', 'negosiasi', 'menang'], { gagal: 'kalah' });
modul.crm.labelStatus = { prospek: 'Prospek', kualifikasi: 'Kualifikasi', penawaran: 'Penawaran', negosiasi: 'Negosiasi', menang: 'Menang', kalah: 'Kalah', arsip: 'Arsip' };
modul.crm.butuhSetuju = ['menang'];

modul.ads.siklus = siklus(['draf', 'booking', 'produksi', 'tayang', 'selesai'], { batal: 'batal' });
modul.ads.labelStatus = { draf: 'Draf', booking: 'Booking', produksi: 'Produksi materi', tayang: 'Tayang', selesai: 'Selesai', batal: 'Batal', arsip: 'Arsip' };
modul.ads.butuhSetuju = ['tayang'];

modul.produksi.siklus = siklus(['rencana', 'pra', 'produksi', 'pasca', 'tayang'], { batal: 'dibatalkan' });
modul.produksi.labelStatus = { rencana: 'Rencana', pra: 'Pra produksi', produksi: 'Produksi', pasca: 'Pasca produksi', tayang: 'Tayang', dibatalkan: 'Dibatalkan', arsip: 'Arsip' };

modul.keuangan.siklus = siklus(['draf', 'diperiksa', 'disetujui', 'final'], { batal: 'dibatalkan' });
modul.keuangan.labelStatus = { draf: 'Draf', diperiksa: 'Diperiksa', disetujui: 'Disetujui', final: 'Final', dibatalkan: 'Dibatalkan', arsip: 'Arsip' };

modul.master.siklus = siklus(['draf', 'aktif', 'nonaktif'], {});
modul.master.siklus.nonaktif = ['aktif', 'arsip'];
modul.master.labelStatus = { draf: 'Draf', aktif: 'Aktif', nonaktif: 'Nonaktif', arsip: 'Arsip' };

modul.laporan.siklus = siklus(['draf', 'ditinjau', 'final'], { batal: 'dibatalkan' });
modul.laporan.labelStatus = { draf: 'Draf', ditinjau: 'Ditinjau', final: 'Final', dibatalkan: 'Dibatalkan', arsip: 'Arsip' };

modul.audit.siklus = siklus(['baru', 'ditinjau', 'ditindaklanjuti', 'selesai'], { batal: 'ditutup' });
modul.audit.labelStatus = { baru: 'Temuan baru', ditinjau: 'Ditinjau', ditindaklanjuti: 'Ditindaklanjuti', selesai: 'Selesai', ditutup: 'Ditutup', arsip: 'Arsip' };

modul['content-analytics'].siklus = siklus(['draf', 'ditinjau', 'final'], {});
modul['content-analytics'].labelStatus = { draf: 'Draf', ditinjau: 'Ditinjau', final: 'Final', arsip: 'Arsip' };

modul.dashboard.siklus = siklus(['draf', 'ditinjau', 'diterbitkan'], {});
modul.dashboard.labelStatus = { draf: 'Draf', ditinjau: 'Ditinjau', diterbitkan: 'Diterbitkan', arsip: 'Arsip' };
modul.dashboard.butuhSetuju = ['diterbitkan'];

modul['ai-studio'].siklus = siklus(['antre', 'proses', 'selesai'], { gagal: 'gagal' });
modul['ai-studio'].labelStatus = { antre: 'Antre', proses: 'Diproses', selesai: 'Selesai', gagal: 'Gagal', arsip: 'Arsip' };

modul.pengguna.siklus = siklus(['diajukan', 'ditinjau', 'aktif'], { gagal: 'ditolak' });
modul.pengguna.siklus.aktif = ['nonaktif', 'arsip'];
modul.pengguna.siklus.nonaktif = ['aktif', 'arsip'];
modul.pengguna.labelStatus = { diajukan: 'Diajukan', ditinjau: 'Ditinjau', aktif: 'Aktif', nonaktif: 'Nonaktif', ditolak: 'Ditolak', arsip: 'Arsip' };
modul.pengguna.butuhSetuju = ['aktif'];

modul.pengaturan.siklus = siklus(['draf', 'ditinjau', 'berlaku'], { batal: 'dicabut' });
modul.pengaturan.labelStatus = { draf: 'Draf', ditinjau: 'Ditinjau', berlaku: 'Berlaku', dicabut: 'Dicabut', arsip: 'Arsip' };
modul.pengaturan.butuhSetuju = ['berlaku'];

/* ============================================================================
   FORM ARTIKEL KELAS ENTERPRISE — 8 bagian, 58 field
   Mengikuti kebiasaan CMS redaksi profesional + kewajiban UU Pers/P3SPS.
   ========================================================================== */
modul.articles.jenisDokumen = [
  { nilai: 'berita', label: 'Berita (straight news)' },
  { nilai: 'laporan-mendalam', label: 'Laporan mendalam / investigasi' },
  { nilai: 'feature', label: 'Feature / human interest' },
  { nilai: 'wawancara', label: 'Wawancara / profil' },
  { nilai: 'opini', label: 'Opini / tajuk' },
  { nilai: 'foto', label: 'Fotografi jurnalistik' },
  { nilai: 'video', label: 'Video / dokumenter' },
  { nilai: 'podcast', label: 'Podcast / audio' },
  { nilai: 'siaran-langsung', label: 'Siaran langsung' },
  { nilai: 'infografis', label: 'Infografis / data' }
];

modul.articles.kolom = [
  { kunci: 'nomor', label: 'Nomor', lebar: '12%' },
  { kunci: 'judul', label: 'Judul', lebar: '38%' },
  { kunci: 'data.kanal', label: 'Kanal', lebar: '14%' },
  { kunci: 'data.tayang', label: 'Tayang', lebar: '12%' },
  { kunci: 'data.penulis', label: 'Penulis', lebar: '14%' },
  { kunci: 'status', label: 'Tahap', lebar: '10%' }
];

modul.articles.field = [
  /* ---------- BAGIAN 1: identitas & publikasi ---------- */
  { kunci: 'jenis', label: 'Tipe konten', jenis: 'pilih', wajib: true, bagian: '1. Identitas & publikasi' },
  { kunci: 'kanal', label: 'Kanal / rubrik utama', jenis: 'pilih', wajib: true, bagian: '1. Identitas & publikasi', opsi: [
    { nilai: 'nasional', label: 'Nasional' }, { nilai: 'hukum', label: 'Hukum & Kriminal' },
    { nilai: 'ekonomi', label: 'Ekonomi & Bisnis' }, { nilai: 'politik', label: 'Politik' },
    { nilai: 'daerah', label: 'Daerah / Kediri Raya' }, { nilai: 'olahraga', label: 'Olahraga' },
    { nilai: 'hiburan', label: 'Hiburan & Budaya' }, { nilai: 'teknologi', label: 'Teknologi' },
    { nilai: 'kesehatan', label: 'Kesehatan' }, { nilai: 'pendidikan', label: 'Pendidikan' }] },
  { kunci: 'editorial_jenis', label: 'Format editorial', jenis: 'pilih', bagian: '1. Identitas & publikasi', bantuan: 'Membedakan produk berita dengan produk komersial (P3SPS Pasal 2 huruf b — iklan tidak boleh menyamar sebagai berita).', acuan: 'P3SPS 2012 Pasal 2 & Pasal 5', opsi: [
    { nilai: 'murni', label: 'Berita murni' }, { nilai: 'advertorial', label: 'Advertorial (berlabel)' },
    { nilai: 'kerja-sama', label: 'Kerja sama / suplemen' }, { nilai: 'siaran-pers', label: 'Rilis / siaran pers yang diolah' }] },
  { kunci: 'prioritas', label: 'Prioritas redaksi', jenis: 'pilih', bagian: '1. Identitas & publikasi', opsi: [
    { nilai: 'breaking', label: 'Breaking / mendesak' }, { nilai: 'tinggi', label: 'Tinggi' },
    { nilai: 'normal', label: 'Normal' }, { nilai: 'rendah', label: 'Rendah / evergreen' }] },
  { kunci: 'bahasa', label: 'Bahasa', jenis: 'pilih', bagian: '1. Identitas & publikasi', opsi: [
    { nilai: 'id', label: 'Indonesia' }, { nilai: 'en', label: 'Inggris' },
    { nilai: 'jv', label: 'Jawa' }, { nilai: 'dwibahasa', label: 'Dwibahasa' }] },
  { kunci: 'lokasi_peristiwa', label: 'Lokasi peristiwa', jenis: 'text', bagian: '1. Identitas & publikasi', bantuan: 'Kota/kabupaten — dipakai untuk tag wilayah dan SEO lokal.' },

  /* ---------- BAGIAN 2: judul & metadata ---------- */
  { kunci: 'judul_artikel', label: 'Judul (headline)', jenis: 'text', wajib: true, lebar: 'full', bagian: '2. Judul & metadata', bantuan: 'Maksimal 90 karakter agar tidak terpotong di kartu berita dan mesin pencari.' },
  { kunci: 'dek', label: 'Dek / subjudul', jenis: 'text', lebar: 'full', bagian: '2. Judul & metadata', bantuan: 'Satu kalimat penjelas di bawah judul.' },
  { kunci: 'slug', label: 'Slug URL', jenis: 'text', bagian: '2. Judul & metadata', pola: '^[a-z0-9]+(-[a-z0-9]+)*$', bantuan: 'Huruf kecil, angka, dan tanda hubung. Contoh: pemkot-kediri-uji-coba-retribusi.' },
  { kunci: 'ringkasan', label: 'Ringkasan / lead', jenis: 'textarea', wajib: true, lebar: 'full', bagian: '2. Judul & metadata', bantuan: '2–3 kalimat pertama: siapa, apa, kapan, di mana, mengapa, bagaimana.' },
  { kunci: 'tag', label: 'Tag / kata kunci', jenis: 'text', lebar: 'full', bagian: '2. Judul & metadata', bantuan: 'Pisahkan dengan koma. Maksimal 8 tag.' },
  { kunci: 'meta_judul', label: 'Meta title (SEO)', jenis: 'text', bagian: '2. Judul & metadata', bantuan: 'Kosongkan bila sama dengan judul. Ideal 50–60 karakter.' },
  { kunci: 'meta_deskripsi', label: 'Meta description (SEO)', jenis: 'textarea', bagian: '2. Judul & metadata', bantuan: 'Ideal 140–160 karakter.' },
  { kunci: 'kanonik', label: 'URL kanonik', jenis: 'text', bagian: '2. Judul & metadata', bantuan: 'Diisi bila artikel ini sindikasi dari luar agar tidak dianggap duplikat.' },

  /* ---------- BAGIAN 3: isi ---------- */
  { kunci: 'isi', label: 'Isi artikel', jenis: 'textarea', wajib: true, lebar: 'full', bagian: '3. Isi naskah', bantuan: 'Tulis naskah lengkap. Kutipan langsung diapit tanda petik dan sebut jabatan narasumber.' },
  { kunci: 'kutipan_utama', label: 'Kutipan utama (pull quote)', jenis: 'textarea', bagian: '3. Isi naskah', bantuan: 'Satu kutipan terkuat untuk ditonjolkan.' },
  { kunci: 'catatan_penulis', label: 'Catatan penulis / konteks', jenis: 'textarea', bagian: '3. Isi naskah', bantuan: 'Latar belakang yang tidak masuk naskah tetapi perlu diketahui editor.' },
  { kunci: 'koreksi', label: 'Riwayat koreksi', jenis: 'textarea', bagian: '3. Isi naskah', acuan: 'UU Pers Pasal 1 angka 11 & Kode Etik Jurnalistik Pasal 1 — koreksi wajib terbuka', bantuan: 'Tulis apa yang dikoreksi, kapan, dan atas dasar apa.' },

  /* ---------- BAGIAN 4: penulis & kredit ---------- */
  { kunci: 'penulis', label: 'Penulis / reporter', jenis: 'text', wajib: true, bagian: '4. Penulis & kredit' },
  { kunci: 'redaktur', label: 'Redaktur penyunting', jenis: 'text', bagian: '4. Penulis & kredit', bantuan: 'Wajib terisi sebelum status “siap terbit”.' },
  { kunci: 'pemred', label: 'Pemimpin redaksi (pengesahan)', jenis: 'text', bagian: '4. Penulis & kredit', acuan: 'UU Pers Pasal 9 — pemimpin redaksi bertanggung jawab atas isi' },
  { kunci: 'fotografer', label: 'Fotografer / videografer', jenis: 'text', bagian: '4. Penulis & kredit' },
  { kunci: 'kontributor', label: 'Kontributor luar', jenis: 'text', bagian: '4. Penulis & kredit', bantuan: 'Nama & lembaga. Untuk naskah luar, sertakan surat pernyataan.' },
  { kunci: 'kredit', label: 'Kredit / hak cipta', jenis: 'text', bagian: '4. Penulis & kredit', acuan: 'UU Hak Cipta 28/2014 Pasal 43 huruf d — kutipan wajib sebut sumber', bantuan: 'Contoh: “Dok. MBC Indonesia” atau “Foto: Antara/Andi”.' },

  /* ---------- BAGIAN 5: sumber & verifikasi ---------- */
  { kunci: 'sumber_utama', label: 'Narasumber utama', jenis: 'textarea', bagian: '5. Sumber & verifikasi', wajib: true, bantuan: 'Nama, jabatan, lembaga, tanggal wawancara, dan cara (tatap muka/telepon/tertulis).' },
  { kunci: 'sumber_kedua', label: 'Narasumber kedua (uji silang)', jenis: 'textarea', bagian: '5. Sumber & verifikasi', acuan: 'KEJ Pasal 1 & 3 — uji informasi, dengar dua sisi', bantuan: 'Berita berimbang memerlukan lebih dari satu sisi.' },
  { kunci: 'dokumen', label: 'Dokumen pendukung', jenis: 'textarea', bagian: '5. Sumber & verifikasi', bantuan: 'Nomor surat, putusan, laporan, siaran pers — sebutkan identitas dokumennya.' },
  { kunci: 'cek', label: 'Butir verifikasi yang sudah dilakukan', jenis: 'multi', bagian: '5. Sumber & verifikasi', opsi: [
    { nilai: 'wawancara-langsung', label: 'Wawancara langsung' }, { nilai: 'dua-sumber', label: 'Minimal dua sumber independen' },
    { nilai: 'dokumen-resmi', label: 'Dokumen resmi diperiksa' }, { nilai: 'cek-lapangan', label: 'Cek lapangan / observasi' },
    { nilai: 'verifikasi-data', label: 'Data dibandingkan sumber resmi' }, { nilai: 'cek-foto', label: 'Foto/video diverifikasi asli & waktu' },
    { nilai: 'bantah', label: 'Hak bantah sudah diminta' }] },
  { kunci: 'status_verifikasi', label: 'Kesimpulan verifikasi', jenis: 'pilih', bagian: '5. Sumber & verifikasi', opsi: [
    { nilai: 'terverifikasi', label: 'Terverifikasi penuh' }, { nilai: 'sebagian', label: 'Sebagian terverifikasi' },
    { nilai: 'belum', label: 'Belum terverifikasi' }, { nilai: 'tidak-layak', label: 'Tidak layak terbit' }] },
  { kunci: 'hak_jawab', label: 'Hak jawab / bantahan', jenis: 'textarea', bagian: '5. Sumber & verifikasi', acuan: 'UU Pers Pasal 5 & 12 — hak jawab dan hak koreksi', bantuan: 'Catat permintaan, tanggal, isi jawaban, dan apakah sudah dimuat.' },
  { kunci: 'anonim', label: 'Penggunaan sumber anonim', jenis: 'pilih', bagian: '5. Sumber & verifikasi', acuan: 'KEJ Pasal 2 & 7 — identitas sumber dilindungi; uji kepentingan publik', opsi: [
    { nilai: 'tidak', label: 'Tidak ada sumber anonim' },
    { nilai: 'sebagian', label: 'Sebagian, disetujui redaktur' },
    { nilai: 'kritis', label: 'Sumber anonim kritis — perlu persetujuan pemred' }] },

  /* ---------- BAGIAN 6: aspek hukum & etika ---------- */
  { kunci: 'risiko', label: 'Perkiraan risiko hukum', jenis: 'pilih', bagian: '6. Hukum & etika', opsi: [
    { nilai: 'rendah', label: 'Rendah' }, { nilai: 'sedang', label: 'Sedang' },
    { nilai: 'tinggi', label: 'Tinggi' }, { nilai: 'sangat-tinggi', label: 'Sangat tinggi — wajib tinjauan hukum' }] },
  { kunci: 'pasal_p3sps', label: 'Pasal P3SPS yang relevan', jenis: 'text', bagian: '6. Hukum & etika', acuan: 'Peraturan KPI 01/P/KPI/03/2012 (P3SPS)', bantuan: 'Contoh: Pasal 13 (perlindungan anak), Pasal 15 (privasi), Pasal 26 (kekerasan).' },
  { kunci: 'privasi', label: 'Aspek privasi & data pribadi', jenis: 'pilih', bagian: '6. Hukum & etika', acuan: 'UU 27/2022 (UU PDP) Pasal 20 & 65', opsi: [
    { nilai: 'tidak-ada', label: 'Tidak memuat data pribadi' },
    { nilai: 'dengan-izin', label: 'Memuat data pribadi — izin ada' },
    { nilai: 'kepentingan-publik', label: 'Memuat data pribadi — kepentingan publik' }] },
  { kunci: 'anak', label: 'Melibatkan anak / korban', jenis: 'pilih', bagian: '6. Hukum & etika', acuan: 'P3SPS Pasal 13 & UU 35/2014 (Perlindungan Anak)', opsi: [
    { nilai: 'tidak', label: 'Tidak ada' },
    { nilai: 'samar', label: 'Ada — identitas disamarkan' },
    { nilai: 'izin-orangtua', label: 'Ada — izin orang tua diperoleh' }] },
  { kunci: 'praduga', label: 'Status hukum pihak yang diberitakan', jenis: 'pilih', bagian: '6. Hukum & etika', acuan: 'P3SPS Pasal 5 & KUHP — praduga tak bersalah', opsi: [
    { nilai: 'tidak-terkait', label: 'Tidak terkait perkara' },
    { nilai: 'saksi', label: 'Saksi' }, { nilai: 'terlapor', label: 'Terlapor / belum diputus' },
    { nilai: 'terdakwa', label: 'Terdakwa' }, { nilai: 'berkekuatan-hukum', label: 'Putusan berkekuatan hukum tetap' }] },
  { kunci: 'izin_lokasi', label: 'Izin lokasi / liputan', jenis: 'text', bagian: '6. Hukum & etika', bantuan: 'Nomor izin atau surat tugas bila liputan di area terbatas.' },

  /* ---------- BAGIAN 7: media ---------- */
  { kunci: 'media_utama', label: 'Media utama', jenis: 'pilih', bagian: '7. Media & aset', opsi: [
    { nilai: 'foto', label: 'Foto' }, { nilai: 'video', label: 'Video' },
    { nilai: 'infografis', label: 'Infografis' }, { nilai: 'audio', label: 'Audio' },
    { nilai: 'embed', label: 'Semat (embed)' }, { nilai: 'tanpa', label: 'Tanpa media' }] },
  { kunci: 'media_url', label: 'URL aset media', jenis: 'text', bagian: '7. Media & aset', bantuan: 'Tautan berkas asli (bukan tautan berbagi) agar bisa diunduh redaktur.' },
  { kunci: 'media_alt', label: 'Teks alternatif (alt)', jenis: 'text', bagian: '7. Media & aset', acuan: 'WCAG 2.1 AA — aksesibilitas', bantuan: 'Deskripsi gambar untuk pembaca layar.' },
  { kunci: 'media_kredit', label: 'Kredit media', jenis: 'text', bagian: '7. Media & aset' },
  { kunci: 'durasi', label: 'Durasi (detik)', jenis: 'angka', bagian: '7. Media & aset', bantuan: 'Untuk video/audio. Kosongkan bila bukan video.' },
  { kunci: 'thumbnail', label: 'URL thumbnail', jenis: 'text', bagian: '7. Media & aset' },

  /* ---------- BAGIAN 8: jadwal & distribusi ---------- */
  { kunci: 'tayang', label: 'Tanggal tayang', jenis: 'tanggal', bagian: '8. Jadwal & distribusi' },
  { kunci: 'jam_tayang', label: 'Jam tayang (WIB)', jenis: 'text', bagian: '8. Jadwal & distribusi', bantuan: 'HH:MM. Kosongkan untuk terbit segera.' },
  { kunci: 'distribusi', label: 'Kanal distribusi', jenis: 'multi', bagian: '8. Jadwal & distribusi', opsi: [
    { nilai: 'web', label: 'Situs web' }, { nilai: 'youtube', label: 'YouTube' },
    { nilai: 'instagram', label: 'Instagram' }, { nilai: 'tiktok', label: 'TikTok' },
    { nilai: 'facebook', label: 'Facebook' }, { nilai: 'x', label: 'X / Twitter' },
    { nilai: 'whatsapp', label: 'WhatsApp Channel' }, { nilai: 'tv', label: 'Siaran TV' },
    { nilai: 'radio', label: 'Radio' }, { nilai: 'newsletter', label: 'Surat kabar digital' }] },
  { kunci: 'headline_khusus', label: 'Versi judul per kanal', jenis: 'textarea', bagian: '8. Jadwal & distribusi', bantuan: 'Judul pendek untuk media sosial (maks 70 karakter per kanal).' },
  { kunci: 'catatan_redaktur', label: 'Catatan redaktur', jenis: 'textarea', bagian: '8. Jadwal & distribusi', bantuan: 'Alasan revisi, penolakan, atau syarat tambahan sebelum terbit.' },
  { kunci: 'terkait', label: 'Artikel terkait', jenis: 'textarea', bagian: '8. Jadwal & distribusi', bantuan: 'Nomor atau tautan artikel lain untuk tautan internal.' }
];

/* ============================================================================
   MODUL LAIN YANG FORMNYA MASIH TERLALU TIPIS — dilengkapi
   ========================================================================== */

/* ---------- Studio AI: dari 5 field → 15 ---------- */
modul['ai-studio'].field = [
  { kunci: 'jenis', label: 'Jenis pekerjaan AI', jenis: 'pilih', wajib: true, bagian: '1. Permintaan', opsi: [
    { nilai: 'ringkasan', label: 'Ringkasan / TL;DR artikel' }, { nilai: 'judul', label: 'Alternatif judul' },
    { nilai: 'tag', label: 'Saran tag & SEO' }, { nilai: 'transkrip', label: 'Transkrip audio/video' },
    { nilai: 'terjemahan', label: 'Terjemahan' }, { nilai: 'cek-fakta', label: 'Bantu verifikasi klaim' },
    { nilai: 'sosmed', label: 'Naskah media sosial' }, { nilai: 'klasifikasi', label: 'Klasifikasi & moderasi' }] },
  { kunci: 'model', label: 'Model / agen', jenis: 'pilih', bagian: '1. Permintaan', opsi: [
    { nilai: 'lokal', label: 'Mesin lokal (tanpa LLM)' }, { nilai: 'hibrida', label: 'Hibrida' }, { nilai: 'llm', label: 'LLM eksternal' }] },
  { kunci: 'artikel', label: 'Artikel / objek sumber', jenis: 'text', bagian: '1. Permintaan', wajib: true, bantuan: 'Nomor artikel (ART/…) atau tautan.' },
  { kunci: 'perintah', label: 'Instruksi untuk agen', jenis: 'textarea', bagian: '1. Permintaan', wajib: true },
  { kunci: 'bahasa', label: 'Bahasa keluaran', jenis: 'pilih', bagian: '1. Permintaan', opsi: [
    { nilai: 'id', label: 'Indonesia' }, { nilai: 'en', label: 'Inggris' }, { nilai: 'jv', label: 'Jawa' }] },
  { kunci: 'panjang', label: 'Batas panjang keluaran', jenis: 'pilih', bagian: '1. Permintaan', opsi: [
    { nilai: 'pendek', label: 'Pendek (±100 kata)' }, { nilai: 'sedang', label: 'Sedang (±300 kata)' },
    { nilai: 'panjang', label: 'Panjang (±800 kata)' }] },
  { kunci: 'nada', label: 'Nada', jenis: 'pilih', bagian: '1. Permintaan', opsi: [
    { nilai: 'netral', label: 'Netral jurnalistik' }, { nilai: 'formal', label: 'Formal' },
    { nilai: 'ringan', label: 'Ringan / mudah dibaca' }] },
  { kunci: 'potongan', label: 'Potongan sumber (bila ada)', jenis: 'textarea', bagian: '2. Konteks', bantuan: 'Tempel naskah/transkrip yang ingin diolah.' },
  { kunci: 'acuan', label: 'Gaya & pedoman', jenis: 'text', bagian: '2. Konteks', bantuan: 'Contoh: Pedoman Umum Ejaan Bahasa Indonesia, gaya MBC, P3SPS.' },
  { kunci: 'pantangan', label: 'Hal yang harus dihindari', jenis: 'textarea', bagian: '2. Konteks', bantuan: 'Contoh: jangan mengarang kutipan, jangan menyebut nama korban anak.' },
  { kunci: 'hasil', label: 'Keluaran agen', jenis: 'textarea', bagian: '3. Hasil & tinjauan' },
  { kunci: 'skor', label: 'Skor keyakinan (0-100)', jenis: 'angka', bagian: '3. Hasil & tinjauan', min: 0, max: 100 },
  { kunci: 'ditinjau_oleh', label: 'Ditinjau oleh manusia', jenis: 'text', bagian: '3. Hasil & tinjauan', acuan: 'P3SPS & KEJ — tanggung jawab editorial tetap pada manusia', bantuan: 'Wajib: keluaran AI tidak boleh terbit tanpa tinjauan.' },
  { kunci: 'keputusan', label: 'Keputusan redaktur', jenis: 'pilih', bagian: '3. Hasil & tinjauan', opsi: [
    { nilai: 'dipakai', label: 'Dipakai apa adanya' }, { nilai: 'revisi', label: 'Dipakai dengan revisi' },
    { nilai: 'ditolak', label: 'Ditolak' }] },
  { kunci: 'catatan', label: 'Catatan', jenis: 'textarea', bagian: '3. Hasil & tinjauan' }
];

/* ---------- Temuan AI: dari 6 field → 14 ---------- */
modul.findings.field = [
  { kunci: 'jenis', label: 'Jenis temuan', jenis: 'pilih', wajib: true, bagian: '1. Temuan', opsi: [
    { nilai: 'fakta', label: 'Klaim tanpa sumber' }, { nilai: 'hukum', label: 'Risiko hukum' },
    { nilai: 'etika', label: 'Pelanggaran etika / P3SPS' }, { nilai: 'bahasa', label: 'Kesalahan bahasa' },
    { nilai: 'data', label: 'Angka / data tidak konsisten' }, { nilai: 'plagiarisme', label: 'Kemiripan / plagiarisme' }] },
  { kunci: 'temuan', label: 'Ringkasan temuan', jenis: 'text', wajib: true, lebar: 'full', bagian: '1. Temuan' },
  { kunci: 'artikel', label: 'Artikel terkait', jenis: 'text', bagian: '1. Temuan', wajib: true },
  { kunci: 'tingkat', label: 'Tingkat keparahan', jenis: 'pilih', wajib: true, bagian: '1. Temuan', opsi: [
    { nilai: 'kritis', label: 'Kritis — tahan terbit' }, { nilai: 'tinggi', label: 'Tinggi' },
    { nilai: 'sedang', label: 'Sedang' }, { nilai: 'rendah', label: 'Rendah' }] },
  { kunci: 'kutipan', label: 'Kutipan bermasalah', jenis: 'textarea', bagian: '1. Temuan' },
  { kunci: 'bukti', label: 'Bukti / tautan', jenis: 'textarea', bagian: '1. Temuan' },
  { kunci: 'acuan', label: 'Dasar penilaian', jenis: 'text', bagian: '2. Dasar', bantuan: 'Contoh: KEJ Pasal 1, P3SPS Pasal 13.' },
  { kunci: 'agen', label: 'Agen yang menemukan', jenis: 'pilih', bagian: '2. Dasar', opsi: [
    { nilai: 'fakta', label: 'Agen Fakta' }, { nilai: 'hukum', label: 'Agen Hukum' },
    { nilai: 'etika', label: 'Agen Etika' }, { nilai: 'bahasa', label: 'Agen Bahasa' },
    { nilai: 'data', label: 'Agen Data' }, { nilai: 'manual', label: 'Tinjauan manusia' }] },
  { kunci: 'tindakan', label: 'Tindakan yang diminta', jenis: 'textarea', bagian: '3. Tindak lanjut' },
  { kunci: 'penanggung', label: 'Penanggung jawab', jenis: 'text', bagian: '3. Tindak lanjut' },
  { kunci: 'tenggat', label: 'Tenggat', jenis: 'tanggal', bagian: '3. Tindak lanjut' },
  { kunci: 'hasil', label: 'Hasil tindak lanjut', jenis: 'textarea', bagian: '3. Tindak lanjut' },
  { kunci: 'diverifikasi', label: 'Sudah diverifikasi manusia', jenis: 'centang', bagian: '3. Tindak lanjut', acuan: 'Tanggung jawab editorial tidak boleh diserahkan ke mesin' },
  { kunci: 'catatan', label: 'Catatan', jenis: 'textarea', bagian: '3. Tindak lanjut' }
];

/* ---------- Analytics konten: dari 8 → 22 ---------- */
modul['content-analytics'].field = [
  { kunci: 'jenis', label: 'Jenis laporan', jenis: 'pilih', wajib: true, bagian: '1. Periode & cakupan', opsi: [
    { nilai: 'harian', label: 'Harian' }, { nilai: 'mingguan', label: 'Mingguan' },
    { nilai: 'bulanan', label: 'Bulanan' }, { nilai: 'kampanye', label: 'Per kampanye' },
    { nilai: 'analisis-khusus', label: 'Analisis khusus' }] },
  { kunci: 'periode_mulai', label: 'Periode mulai', jenis: 'tanggal', wajib: true, bagian: '1. Periode & cakupan' },
  { kunci: 'periode_akhir', label: 'Periode akhir', jenis: 'tanggal', wajib: true, bagian: '1. Periode & cakupan' },
  { kunci: 'kanal', label: 'Kanal dianalisis', jenis: 'multi', bagian: '1. Periode & cakupan', opsi: [
    { nilai: 'web', label: 'Situs web' }, { nilai: 'youtube', label: 'YouTube' },
    { nilai: 'instagram', label: 'Instagram' }, { nilai: 'tiktok', label: 'TikTok' },
    { nilai: 'facebook', label: 'Facebook' }, { nilai: 'tv', label: 'Siaran TV' }] },
  { kunci: 'pembaca', label: 'Pembaca / penonton', jenis: 'angka', bagian: '2. Metrik utama' },
  { kunci: 'tayangan', label: 'Tayangan halaman', jenis: 'angka', bagian: '2. Metrik utama' },
  { kunci: 'durasi_baca', label: 'Rata-rata durasi baca (detik)', jenis: 'angka', bagian: '2. Metrik utama' },
  { kunci: 'artikel_terbit', label: 'Jumlah artikel terbit', jenis: 'angka', bagian: '2. Metrik utama' },
  { kunci: 'rasio_pantul', label: 'Rasio pantul (%)', jenis: 'angka', min: 0, max: 100, bagian: '2. Metrik utama' },
  { kunci: 'sumber_trafik', label: 'Sumber trafik terbesar', jenis: 'pilih', bagian: '2. Metrik utama', opsi: [
    { nilai: 'langsung', label: 'Langsung' }, { nilai: 'pencarian', label: 'Pencarian organik' },
    { nilai: 'sosmed', label: 'Media sosial' }, { nilai: 'rujukan', label: 'Rujukan' },
    { nilai: 'berbayar', label: 'Berbayar' }] },
  { kunci: 'top_kanal', label: 'Kanal dengan performa terbaik', jenis: 'text', bagian: '2. Metrik utama' },
  { kunci: 'artikel_top', label: 'Artikel terpopuler', jenis: 'textarea', bagian: '3. Temuan', bantuan: 'Sebutkan judul dan angka pembacanya.' },
  { kunci: 'pola', label: 'Pola yang terlihat', jenis: 'textarea', bagian: '3. Temuan' },
  { kunci: 'hipotesis', label: 'Hipotesis / dugaan penyebab', jenis: 'textarea', bagian: '3. Temuan' },
  { kunci: 'rekomendasi', label: 'Rekomendasi redaksi', jenis: 'textarea', wajib: true, bagian: '4. Tindakan' },
  { kunci: 'penanggung', label: 'Penanggung jawab tindakan', jenis: 'text', bagian: '4. Tindakan' },
  { kunci: 'tenggat', label: 'Tenggat evaluasi', jenis: 'tanggal', bagian: '4. Tindakan' },
  { kunci: 'pembanding', label: 'Periode pembanding', jenis: 'text', bagian: '4. Tindakan', bantuan: 'Contoh: bulan sebelumnya, atau periode yang sama tahun lalu.' },
  { kunci: 'metode', label: 'Metode pengambilan data', jenis: 'pilih', bagian: '5. Catatan metode', opsi: [
    { nilai: 'ga4', label: 'Google Analytics 4' }, { nilai: 'internal', label: 'Log internal server' },
    { nilai: 'platform', label: 'Statistik platform (YouTube/IG/TikTok)' }, { nilai: 'survei', label: 'Survei / kuesioner' }] },
  { kunci: 'keterbatasan', label: 'Keterbatasan data', jenis: 'textarea', bagian: '5. Catatan metode' },
  { kunci: 'catatan', label: 'Catatan', jenis: 'textarea', bagian: '5. Catatan metode' }
];

/* ---------- Audit: dari 8 → 15 ---------- */
modul.audit.field = [
  { kunci: 'jenis', label: 'Jenis pemeriksaan', jenis: 'pilih', wajib: true, bagian: '1. Objek audit', opsi: [
    { nilai: 'proses', label: 'Audit proses' }, { nilai: 'kepatuhan', label: 'Audit kepatuhan' },
    { nilai: 'konten', label: 'Audit konten & etika' }, { nilai: 'keuangan', label: 'Audit keuangan' },
    { nilai: 'sistem', label: 'Audit akses & sistem' }] },
  { kunci: 'objek', label: 'Objek yang diperiksa', jenis: 'text', wajib: true, bagian: '1. Objek audit' },
  { kunci: 'periode', label: 'Periode diperiksa', jenis: 'text', bagian: '1. Objek audit', bantuan: 'Contoh: Oktober 2026.' },
  { kunci: 'auditor', label: 'Auditor / pemeriksa', jenis: 'text', wajib: true, bagian: '1. Objek audit' },
  { kunci: 'temuan', label: 'Uraian temuan', jenis: 'textarea', wajib: true, lebar: 'full', bagian: '2. Temuan' },
  { kunci: 'kategori_temuan', label: 'Kategori temuan', jenis: 'pilih', bagian: '2. Temuan', opsi: [
    { nilai: 'ketaatan', label: 'Ketaatan' }, { nilai: 'penyimpangan', label: 'Penyimpangan' },
    { nilai: 'kelemahan', label: 'Kelemahan pengendalian' }, { nilai: 'rekomendasi', label: 'Rekomendasi perbaikan' }] },
  { kunci: 'tingkat', label: 'Tingkat risiko', jenis: 'pilih', bagian: '2. Temuan', opsi: [
    { nilai: 'tinggi', label: 'Tinggi' }, { nilai: 'sedang', label: 'Sedang' }, { nilai: 'rendah', label: 'Rendah' }] },
  { kunci: 'bukti', label: 'Bukti / dasar pemeriksaan', jenis: 'textarea', bagian: '2. Temuan' },
  { kunci: 'acuan', label: 'Kriteria / acuan', jenis: 'text', bagian: '2. Temuan', bantuan: 'SOP, UU, atau standar yang dijadikan ukuran (mis. UU Penyiaran, P3SPS, SAK).' },
  { kunci: 'rekomendasi', label: 'Rekomendasi', jenis: 'textarea', bagian: '3. Tindak lanjut' },
  { kunci: 'penanggung', label: 'Penanggung jawab tindak lanjut', jenis: 'text', bagian: '3. Tindak lanjut' },
  { kunci: 'tenggat', label: 'Tenggat penyelesaian', jenis: 'tanggal', bagian: '3. Tindak lanjut' },
  { kunci: 'tindak_lanjut', label: 'Hasil tindak lanjut', jenis: 'textarea', bagian: '3. Tindak lanjut' },
  { kunci: 'kesimpulan', label: 'Kesimpulan auditor', jenis: 'pilih', bagian: '4. Kesimpulan', opsi: [
    { nilai: 'sesuai', label: 'Sesuai ketentuan' }, { nilai: 'sebagian', label: 'Sesuai sebagian' },
    { nilai: 'tidak-sesuai', label: 'Tidak sesuai' }] },
  { kunci: 'catatan', label: 'Catatan', jenis: 'textarea', bagian: '4. Kesimpulan' }
];

/* ---------- Laporan & BI: dari 8 → 15 ---------- */
modul.laporan.field = [
  { kunci: 'jenis', label: 'Jenis laporan', jenis: 'pilih', wajib: true, bagian: '1. Lingkup', opsi: [
    { nilai: 'harian', label: 'Laporan harian' }, { nilai: 'mingguan', label: 'Laporan mingguan' },
    { nilai: 'bulanan', label: 'Laporan bulanan' }, { nilai: 'triwulan', label: 'Triwulan' },
    { nilai: 'tahunan', label: 'Tahunan' }, { nilai: 'insidental', label: 'Insidental' }] },
  { kunci: 'judul_laporan', label: 'Judul laporan', jenis: 'text', wajib: true, bagian: '1. Lingkup' },
  { kunci: 'periode', label: 'Periode', jenis: 'text', wajib: true, bagian: '1. Lingkup', bantuan: 'Contoh: 1–30 November 2026.' },
  { kunci: 'unit', label: 'Unit / divisi', jenis: 'pilih', bagian: '1. Lingkup', opsi: [
    { nilai: 'redaksi', label: 'Redaksi' }, { nilai: 'produksi', label: 'Produksi' },
    { nilai: 'keuangan', label: 'Keuangan' }, { nilai: 'komersial', label: 'Komersial' },
    { nilai: 'umum', label: 'Umum / korporat' }] },
  { kunci: 'penyusun', label: 'Penyusun', jenis: 'text', wajib: true, bagian: '1. Lingkup' },
  { kunci: 'ringkasan', label: 'Ringkasan eksekutif', jenis: 'textarea', wajib: true, lebar: 'full', bagian: '2. Isi' },
  { kunci: 'capaian', label: 'Capaian utama', jenis: 'textarea', bagian: '2. Isi' },
  { kunci: 'kendala', label: 'Kendala', jenis: 'textarea', bagian: '2. Isi' },
  { kunci: 'data', label: 'Data & angka pendukung', jenis: 'textarea', bagian: '2. Isi', bantuan: 'Sebutkan sumber angka agar dapat diaudit.' },
  { kunci: 'rekomendasi', label: 'Rekomendasi', jenis: 'textarea', bagian: '3. Tindak lanjut' },
  { kunci: 'keputusan_diminta', label: 'Keputusan yang diminta', jenis: 'textarea', bagian: '3. Tindak lanjut' },
  { kunci: 'penerima', label: 'Penerima laporan', jenis: 'text', bagian: '3. Tindak lanjut', bantuan: 'Contoh: Direksi, Pemimpin Redaksi.' },
  { kunci: 'lampiran', label: 'Lampiran', jenis: 'textarea', bagian: '3. Tindak lanjut' },
  { kunci: 'kerahasiaan', label: 'Tingkat kerahasiaan', jenis: 'pilih', bagian: '4. Klasifikasi', opsi: [
    { nilai: 'publik', label: 'Publik' }, { nilai: 'internal', label: 'Internal' },
    { nilai: 'terbatas', label: 'Terbatas' }, { nilai: 'rahasia', label: 'Rahasia' }] },
  { kunci: 'catatan', label: 'Catatan', jenis: 'textarea', bagian: '4. Klasifikasi' }
];

/* ---------- Dasbor direksi: dari 7 → 13 ---------- */
modul.dashboard.field = [
  { kunci: 'jenis', label: 'Jenis laporan dasbor', jenis: 'pilih', wajib: true, bagian: '1. Lingkup', opsi: [
    { nilai: 'harian', label: 'Ringkasan harian' }, { nilai: 'mingguan', label: 'Ringkasan mingguan' },
    { nilai: 'bulanan', label: 'Ringkasan bulanan' }, { nilai: 'khusus', label: 'Laporan khusus direksi' }] },
  { kunci: 'tanggal', label: 'Tanggal', jenis: 'tanggal', wajib: true, bagian: '1. Lingkup' },
  { kunci: 'penyusun', label: 'Penyusun', jenis: 'text', wajib: true, bagian: '1. Lingkup' },
  { kunci: 'untuk', label: 'Ditujukan kepada', jenis: 'text', bagian: '1. Lingkup' },
  { kunci: 'highlight', label: 'Sorotan utama', jenis: 'textarea', wajib: true, lebar: 'full', bagian: '2. Isi ringkasan' },
  { kunci: 'pendapatan', label: 'Pendapatan periode (Rp)', jenis: 'uang', bagian: '2. Isi ringkasan' },
  { kunci: 'produksi', label: 'Jumlah produksi konten', jenis: 'angka', bagian: '2. Isi ringkasan' },
  { kunci: 'pembaca', label: 'Pembaca / penonton', jenis: 'angka', bagian: '2. Isi ringkasan' },
  { kunci: 'isu', label: 'Isu yang perlu keputusan', jenis: 'textarea', bagian: '2. Isi ringkasan' },
  { kunci: 'risiko', label: 'Risiko & mitigasi', jenis: 'textarea', bagian: '3. Risiko & keputusan' },
  { kunci: 'keputusan', label: 'Keputusan yang diminta', jenis: 'textarea', bagian: '3. Risiko & keputusan' },
  { kunci: 'tindak_lanjut', label: 'Tindak lanjut rapat sebelumnya', jenis: 'textarea', bagian: '3. Risiko & keputusan' },
  { kunci: 'catatan', label: 'Catatan', jenis: 'textarea', bagian: '3. Risiko & keputusan' }
];

/* ---------- Pengguna & peran: dari 7 → 14 ---------- */
modul.pengguna.field = [
  { kunci: 'jenis', label: 'Jenis permintaan', jenis: 'pilih', wajib: true, bagian: '1. Permintaan', opsi: [
    { nilai: 'akun-baru', label: 'Akun staf baru' }, { nilai: 'ubah-peran', label: 'Perubahan peran' },
    { nilai: 'reset-sandi', label: 'Setel ulang sandi' }, { nilai: 'nonaktif', label: 'Penonaktifan akun' },
    { nilai: 'akses-luar', label: 'Akses sementara (mitra/vendor)' }] },
  { kunci: 'tanggal', label: 'Tanggal berlaku', jenis: 'tanggal', wajib: true, bagian: '1. Permintaan' },
  { kunci: 'staf', label: 'Nama staf', jenis: 'text', wajib: true, bagian: '1. Permintaan' },
  { kunci: 'email', label: 'Email', jenis: 'email', wajib: true, bagian: '1. Permintaan' },
  { kunci: 'jabatan', label: 'Jabatan', jenis: 'text', bagian: '1. Permintaan' },
  { kunci: 'peran', label: 'Peran', jenis: 'pilih', wajib: true, bagian: '2. Hak akses', opsi: [
    { nilai: 'admin', label: 'Administrator' }, { nilai: 'direksi', label: 'Direksi' },
    { nilai: 'pemred', label: 'Pemimpin Redaksi' }, { nilai: 'redaktur', label: 'Redaktur' },
    { nilai: 'reporter', label: 'Reporter' }, { nilai: 'editorial', label: 'Staf Editorial' },
    { nilai: 'finance', label: 'Keuangan' }, { nilai: 'sales', label: 'Komersial' }] },
  { kunci: 'akses_modul', label: 'Modul yang perlu diakses', jenis: 'multi', bagian: '2. Hak akses', opsi: [
    { nilai: 'cms', label: 'CMS editorial' }, { nilai: 'keuangan', label: 'Keuangan' },
    { nilai: 'komersial', label: 'Komersial / CRM' }, { nilai: 'produksi', label: 'Produksi' },
    { nilai: 'metrik', label: 'Metrik & analitik' }, { nilai: 'kelola_pengguna', label: 'Kelola pengguna' }] },
  { kunci: 'sementara', label: 'Akses sementara', jenis: 'centang', bagian: '2. Hak akses', bantuan: 'Untuk mitra/vendor — wajib dicatat tanggal berakhirnya.' },
  { kunci: 'berakhir', label: 'Berakhir pada', jenis: 'tanggal', bagian: '2. Hak akses' },
  { kunci: 'alasan', label: 'Alasan permintaan', jenis: 'textarea', wajib: true, bagian: '3. Persetujuan', acuan: 'UU PDP Pasal 35 — pencatatan akses & tujuan' },
  { kunci: 'penyetuju', label: 'Penyetuju', jenis: 'text', bagian: '3. Persetujuan' },
  { kunci: 'dua_orang', label: 'Persetujuan dua orang', jenis: 'centang', bagian: '3. Persetujuan', bantuan: 'Wajib untuk peran administrator (pemisahan tugas).' },
  { kunci: 'catatan', label: 'Catatan', jenis: 'textarea', bagian: '3. Persetujuan' }
];

/* ---------- Pengaturan: dari 8 → 13 ---------- */
modul.pengaturan.field = [
  { kunci: 'jenis', label: 'Jenis dokumen', jenis: 'pilih', wajib: true, bagian: '1. Dokumen', opsi: [
    { nilai: 'sop', label: 'SOP' }, { nilai: 'kebijakan', label: 'Kebijakan internal' },
    { nilai: 'konfigurasi', label: 'Catatan perubahan konfigurasi' },
    { nilai: 'pedoman', label: 'Pedoman redaksi' }, { nilai: 'formulir', label: 'Formulir baku' }] },
  { kunci: 'judul_dok', label: 'Judul dokumen', jenis: 'text', wajib: true, bagian: '1. Dokumen' },
  { kunci: 'nomor_dok', label: 'Nomor dokumen', jenis: 'text', bagian: '1. Dokumen', bantuan: 'Nomor internal, mis. SOP-RED-012.' },
  { kunci: 'berlaku', label: 'Tanggal berlaku', jenis: 'tanggal', wajib: true, bagian: '1. Dokumen' },
  { kunci: 'pemilik', label: 'Pemilik proses', jenis: 'text', wajib: true, bagian: '1. Dokumen' },
  { kunci: 'ruang_lingkup', label: 'Ruang lingkup', jenis: 'textarea', bagian: '2. Isi' },
  { kunci: 'isi', label: 'Isi kebijakan / SOP', jenis: 'textarea', wajib: true, bagian: '2. Isi' },
  { kunci: 'langkah', label: 'Langkah kerja', jenis: 'textarea', bagian: '2. Isi', bantuan: 'Urutan 1, 2, 3 … agar dapat dijalankan siapa pun.' },
  { kunci: 'dasar', label: 'Dasar hukum / standar', jenis: 'textarea', bagian: '2. Isi', bantuan: 'Contoh: UU Penyiaran 32/2002, P3SPS, UU PDP, ISO 9001:2015 §7.5.' },
  { kunci: 'peninjauan', label: 'Jadwal peninjauan', jenis: 'tanggal', bagian: '3. Pengendalian' },
  { kunci: 'versi', label: 'Versi', jenis: 'text', bagian: '3. Pengendalian', bantuan: 'Contoh: 1.0, 1.1.' },
  { kunci: 'persetujuan', label: 'Disetujui oleh', jenis: 'text', bagian: '3. Pengendalian' },
  { kunci: 'catatan', label: 'Catatan perubahan', jenis: 'textarea', bagian: '3. Pengendalian' }
];

/* ---------- Master data: beri struktur bagian ---------- */
modul.master.field.forEach(function (f) {
  if (!f.bagian) f.bagian = ['jenis', 'kode', 'nama'].indexOf(f.kunci) >= 0 ? '1. Identitas data' : '2. Rincian & masa berlaku';
});
/* ---------- Kalender: bagian + field tambahan ---------- */
modul.calendar.field = [
  { kunci: 'jenis', label: 'Jenis agenda', jenis: 'pilih', wajib: true, bagian: '1. Agenda' },
  { kunci: 'agenda', label: 'Nama agenda', jenis: 'text', wajib: true, bagian: '1. Agenda' },
  { kunci: 'tanggal', label: 'Tanggal', jenis: 'tanggal', wajib: true, bagian: '1. Agenda' },
  { kunci: 'jam', label: 'Jam (WIB)', jenis: 'text', bagian: '1. Agenda', bantuan: 'HH:MM' },
  { kunci: 'durasi', label: 'Perkiraan durasi (menit)', jenis: 'angka', bagian: '1. Agenda' },
  { kunci: 'lokasi', label: 'Lokasi / kanal', jenis: 'text', bagian: '1. Agenda' },
  { kunci: 'penanggung', label: 'Penanggung jawab', jenis: 'text', wajib: true, bagian: '2. Pelaksanaan' },
  { kunci: 'kru', label: 'Kru & peralatan', jenis: 'textarea', bagian: '2. Pelaksanaan', bantuan: 'Kamera, audio, operator, driver — agar tidak bentrok jadwal alat.' },
  { kunci: 'narasumber', label: 'Narasumber yang diundang', jenis: 'textarea', bagian: '2. Pelaksanaan' },
  { kunci: 'prioritas', label: 'Prioritas', jenis: 'pilih', bagian: '2. Pelaksanaan', opsi: [
    { nilai: 'wajib', label: 'Wajib liput' }, { nilai: 'tinggi', label: 'Tinggi' },
    { nilai: 'normal', label: 'Normal' }, { nilai: 'opsional', label: 'Opsional' }] },
  { kunci: 'anggaran', label: 'Perkiraan biaya (Rp)', jenis: 'uang', bagian: '3. Anggaran & izin' },
  { kunci: 'izin', label: 'Izin / akreditasi', jenis: 'text', bagian: '3. Anggaran & izin', bantuan: 'Nomor izin atau surat tugas bila diperlukan.' },
  { kunci: 'risiko', label: 'Risiko & mitigasi', jenis: 'textarea', bagian: '3. Anggaran & izin' },
  { kunci: 'catatan', label: 'Catatan', jenis: 'textarea', bagian: '3. Anggaran & izin' }
];

/* ============================================================================
   PEMBERIAN BAGIAN untuk 8 menu yang belum berstruktur
   (dipisah agar mudah ditinjau: satu peta per menu)
   ========================================================================== */
const BAGIAN = {
  keuangan: {
    '1. Dasar dokumen': ['jenis', 'tanggal', 'masa_pajak', 'uraian'],
    '2. Lawan transaksi': ['nama_lawan', 'npwp_lawan', 'nib_lawan', 'alamat_lawan'],
    '3. Nilai & pajak': ['dpp', 'tarif_ppn', 'ppn', 'tarif_pph23', 'pph23', 'jumlah'],
    '4. Pembayaran & akun': ['cara_bayar', 'bank', 'jatuh_tempo', 'kode_akun', 'npwp_perusahaan'],
    '5. Catatan': ['catatan']
  },
  crm: {
    '1. Prospek': ['jenis', 'perusahaan', 'sektor', 'sumber'],
    '2. Kontak': ['kontak', 'jabatan', 'email', 'telepon', 'alamat'],
    '3. Legalitas': ['nib', 'npwp'],
    '4. Penawaran': ['tahap', 'nilai', 'probabilitas', 'paket', 'target_tutup', 'pemilik'],
    '5. Catatan': ['ringkasan', 'tindak_lanjut']
  },
  ads: {
    '1. Pengiklan': ['jenis', 'pengiklan', 'agensi', 'npwp'],
    '2. Pesanan tayang': ['produk', 'kanal', 'format', 'slot', 'jumlah_tayang', 'periode_mulai', 'periode_akhir'],
    '3. Nilai & pajak': ['nilai', 'ppn', 'status_tayang'],
    '4. Kepatuhan iklan': ['izin_iklan', 'cek_etika', 'kategori_jam', 'data_pribadi'],
    '5. Catatan': ['catatan']
  },
  produksi: {
    '1. Proyek': ['jenis', 'proyek', 'klien', 'mulai', 'selesai'],
    '2. Jadwal & lokasi': ['jam_mulai', 'durasi_jam', 'lokasi', 'koordinat'],
    '3. Kru & peralatan': ['kru', 'peralatan'],
    '4. Izin & keselamatan': ['izin', 'keselamatan', 'narasumber'],
    '5. Catatan': ['catatan']
  },
  antrean: {
    '1. Kiriman': ['jenis', 'judul_perkara', 'tanggal', 'kanal'],
    '2. Pelapor': ['reporter', 'identitas'],
    '3. Isi & bukti': ['ringkasan', 'bukti'],
    '4. Verifikasi': ['verifikasi', 'catatan']
  },
  desk: {
    '1. Rapat': ['jenis', 'agenda', 'tanggal'],
    '2. Peserta': ['pemimpin', 'peserta'],
    '3. Pembahasan & keputusan': ['pembahasan', 'keputusan', 'penugasan'],
    '4. Catatan': ['catatan']
  },
  media: {
    '1. Berkas': ['jenis', 'nama', 'deskripsi'],
    '2. Asal & hak': ['sumber', 'hak'],
    '3. Teknis': ['lokasi', 'kualitas'],
    '4. Catatan': ['catatan']
  },
  moderation: {
    '1. Komentar': ['jenis', 'tanggal', 'artikel', 'komentar'],
    '2. Penilaian': ['alasan', 'dasar', 'bukti'],
    '3. Tindakan': ['pemberitahuan', 'catatan']
  }
};

Object.keys(BAGIAN).forEach(function (k) {
  var m = modul[k];
  if (!m) return;
  const peta = BAGIAN[k];
  m.field.forEach(function (f) {
    if (f.bagian) return;
    Object.keys(peta).forEach(function (judul) {
      if (peta[judul].indexOf(f.kunci) >= 0) f.bagian = judul;
    });
    if (!f.bagian) f.bagian = 'Lainnya';
  });
});

};
