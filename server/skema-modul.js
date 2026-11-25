/* ============================================================
   skema-modul.js — Definisi form & aturan per modul (sumber tunggal)
   ------------------------------------------------------------
   Setiap menu sidebar punya satu skema: judul, prefiks nomor dokumen,
   alur status, kolom daftar, dan daftar field form. Dipakai bersama
   oleh server (validasi & penomoran) dan UI (merender form).

   Field:
     kunci    nama di data JSONB
     label    label tampilan
     jenis    text|textarea|angka|uang|tanggal|pilih|centang|multi|email|npwp|nib
     wajib    true → server menolak bila kosong
     opsi     untuk jenis 'pilih' / 'multi'
     bantuan  keterangan kecil di bawah field (dasar aturan bila ada)
     acuan    rujukan peraturan / standar untuk field ini
     pola     regex (string) untuk validasi format
     min/max  batas angka
     hitung   'ppn'|'pph23'|'pph21'|'pph4a2'|'jumlah' → dihitung otomatis

   Alur status seragam: draf → diperiksa → disetujui → final (+ arsip, dibatalkan).
   ============================================================ */
'use strict';

const ALUR = {
  draf: ['diperiksa', 'dibatalkan'],
  diperiksa: ['disetujui', 'draf', 'dibatalkan'],
  disetujui: ['final', 'diperiksa'],
  final: ['arsip'],
  arsip: [],
  dibatalkan: []
};
const STATUS_LABEL = {
  draf: 'Draf', diperiksa: 'Diperiksa', disetujui: 'Disetujui',
  final: 'Final', arsip: 'Arsip', dibatalkan: 'Dibatalkan'
};

/* ---------- potongan skema yang dipakai berulang ---------- */
const NPWP = { pola: '^\\d{2}\\.\\d{3}\\.\\d{3}\\.\\d{1}-\\d{3}\\.\\d{3}$', bantuan: 'Format NPWP: 99.999.999.9-999.999 (Perdirjen PER-04/PJ/2020).' };
const NIB = { pola: '^\\d{13}$', bantuan: 'NIB 13 digit (Perpres 91/2017, sistem OSS).' };
const AKUN_KAS = [
  { nilai: '1110', label: '1110 Kas' },
  { nilai: '1120', label: '1120 Piutang Usaha' },
  { nilai: '1130', label: '1130 Piutang Pajak (PPN Masukan)' },
  { nilai: '1210', label: '1210 Perlengkapan' },
  { nilai: '1310', label: '1310 Peralatan Produksi' },
  { nilai: '2110', label: '2110 Utang Usaha' },
  { nilai: '2120', label: '2120 Utang PPN Keluaran' },
  { nilai: '2130', label: '2130 Utang PPh 23' },
  { nilai: '2140', label: '2140 Utang PPh 21' },
  { nilai: '2150', label: '2150 Utang PPh 4 ayat (2)' },
  { nilai: '3110', label: '3110 Modal Disetor' },
  { nilai: '4110', label: '4110 Pendapatan Iklan' },
  { nilai: '4120', label: '4120 Pendapatan Jasa Produksi' },
  { nilai: '4130', label: '4130 Pendapatan Sponsorship' },
  { nilai: '5110', label: '5110 Beban Gaji' },
  { nilai: '5120', label: '5120 Beban Sewa' },
  { nilai: '5130', label: '5130 Beban Penyusutan' },
  { nilai: '5140', label: '5140 Beban Listrik & Internet' },
  { nilai: '6110', label: '6110 Beban Pajak Final' }
];

const modul = {};

/* ══════════════════════════════════════════════════════════════
   1. KEUANGAN & PAJAK
   Acuan: UU PPh, UU PPN, UU KUP, UU Pajak Daerah & Retribusi,
          SAK Indonesia, PMK 131/2024 (e-Faktur), PER-03/PJ/2022,
          PMK 168/2023 (PPh 21), PP 55/2022 (PPh 21), PP 34/2017.
   ══════════════════════════════════════════════════════════════ */
modul.keuangan = {
  judul: 'Keuangan & Pajak',
  prefiks: 'KEU',
  deskripsi: 'Faktur pajak, bukti potong, pengeluaran, jurnal, laporan keuangan, dan kepatuhan pajak.',
  jenisDokumen: [
    { nilai: 'faktur-pajak', label: 'Faktur Pajak (e-Faktur 010/011)' },
    { nilai: 'bukti-potong-23', label: 'Bukti Potong PPh 23 (jasa)' },
    { nilai: 'bukti-potong-21', label: 'Bukti Potong PPh 21 (pegawai)' },
    { nilai: 'bukti-potong-4a2', label: 'Bukti Potong PPh 4 ayat (2) (sewa)' },
    { nilai: 'pengeluaran', label: 'Bukti Pengeluaran Kas/Bank' },
    { nilai: 'jurnal', label: 'Jurnal Umum' },
    { nilai: 'spt-ppn', label: 'Rekap SPT Masa PPN' },
    { nilai: 'spt-pph-badan', label: 'Rekap SPT Tahunan PPh Badan' },
    { nilai: 'laba-rugi', label: 'Laporan Laba Rugi' },
    { nilai: 'neraca', label: 'Neraca' }
  ],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '16%' },
    { kunci: 'judul', label: 'Uraian', lebar: '30%' },
    { kunci: 'data.jenis', label: 'Jenis', lebar: '18%' },
    { kunci: 'data.tanggal', label: 'Tanggal', lebar: '11%' },
    { kunci: 'data.jumlah', label: 'Jumlah (Rp)', lebar: '15%', uang: true },
    { kunci: 'status', label: 'Status', lebar: '10%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis dokumen', jenis: 'pilih', wajib: true, opsi: null /* diisi dari jenisDokumen */ },
    { kunci: 'tanggal', label: 'Tanggal dokumen', jenis: 'tanggal', wajib: true, acuan: 'UU KUP Pasal 12 — saat terutang' },
    { kunci: 'uraian', label: 'Uraian pekerjaan / barang', jenis: 'text', wajib: true },

    /* --- pihak lawan transaksi --- */
    { kunci: 'nama_lawan', label: 'Nama pengguna jasa / pembeli', jenis: 'text', wajib: true },
    { kunci: 'npwp_lawan', label: 'NPWP lawan transaksi', jenis: 'npwp', acuan: 'PER-04/PJ/2020', ...NPWP },
    { kunci: 'nib_lawan', label: 'NIB (bila ada)', jenis: 'nib', ...NIB },
    { kunci: 'alamat_lawan', label: 'Alamat', jenis: 'textarea' },

    /* --- nilai & pajak --- */
    { kunci: 'dpp', label: 'DPP (Dasar Pengenaan Pajak)', jenis: 'uang', wajib: true, min: 0 },
    { kunci: 'tarif_ppn', label: 'Tarif PPN (%)', jenis: 'angka', bawaan: 11, min: 0, max: 20, acuan: 'UU HPP 7/2021 Pasal 7 — PPN 11%' },
    { kunci: 'ppn', label: 'PPN', jenis: 'uang', hitung: 'ppn', hitungDari: ['dpp', 'tarif_ppn'], acuan: 'UU PPN Pasal 8' },
    { kunci: 'tarif_pph23', label: 'Tarif PPh 23 (%)', jenis: 'angka', bawaan: 2, min: 0, max: 4, acuan: 'UU HPP — jasa 2%, sewa harta selain tanah 2%' },
    { kunci: 'pph23', label: 'PPh 23 dipotong', jenis: 'uang', hitung: 'pph23', hitungDari: ['dpp', 'tarif_pph23'], acuan: 'UU PPh Pasal 23' },
    { kunci: 'jumlah', label: 'Jumlah dibayar', jenis: 'uang', hitung: 'jumlah', hitungDari: ['dpp', 'ppn', 'pph23'] },
    { kunci: 'kode_akun', label: 'Kode akun', jenis: 'pilih', opsi: AKUN_KAS, acuan: 'SAK Indonesia — bagan akun standar' },
    { kunci: 'npwp_perusahaan', label: 'NPWP perusahaan', jenis: 'npwp', acuan: 'Wajib tercantum di faktur pajak' },
    { kunci: 'masa_pajak', label: 'Masa pajak', jenis: 'text', bantuan: 'MM/YYYY, mis. 11/2026', acuan: 'PMK 131/2024' },

    /* --- pembayaran --- */
    { kunci: 'cara_bayar', label: 'Cara pembayaran', jenis: 'pilih', opsi: [
      { nilai: 'transfer', label: 'Transfer bank' }, { nilai: 'tunai', label: 'Tunai' },
      { nilai: 'giro', label: 'Cek/Giro' }, { nilai: 'lain', label: 'Lainnya' }] },
    { kunci: 'bank', label: 'Bank / nomor rekening', jenis: 'text' },
    { kunci: 'jatuh_tempo', label: 'Jatuh tempo', jenis: 'tanggal' },
    { kunci: 'catatan', label: 'Catatan', jenis: 'textarea' }
  ]
};

/* ══════════════════════════════════════════════════════════════
   2. CRM & PIPELINE
   Acuan: praktik B2B media sales; dokumen penawaran & kontrak.
   ══════════════════════════════════════════════════════════════ */
modul.crm = {
  judul: 'CRM & Pipeline',
  prefiks: 'CRM',
  deskripsi: 'Prospek, penawaran, negosiasi, kontrak, dan aktivitas penjualan.',
  jenisDokumen: [
    { nilai: 'prospek', label: 'Prospek baru' },
    { nilai: 'penawaran', label: 'Penawaran (quotation)' },
    { nilai: 'negosiasi', label: 'Negosiasi' },
    { nilai: 'kontrak', label: 'Kontrak / PO' },
    { nilai: 'kunjungan', label: 'Laporan kunjungan klien' }
  ],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '15%' },
    { kunci: 'judul', label: 'Klien / peluang', lebar: '33%' },
    { kunci: 'data.tahap', label: 'Tahap', lebar: '15%' },
    { kunci: 'data.nilai', label: 'Nilai (Rp)', lebar: '15%', uang: true },
    { kunci: 'data.pemilik', label: 'PIC', lebar: '12%' },
    { kunci: 'status', label: 'Status', lebar: '10%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis catatan', jenis: 'pilih', wajib: true },
    { kunci: 'perusahaan', label: 'Nama perusahaan / instansi', jenis: 'text', wajib: true },
    { kunci: 'nib', label: 'NIB', jenis: 'nib', ...NIB },
    { kunci: 'npwp', label: 'NPWP', jenis: 'npwp', ...NPWP },
    { kunci: 'kontak', label: 'Nama kontak', jenis: 'text', wajib: true },
    { kunci: 'jabatan', label: 'Jabatan', jenis: 'text' },
    { kunci: 'email', label: 'Email', jenis: 'email' },
    { kunci: 'telepon', label: 'Telepon', jenis: 'text' },
    { kunci: 'sektor', label: 'Sektor industri', jenis: 'pilih', opsi: [
      { nilai: 'pemerintah', label: 'Pemerintah / BUMN' }, { nilai: 'fmcg', label: 'FMCG' },
      { nilai: 'otomotif', label: 'Otomotif' }, { nilai: 'keuangan', label: 'Jasa keuangan' },
      { nilai: 'kesehatan', label: 'Kesehatan' }, { nilai: 'pendidikan', label: 'Pendidikan' },
      { nilai: 'lain', label: 'Lainnya' }] },
    { kunci: 'tahap', label: 'Tahap pipeline', jenis: 'pilih', opsi: [
      { nilai: 'prospek', label: 'Prospek' }, { nilai: 'penawaran', label: 'Penawaran' },
      { nilai: 'negosiasi', label: 'Negosiasi' }, { nilai: 'kontrak', label: 'Kontrak' },
      { nilai: 'selesai', label: 'Selesai' }, { nilai: 'batal', label: 'Batal' }] },
    { kunci: 'nilai', label: 'Nilai peluang (Rp)', jenis: 'uang', min: 0 },
    { kunci: 'probabilitas', label: 'Probabilitas (%)', jenis: 'angka', min: 0, max: 100 },
    { kunci: 'paket', label: 'Paket yang ditawarkan', jenis: 'multi', opsi: [
      { nilai: 'iklan-tv', label: 'Iklan TV' }, { nilai: 'iklan-digital', label: 'Iklan digital' },
      { nilai: 'produksi', label: 'Jasa produksi' }, { nilai: 'podcast', label: 'Podcast' },
      { nilai: 'sponsorship', label: 'Sponsorship program' }, { nilai: 'event', label: 'Event' }] },
    { kunci: 'target_tutup', label: 'Target penutupan', jenis: 'tanggal' },
    { kunci: 'pemilik', label: 'PIC internal', jenis: 'text' },
    { kunci: 'sumber', label: 'Sumber prospek', jenis: 'pilih', opsi: [
      { nilai: 'referensi', label: 'Referensi' }, { nilai: 'outbound', label: 'Outbound' },
      { nilai: 'inbound', label: 'Inbound' }, { nilai: 'tender', label: 'Tender/pengadaan' }] },
    { kunci: 'ringkasan', label: 'Ringkasan kebutuhan klien', jenis: 'textarea' },
    { kunci: 'tindak_lanjut', label: 'Tindak lanjut berikutnya', jenis: 'text' }
  ]
};

/* ══════════════════════════════════════════════════════════════
   3. IKLAN & SPONSORSHIP
   Acuan: UU Penyiaran 32/2002 (Pasal 20, 21, 46-48), P3SPS KPI,
          Etika Pariwara Indonesia (EPI), UU PDP 27/2022.
   ══════════════════════════════════════════════════════════════ */
modul.ads = {
  judul: 'Iklan & Sponsorship',
  prefiks: 'IKL',
  deskripsi: 'Insertion order, jadwal tayang, bukti tayang, dan kepatuhan etika iklan.',
  jenisDokumen: [
    { nilai: 'io', label: 'Insertion Order (IO)' },
    { nilai: 'jadwal', label: 'Jadwal tayang iklan' },
    { nilai: 'sponsorship', label: 'Perjanjian sponsorship program' },
    { nilai: 'advertorial', label: 'Advertorial / iklan layanan masyarakat' },
    { nilai: 'bukti-tayang', label: 'Bukti tayang (post-buy) ' }
  ],
  kolom: [
    { kunci: 'nomor', label: 'Nomor IO', lebar: '15%' },
    { kunci: 'judul', label: 'Pengiklan / kampanye', lebar: '32%' },
    { kunci: 'data.periode_mulai', label: 'Mulai', lebar: '11%' },
    { kunci: 'data.nilai', label: 'Nilai (Rp)', lebar: '15%', uang: true },
    { kunci: 'data.status_tayang', label: 'Tayang', lebar: '17%' },
    { kunci: 'status', label: 'Status', lebar: '10%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis dokumen', jenis: 'pilih', wajib: true },
    { kunci: 'pengiklan', label: 'Pengiklan / brand', jenis: 'text', wajib: true },
    { kunci: 'produk', label: 'Produk yang diiklankan', jenis: 'text', wajib: true },
    { kunci: 'agensi', label: 'Agensi / perantara', jenis: 'text' },
    { kunci: 'npwp', label: 'NPWP pengiklan', jenis: 'npwp', ...NPWP },
    { kunci: 'kanal', label: 'Kanal tayang', jenis: 'multi', wajib: true, opsi: [
      { nilai: 'tv', label: 'TV' }, { nilai: 'digital', label: 'Digital/website' },
      { nilai: 'youtube', label: 'YouTube' }, { nilai: 'sosmed', label: 'Media sosial' },
      { nilai: 'radio', label: 'Radio' }], acuan: 'UU Penyiaran Pasal 1 angka 12' },
    { kunci: 'format', label: 'Format materi', jenis: 'pilih', opsi: [
      { nilai: 'spot-15', label: 'Spot 15 detik' }, { nilai: 'spot-30', label: 'Spot 30 detik' },
      { nilai: 'spot-60', label: 'Spot 60 detik' }, { nilai: 'adlib', label: 'Ad-lib / live' },
      { nilai: 'banner', label: 'Banner digital' }, { nilai: 'advertorial', label: 'Advertorial' }] },
    { kunci: 'periode_mulai', label: 'Periode mulai', jenis: 'tanggal', wajib: true },
    { kunci: 'periode_akhir', label: 'Periode berakhir', jenis: 'tanggal', wajib: true },
    { kunci: 'slot', label: 'Slot / program', jenis: 'text', bantuan: 'Contoh: Prime Time 19.00–20.00, program “Kabar Malam”.' },
    { kunci: 'jumlah_tayang', label: 'Jumlah tayang (spot)', jenis: 'angka', min: 1 },
    { kunci: 'nilai', label: 'Nilai kontrak (Rp)', jenis: 'uang', wajib: true, min: 0 },
    { kunci: 'ppn', label: 'PPN 11%', jenis: 'uang', hitung: 'ppn_kontrak', hitungDari: ['nilai'], acuan: 'Jasa periklanan = objek PPN' },
    { kunci: 'status_tayang', label: 'Status tayang', jenis: 'pilih', opsi: [
      { nilai: 'belum', label: 'Belum tayang' }, { nilai: 'sebagian', label: 'Sebagian' },
      { nilai: 'selesai', label: 'Selesai tayang' }, { nilai: 'batal', label: 'Dibatalkan' }] },

    /* --- kepatuhan iklan (wajib diisi sebelum tayang) --- */
    { kunci: 'izin_iklan', label: 'Nomor izin iklan / materi lolos sensor', jenis: 'text', acuan: 'UU Penyiaran Pasal 21 & P3SPS' },
    { kunci: 'cek_etika', label: 'Pemeriksaan Etika Pariwara Indonesia', jenis: 'multi', opsi: [
      { nilai: 'tidak-menyesatkan', label: 'Tidak menyesatkan (EPI Bab II)' },
      { nilai: 'tidak-klaim-palsu', label: 'Tidak memuat klaim tanpa bukti' },
      { nilai: 'bebas-rendah', label: 'Tidak merendahkan pihak lain' },
      { nilai: 'bebas-rokok', label: 'Bebas produk rokok (Pasal 46 ayat 3)' },
      { nilai: 'bebas-obat', label: 'Obat tradisional/konvensional/tabel letak' },
      { nilai: 'ramah-anak', label: 'Ramah anak — ditayangkan pukul 05.00–18.00 (Pasal 21)' }] },
    { kunci: 'kategori_jam', label: 'Kategori jam tayang', jenis: 'pilih', opsi: [
      { nilai: 'anak', label: 'Jam anak (05.00–18.00)' },
      { nilai: 'dewasa', label: 'Jam dewasa (18.00–05.00)' }], acuan: 'UU Penyiaran Pasal 21 ayat (2)' },
    { kunci: 'data_pribadi', label: 'Memakai data pribadi konsumen', jenis: 'centang', bantuan: 'Wajib persetujuan tertulis bila membidik segmen berbasis data pribadi (UU PDP 27/2022 Pasal 20).' },
    { kunci: 'catatan', label: 'Catatan', jenis: 'textarea' }
  ]
};

/* ══════════════════════════════════════════════════════════════
   4. PRODUKSI & STUDIO
   Acuan: UU Penyiaran Pasal 14 & 20 (isi siaran), K3 (UU 1/1970),
          UU PDP 27/2022 untuk data narasumber.
   ══════════════════════════════════════════════════════════════ */
modul.produksi = {
  judul: 'Produksi & Studio',
  prefiks: 'PRD',
  deskripsi: 'Penugasan produksi, berita acara shooting, izin lokasi, dan daftar peralatan.',
  jenisDokumen: [
    { nilai: 'rencana', label: 'Rencana produksi / shooting plan' },
    { nilai: 'penugasan', label: 'Surat penugasan liputan' },
    { nilai: 'izin-lokasi', label: 'Izin lokasi / parkir / pendirian alat' },
    { nilai: 'ba-syuting', label: 'Berita acara syuting' },
    { nilai: 'ba-studio', label: 'Berita acara penggunaan studio' },
    { nilai: 'peralatan', label: 'Daftar peralatan dibawa' }
  ],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '15%' },
    { kunci: 'judul', label: 'Proyek / liputan', lebar: '34%' },
    { kunci: 'data.mulai', label: 'Mulai', lebar: '12%' },
    { kunci: 'data.lokasi', label: 'Lokasi', lebar: '22%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis dokumen', jenis: 'pilih', wajib: true },
    { kunci: 'proyek', label: 'Nama proyek / liputan', jenis: 'text', wajib: true },
    { kunci: 'klien', label: 'Klien / rubrik', jenis: 'text' },
    { kunci: 'mulai', label: 'Tanggal mulai', jenis: 'tanggal', wajib: true },
    { kunci: 'selesai', label: 'Tanggal selesai', jenis: 'tanggal' },
    { kunci: 'jam_mulai', label: 'Jam mulai (WIB)', jenis: 'text', bantuan: 'HH:MM, mis. 08.30' },
    { kunci: 'lokasi', label: 'Lokasi', jenis: 'text', wajib: true },
    { kunci: 'koordinat', label: 'Koordinat (lat,long)', jenis: 'text', bantuan: 'Memudahkan kru lapangan, mis. -7.816,112.011.' },
    { kunci: 'kru', label: 'Kru yang bertugas', jenis: 'textarea', bantuan: 'Satu nama per baris: Produser, Kameraman, Audio, Reporter, Editor.' },
    { kunci: 'peralatan', label: 'Peralatan utama', jenis: 'multi', opsi: [
      { nilai: 'kamera', label: 'Kamera' }, { nilai: 'audio', label: 'Audio/mixer' },
      { nilai: 'lighting', label: 'Lighting' }, { nilai: 'drone', label: 'Drone' },
      { nilai: 'switcher', label: 'Switcher/tricaster' }, { nilai: 'genset', label: 'Genset' },
      { nilai: 'streaming', label: 'Perangkat streaming' }] },
    { kunci: 'durasi_jam', label: 'Perkiraan durasi (jam)', jenis: 'angka', min: 0 },
    { kunci: 'izin', label: 'Nomor izin keramaian/lokasi', jenis: 'text', bantuan: 'Wajib untuk lokasi publik & fasilitas pemerintah.' },
    { kunci: 'keselamatan', label: 'Pemeriksaan keselamatan kerja', jenis: 'multi', opsi: [
      { nilai: 'apd', label: 'Alat pelindung diri tersedia' },
      { nilai: 'evakuasi', label: 'Jalur evakuasi diketahui' },
      { nilai: 'listrik', label: 'Sumber listrik aman' },
      { nilai: 'peserta', label: 'Peserta shooting mendapat taklimat' }], acuan: 'UU 1/1970 Keselamatan Kerja' },
    { kunci: 'narasumber', label: 'Narasumber & kontak', jenis: 'textarea', bantuan: 'Data pribadi narasumber — disimpan terbatas (UU PDP 27/2022).' },
    { kunci: 'catatan', label: 'Catatan teknis', jenis: 'textarea' }
  ]
};

/* ══════════════════════════════════════════════════════════════
   5. AKUISISI / EDITORIAL — dipakai modul artikel, antrean, kalender
   Acuan: UU Pers 40/1999 (Kode Etik Jurnalistik), P3SPS KPI, UU ITE.
   ══════════════════════════════════════════════════════════════ */
modul.articles = {
  judul: 'Artikel (CMS)',
  prefiks: 'ART',
  deskripsi: 'Dokumen editorial: verifikasi fakta, hak jawab, dan kelayakan terbit.',
  jenisDokumen: [
    { nilai: 'cek-fakta', label: 'Lembar verifikasi fakta' },
    { nilai: 'hak-jawab', label: 'Permintaan & pemenuhan hak jawab' },
    { nilai: 'klarifikasi', label: 'Klarifikasi / koreksi artikel' },
    { nilai: 'naskah-luar', label: 'Naskah dari kontributor' }
  ],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '14%' },
    { kunci: 'judul', label: 'Judul / perkara', lebar: '40%' },
    { kunci: 'data.tanggal', label: 'Tanggal', lebar: '12%' },
    { kunci: 'dibuat_oleh', label: 'Penyusun', lebar: '22%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis dokumen', jenis: 'pilih', wajib: true },
    { kunci: 'judul_perkara', label: 'Judul artikel / perkara', jenis: 'text', wajib: true },
    { kunci: 'tanggal', label: 'Tanggal', jenis: 'tanggal', wajib: true },
    { kunci: 'reporter', label: 'Reporter / penyusun', jenis: 'text', wajib: true },
    { kunci: 'redaktur', label: 'Redaktur yang memeriksa', jenis: 'text' },
    { kunci: 'sumber', label: 'Sumber & dokumen pendukung', jenis: 'textarea', bantuan: 'Sebutkan nama, jabatan, tanggal, dan bentuk (wawancara/dokumen/observasi).' },
    { kunci: 'cek', label: 'Butir verifikasi', jenis: 'multi', opsi: [
      { nilai: 'dua-sumber', label: 'Minimal dua sumber independen' },
      { nilai: 'dokumen', label: 'Dokumen resmi diverifikasi' },
      { nilai: 'angka', label: 'Angka & data dicocokkan sumber resmi' },
      { nilai: 'praduga', label: 'Tidak melanggar praduga tak bersalah (KEJ Pasal 3)' },
      { nilai: 'anak', label: 'Tidak menyebut identitas anak (Pasal 5)' },
      { nilai: 'kekerasan', label: 'Tidak menyiarkan kekerasan seksual secara detail' },
      { nilai: 'hak-jawab', label: 'Hak jawab sudah diminta (UU Pers Pasal 5)' }] },
    { kunci: 'riwayat', label: 'Riwayat permintaan hak jawab', jenis: 'textarea' },
    { kunci: 'risiko', label: 'Perkiraan risiko hukum', jenis: 'pilih', opsi: [
      { nilai: 'rendah', label: 'Rendah' }, { nilai: 'sedang', label: 'Sedang' },
      { nilai: 'tinggi', label: 'Tinggi — perlu tinjauan hukum' }] },
    { kunci: 'catatan', label: 'Catatan redaktur', jenis: 'textarea' }
  ]
};

modul.antrean = {
  ...modul.articles,
  judul: 'Kiriman & Laporan',
  prefiks: 'KRJ',
  deskripsi: 'Kiriman warga/kontributor dan laporan masyarakat beserta verifikasinya.',
  jenisDokumen: [
    { nilai: 'kiriman-kontributor', label: 'Kiriman kontributor' },
    { nilai: 'laporan-warga', label: 'Laporan warga' },
    { nilai: 'tindak-lanjut', label: 'Tindak lanjut laporan' }
  ]
};
modul.antrean.field = [
  ...modul.articles.field.slice(0, 4),
  { kunci: 'kanal', label: 'Kanal masuk', jenis: 'pilih', opsi: [
    { nilai: 'web', label: 'Formulir web' }, { nilai: 'wa', label: 'WhatsApp' },
    { nilai: 'email', label: 'Email' }, { nilai: 'sosmed', label: 'Media sosial' },
    { nilai: 'datang', label: 'Datang langsung' }] },
  { kunci: 'identitas', label: 'Identitas pelapor', jenis: 'pilih', opsi: [
    { nilai: 'terbuka', label: 'Bersedia disebut' },
    { nilai: 'tertutup', label: 'Minta dilindungi — identitas disimpan' }], acuan: 'UU Pers Pasal 17 — hak menolak menyebut sumber' },
  { kunci: 'ringkasan', label: 'Ringkasan laporan', jenis: 'textarea', wajib: true },
  { kunci: 'bukti', label: 'Bukti pendukung', jenis: 'textarea' },
  { kunci: 'verifikasi', label: 'Hasil verifikasi', jenis: 'pilih', opsi: [
    { nilai: 'belum', label: 'Belum diverifikasi' }, { nilai: 'valid', label: 'Valid — layak diberitakan' },
    { nilai: 'sebagian', label: 'Sebagian valid' }, { nilai: 'tidak-valid', label: 'Tidak valid' }] },
  { kunci: 'catatan', label: 'Catatan', jenis: 'textarea' }
];

modul.calendar = {
  judul: 'Kalender Editorial',
  prefiks: 'KAL',
  deskripsi: 'Perencanaan agenda liputan, hari besar, dan jadwal terbit.',
  jenisDokumen: [
    { nilai: 'rencana-liputan', label: 'Rencana liputan' },
    { nilai: 'agenda', label: 'Agenda / hari besar' },
    { nilai: 'siaran-langsung', label: 'Rencana siaran langsung' }
  ],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '14%' },
    { kunci: 'judul', label: 'Agenda', lebar: '40%' },
    { kunci: 'data.tanggal', label: 'Tanggal', lebar: '14%' },
    { kunci: 'data.penanggung', label: 'Penanggung jawab', lebar: '20%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis', jenis: 'pilih', wajib: true },
    { kunci: 'agenda', label: 'Nama agenda', jenis: 'text', wajib: true },
    { kunci: 'tanggal', label: 'Tanggal', jenis: 'tanggal', wajib: true },
    { kunci: 'jam', label: 'Jam (WIB)', jenis: 'text', bantuan: 'HH:MM' },
    { kunci: 'lokasi', label: 'Lokasi / kanal', jenis: 'text' },
    { kunci: 'penanggung', label: 'Penanggung jawab', jenis: 'text', wajib: true },
    { kunci: 'kru', label: 'Kru', jenis: 'textarea' },
    { kunci: 'prioritas', label: 'Prioritas', jenis: 'pilih', opsi: [
      { nilai: 'tinggi', label: 'Tinggi' }, { nilai: 'sedang', label: 'Sedang' }, { nilai: 'rendah', label: 'Rendah' }] },
    { kunci: 'catatan', label: 'Catatan', jenis: 'textarea' }
  ]
};

modul.desk = {
  judul: 'Meja Redaksi',
  prefiks: 'DSK',
  deskripsi: 'Catatan rapat redaksi, instruksi harian, dan penugasan.',
  jenisDokumen: [
    { nilai: 'notulen', label: 'Notulen rapat redaksi' },
    { nilai: 'instruksi', label: 'Instruksi harian' },
    { nilai: 'evaluasi', label: 'Evaluasi tayangan' }
  ],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '14%' },
    { kunci: 'judul', label: 'Agenda rapat', lebar: '40%' },
    { kunci: 'data.tanggal', label: 'Tanggal', lebar: '14%' },
    { kunci: 'dibuat_oleh', label: 'Pemimpin rapat', lebar: '20%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis', jenis: 'pilih', wajib: true },
    { kunci: 'agenda', label: 'Agenda', jenis: 'text', wajib: true },
    { kunci: 'tanggal', label: 'Tanggal', jenis: 'tanggal', wajib: true },
    { kunci: 'pemimpin', label: 'Pemimpin rapat', jenis: 'text', wajib: true },
    { kunci: 'peserta', label: 'Peserta', jenis: 'textarea' },
    { kunci: 'pembahasan', label: 'Pokok pembahasan', jenis: 'textarea', wajib: true },
    { kunci: 'keputusan', label: 'Keputusan', jenis: 'textarea' },
    { kunci: 'penugasan', label: 'Penugasan & tenggat', jenis: 'textarea' },
    { kunci: 'catatan', label: 'Catatan', jenis: 'textarea' }
  ]
};

/* ══════════════════════════════════════════════════════════════
   6. MEDIA, MODERASI, ANALITIK
   ══════════════════════════════════════════════════════════════ */
modul.media = {
  judul: 'Media Library',
  prefiks: 'MDA',
  deskripsi: 'Registri aset media: hak pakai, lisensi, dan sumber.',
  jenisDokumen: [
    { nilai: 'video', label: 'Video' }, { nilai: 'foto', label: 'Foto' },
    { nilai: 'audio', label: 'Audio' }, { nilai: 'dokumen', label: 'Dokumen' },
    { nilai: 'grafis', label: 'Grafis / motion' }
  ],
  kolom: [
    { kunci: 'nomor', label: 'Kode', lebar: '14%' },
    { kunci: 'judul', label: 'Nama aset', lebar: '38%' },
    { kunci: 'data.jenis', label: 'Jenis', lebar: '12%' },
    { kunci: 'data.hak', label: 'Hak pakai', lebar: '22%' },
    { kunci: 'status', label: 'Status', lebar: '14%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis aset', jenis: 'pilih', wajib: true },
    { kunci: 'nama', label: 'Nama / judul aset', jenis: 'text', wajib: true },
    { kunci: 'deskripsi', label: 'Deskripsi', jenis: 'textarea' },
    { kunci: 'sumber', label: 'Sumber / pemilik', jenis: 'text', wajib: true },
    { kunci: 'hak', label: 'Status hak cipta', jenis: 'pilih', wajib: true, opsi: [
      { nilai: 'milik', label: 'Milik sendiri' },
      { nilai: 'lisensi', label: 'Berlisensi (sebutkan jenisnya)' },
      { nilai: 'izin', label: 'Izin tertulis pemilik' },
      { nilai: 'domain-publik', label: 'Domain publik' },
      { nilai: 'fair-use', label: 'Kutipan berita (UU Hak Cipta Pasal 43)' }], acuan: 'UU 28/2014 Hak Cipta Pasal 43 & 44' },
    { nilai: 'lisensi', label: 'Jenis lisensi / nomor izin', jenis: 'text' },
    { nilai: 'berlaku_sampai', label: 'Berlaku sampai', jenis: 'tanggal' },
    { nilai: 'kredit', label: 'Kredit yang wajib dicantumkan', jenis: 'text' },
    { kunci: 'lokasi', label: 'Lokasi penyimpanan / URL', jenis: 'text' },
    { kunci: 'kualitas', label: 'Spesifikasi teknis', jenis: 'text', bantuan: 'Resolusi, rasio, codec, atau durasi.' },
    { kunci: 'catatan', label: 'Catatan', jenis: 'textarea' }
  ]
};

modul.moderation = {
  judul: 'Moderasi Komentar',
  prefiks: 'MOD',
  deskripsi: 'Keputusan moderasi komentar dan alasan penolakan.',
  jenisDokumen: [
    { nilai: 'penolakan', label: 'Penolakan komentar' },
    { nilai: 'penghapusan', label: 'Penghapusan konten' },
    { nilai: 'pemblokiran', label: 'Pemblokiran akun' },
    { nilai: 'banding', label: 'Penanganan banding' }
  ],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '14%' },
    { kunci: 'judul', label: 'Komentar / akun', lebar: '40%' },
    { kunci: 'data.alasan', label: 'Alasan', lebar: '22%' },
    { kunci: 'data.tanggal', label: 'Tanggal', lebar: '12%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Tindakan', jenis: 'pilih', wajib: true },
    { kunci: 'tanggal', label: 'Tanggal', jenis: 'tanggal', wajib: true },
    { kunci: 'komentar', label: 'Kutipan komentar / nama akun', jenis: 'textarea', wajib: true },
    { kunci: 'artikel', label: 'Artikel terkait', jenis: 'text' },
    { kunci: 'alasan', label: 'Alasan', jenis: 'pilih', wajib: true, opsi: [
      { nilai: 'sara', label: 'SARA / ujaran kebencian' },
      { nilai: 'pornografi', label: 'Pornografi' },
      { nilai: 'pencemaran', label: 'Pencemaran nama baik' },
      { nilai: 'ancaman', label: 'Ancaman / kekerasan' },
      { nilai: 'spam', label: 'Spam / promosi' },
      { nilai: 'data-pribadi', label: 'Menyebar data pribadi' }], acuan: 'UU ITE 19/2016 Pasal 27–28; UU PDP 27/2022' },
    { kunci: 'dasar', label: 'Dasar aturan', jenis: 'text', bantuan: 'Pasal pada pedoman komunitas / UU ITE yang dilanggar.' },
    { kunci: 'bukti', label: 'Tangkapan layar / bukti', jenis: 'text' },
    { kunci: 'pemberitahuan', label: 'Pengguna diberi tahu', jenis: 'centang' },
    { kunci: 'catatan', label: 'Catatan', jenis: 'textarea' }
  ]
};

modul['content-analytics'] = {
  judul: 'Analitik Konten',
  prefiks: 'ANL',
  deskripsi: 'Laporan kinerja konten dan evaluasi redaksi.',
  jenisDokumen: [{ nilai: 'kinerja', label: 'Laporan kinerja konten' }, { nilai: 'evaluasi', label: 'Evaluasi rubrik' }],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '16%' },
    { kunci: 'judul', label: 'Judul laporan', lebar: '42%' },
    { kunci: 'data.periode', label: 'Periode', lebar: '20%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis', jenis: 'pilih', wajib: true },
    { kunci: 'periode', label: 'Periode', jenis: 'text', wajib: true, bantuan: 'MM/YYYY atau rentang tanggal.' },
    { kunci: 'kanal', label: 'Kanal', jenis: 'multi', opsi: [
      { nilai: 'web', label: 'Website' }, { nilai: 'tv', label: 'TV' },
      { nilai: 'youtube', label: 'YouTube' }, { nilai: 'sosmed', label: 'Media sosial' }] },
    { kunci: 'tayangan', label: 'Total tayangan', jenis: 'angka', min: 0 },
    { kunci: 'pembaca', label: 'Pembaca / pemirsa', jenis: 'angka', min: 0 },
    { kunci: 'durasi', label: 'Rata-rata durasi (detik)', jenis: 'angka', min: 0 },
    { kunci: 'temuan', label: 'Temuan', jenis: 'textarea' },
    { kunci: 'rekomendasi', label: 'Rekomendasi', jenis: 'textarea' }
  ]
};

modul.findings = {
  judul: 'Temuan AI',
  prefiks: 'TMA',
  deskripsi: 'Keputusan redaktur atas temuan agen AI (diterima/ditolak) beserta alasannya.',
  jenisDokumen: [{ nilai: 'keputusan', label: 'Keputusan atas temuan AI' }, { nilai: 'eskalasi', label: 'Eskalasi ke redaktur' }],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '16%' },
    { kunci: 'judul', label: 'Temuan', lebar: '42%' },
    { kunci: 'data.agen', label: 'Agen', lebar: '18%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis', jenis: 'pilih', wajib: true },
    { kunci: 'agen', label: 'Agen AI', jenis: 'pilih', opsi: [
      { nilai: 'riset', label: 'Pencari Berita' }, { nilai: 'klarifikasi', label: 'Verifikator & Klarifikasi' },
      { nilai: 'penyunting', label: 'Penyunting Naskah' }, { nilai: 'seo', label: 'SEO & Judul' },
      { nilai: 'etika', label: 'Hukum & Etika' }, { nilai: 'data', label: 'Analis Data' }] },
    { kunci: 'artikel', label: 'Artikel terkait', jenis: 'text' },
    { kunci: 'temuan', label: 'Isi temuan', jenis: 'textarea', wajib: true },
    { kunci: 'keputusan', label: 'Keputusan redaktur', jenis: 'pilih', opsi: [
      { nilai: 'diterima', label: 'Diterima — ditindaklanjuti' },
      { nilai: 'sebagian', label: 'Diterima sebagian' },
      { nilai: 'ditolak', label: 'Ditolak' }] },
    { kunci: 'alasan', label: 'Alasan keputusan', jenis: 'textarea', bantuan: 'Keputusan atas saran AI wajib punya alasan manusia — AI tidak boleh jadi penentu akhir.' }
  ]
};

/* ══════════════════════════════════════════════════════════════
   7. DASBOR, LAPORAN, AUDIT, MASTER DATA, PENGGUNA, PENGATURAN
   ══════════════════════════════════════════════════════════════ */
modul.dashboard = {
  judul: 'Dasbor Direksi',
  prefiks: 'DSB',
  deskripsi: 'Catatan arahan pimpinan & keputusan strategis.',
  jenisDokumen: [{ nilai: 'arahan', label: 'Arahan direksi' }, { nilai: 'keputusan', label: 'Keputusan strategis' }],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '16%' },
    { kunci: 'judul', label: 'Pokok arahan', lebar: '42%' },
    { kunci: 'data.tanggal', label: 'Tanggal', lebar: '14%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis', jenis: 'pilih', wajib: true },
    { kunci: 'tanggal', label: 'Tanggal', jenis: 'tanggal', wajib: true },
    { kunci: 'pokok', label: 'Pokok arahan', jenis: 'text', wajib: true },
    { kunci: 'latar', label: 'Latar belakang', jenis: 'textarea' },
    { kunci: 'arahan', label: 'Arahan / keputusan', jenis: 'textarea', wajib: true },
    { kunci: 'unit', label: 'Unit pelaksana', jenis: 'multi', opsi: [
      { nilai: 'redaksi', label: 'Redaksi' }, { nilai: 'produksi', label: 'Produksi' },
      { nilai: 'keuangan', label: 'Keuangan' }, { nilai: 'komersial', label: 'Komersial' },
      { nilai: 'umum', label: 'Umum/SDM' }] },
    { kunci: 'tenggat', label: 'Tenggat', jenis: 'tanggal' }
  ]
};

modul.laporan = {
  judul: 'Laporan & BI',
  prefiks: 'LAP',
  deskripsi: 'Laporan manajemen berkala (harian, bulanan, tahunan).',
  jenisDokumen: [
    { nilai: 'harian', label: 'Laporan harian' }, { nilai: 'bulanan', label: 'Laporan bulanan' },
    { nilai: 'triwulan', label: 'Laporan triwulan' }, { nilai: 'tahunan', label: 'Laporan tahunan' }
  ],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '16%' },
    { kunci: 'judul', label: 'Judul laporan', lebar: '40%' },
    { kunci: 'data.periode', label: 'Periode', lebar: '18%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis laporan', jenis: 'pilih', wajib: true },
    { kunci: 'periode', label: 'Periode', jenis: 'text', wajib: true },
    { kunci: 'unit', label: 'Unit', jenis: 'pilih', opsi: [
      { nilai: 'redaksi', label: 'Redaksi' }, { nilai: 'produksi', label: 'Produksi' },
      { nilai: 'keuangan', label: 'Keuangan' }, { nilai: 'komersial', label: 'Komersial' },
      { nilai: 'perusahaan', label: 'Perusahaan' }] },
    { kunci: 'ringkasan', label: 'Ringkasan eksekutif', jenis: 'textarea', wajib: true },
    { kunci: 'capaian', label: 'Capaian', jenis: 'textarea' },
    { kunci: 'kendala', label: 'Kendala', jenis: 'textarea' },
    { kunci: 'rencana', label: 'Rencana tindak lanjut', jenis: 'textarea' },
    { kunci: 'penerima', label: 'Penerima laporan', jenis: 'text' }
  ]
};

modul.audit = {
  judul: 'Audit Trail',
  prefiks: 'AUD',
  deskripsi: 'Catatan pemeriksaan internal & tindak lanjut temuan.',
  jenisDokumen: [{ nilai: 'pemeriksaan', label: 'Pemeriksaan internal' }, { nilai: 'tindak-lanjut', label: 'Tindak lanjut temuan' }],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '16%' },
    { kunci: 'judul', label: 'Objek pemeriksaan', lebar: '38%' },
    { kunci: 'data.tingkat', label: 'Tingkat', lebar: '16%' },
    { kunci: 'data.tanggal', label: 'Tanggal', lebar: '14%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis', jenis: 'pilih', wajib: true },
    { kunci: 'tanggal', label: 'Tanggal pemeriksaan', jenis: 'tanggal', wajib: true },
    { kunci: 'objek', label: 'Objek pemeriksaan', jenis: 'text', wajib: true },
    { kunci: 'tingkat', label: 'Tingkat', jenis: 'pilih', opsi: [
      { nilai: 'rutin', label: 'Rutin' }, { nilai: 'khusus', label: 'Khusus' }, { nilai: 'mendadak', label: 'Mendadak' }] },
    { kunci: 'temuan', label: 'Temuan', jenis: 'textarea', wajib: true },
    { kunci: 'risiko', label: 'Kategori risiko', jenis: 'pilih', opsi: [
      { nilai: 'tinggi', label: 'Tinggi' }, { nilai: 'sedang', label: 'Sedang' }, { nilai: 'rendah', label: 'Rendah' }] },
    { kunci: 'rekomendasi', label: 'Rekomendasi', jenis: 'textarea' },
    { kunci: 'tenggat', label: 'Tenggat tindak lanjut', jenis: 'tanggal' }
  ]
};

modul.master = {
  judul: 'Master Data',
  prefiks: 'MST',
  deskripsi: 'Permintaan perubahan data induk (klien, vendor, produk, tarif).',
  jenisDokumen: [{ nilai: 'klien-baru', label: 'Klien baru' }, { nilai: 'vendor-baru', label: 'Vendor baru' },
    { nilai: 'tarif', label: 'Perubahan tarif' }, { nilai: 'produk', label: 'Produk / paket baru' }],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '16%' },
    { kunci: 'judul', label: 'Nama data', lebar: '40%' },
    { kunci: 'data.kategori', label: 'Kategori', lebar: '18%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis permintaan', jenis: 'pilih', wajib: true },
    { kunci: 'kategori', label: 'Kategori data', jenis: 'pilih', wajib: true, opsi: [
      { nilai: 'klien', label: 'Klien' }, { nilai: 'vendor', label: 'Vendor' },
      { nilai: 'produk', label: 'Produk/paket' }, { nilai: 'tarif', label: 'Tarif' }] },
    { kunci: 'nama', label: 'Nama data', jenis: 'text', wajib: true },
    { kunci: 'npwp', label: 'NPWP', jenis: 'npwp', ...NPWP },
    { kunci: 'nib', label: 'NIB', jenis: 'nib', ...NIB },
    { kunci: 'alamat', label: 'Alamat', jenis: 'textarea' },
    { kunci: 'kontak', label: 'Kontak', jenis: 'text' },
    { kunci: 'nilai', label: 'Nilai / tarif (Rp)', jenis: 'uang', min: 0 },
    { kunci: 'berlaku_mulai', label: 'Berlaku mulai', jenis: 'tanggal' },
    { kunci: 'alasan', label: 'Alasan perubahan', jenis: 'textarea', wajib: true }
  ]
};

modul['ai-studio'] = {
  judul: 'Studio AI',
  prefiks: 'AIS',
  deskripsi: 'Catatan pemakaian agen AI: maksud, hasil, dan keputusan manusia.',
  jenisDokumen: [{ nilai: 'permintaan', label: 'Permintaan analisis' }, { nilai: 'keputusan', label: 'Keputusan atas hasil' }],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '16%' },
    { kunci: 'judul', label: 'Maksud pemakaian', lebar: '40%' },
    { kunci: 'data.agen', label: 'Agen', lebar: '18%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis', jenis: 'pilih', wajib: true },
    { kunci: 'maksud', label: 'Maksud pemakaian', jenis: 'text', wajib: true },
    { kunci: 'agen', label: 'Agen', jenis: 'multi', opsi: [
      { nilai: 'riset', label: 'Pencari Berita' }, { nilai: 'klarifikasi', label: 'Verifikator' },
      { nilai: 'penyunting', label: 'Penyunting' }, { nilai: 'seo', label: 'SEO' },
      { nilai: 'etika', label: 'Hukum & Etika' }, { nilai: 'data', label: 'Analis Data' }] },
    { kunci: 'catatan_manusia', label: 'Keputusan manusia', jenis: 'textarea', wajib: true, bantuan: 'Hasil AI wajib ditinjau manusia sebelum dipakai (kebijakan redaksi).' },
    { kunci: 'data_pribadi', label: 'Memuat data pribadi', jenis: 'centang', acuan: 'UU PDP 27/2022' }
  ]
};

modul.pengguna = {
  judul: 'Pengguna & Peran',
  prefiks: 'PGR',
  deskripsi: 'Permintaan perubahan akses & mutasi staf.',
  jenisDokumen: [{ nilai: 'mutasi', label: 'Mutasi / perubahan peran' }, { nilai: 'pencabutan', label: 'Pencabutan akses' },
    { nilai: 'permintaan-akses', label: 'Permintaan akses baru' }],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '16%' },
    { kunci: 'judul', label: 'Nama staf', lebar: '36%' },
    { kunci: 'data.peran', label: 'Peran', lebar: '18%' },
    { kunci: 'data.tanggal', label: 'Tanggal', lebar: '14%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis permintaan', jenis: 'pilih', wajib: true },
    { kunci: 'tanggal', label: 'Tanggal berlaku', jenis: 'tanggal', wajib: true },
    { kunci: 'staf', label: 'Nama staf', jenis: 'text', wajib: true },
    { kunci: 'email', label: 'Email', jenis: 'email', wajib: true },
    { kunci: 'peran', label: 'Peran', jenis: 'pilih', opsi: [
      { nilai: 'admin', label: 'Administrator' }, { nilai: 'direksi', label: 'Direksi' },
      { nilai: 'pemred', label: 'Pemimpin Redaksi' }, { nilai: 'redaktur', label: 'Redaktur' },
      { nilai: 'reporter', label: 'Reporter' }, { nilai: 'editorial', label: 'Staf Editorial' },
      { nilai: 'finance', label: 'Keuangan' }, { nilai: 'sales', label: 'Komersial' }] },
    { kunci: 'alasan', label: 'Alasan', jenis: 'textarea', wajib: true },
    { kunci: 'penyetuju', label: 'Penyetuju', jenis: 'text' }
  ]
};

modul.pengaturan = {
  judul: 'Pengaturan',
  prefiks: 'PGS',
  deskripsi: 'Kebijakan internal, SOP, dan catatan perubahan konfigurasi.',
  jenisDokumen: [{ nilai: 'sop', label: 'SOP' }, { nilai: 'kebijakan', label: 'Kebijakan internal' },
    { nilai: 'konfigurasi', label: 'Catatan perubahan konfigurasi' }],
  kolom: [
    { kunci: 'nomor', label: 'Nomor', lebar: '16%' },
    { kunci: 'judul', label: 'Judul', lebar: '44%' },
    { kunci: 'data.berlaku', label: 'Berlaku', lebar: '16%' },
    { kunci: 'status', label: 'Status', lebar: '12%' }
  ],
  field: [
    { kunci: 'jenis', label: 'Jenis', jenis: 'pilih', wajib: true },
    { kunci: 'judul_dok', label: 'Judul dokumen', jenis: 'text', wajib: true },
    { kunci: 'berlaku', label: 'Tanggal berlaku', jenis: 'tanggal', wajib: true },
    { kunci: 'pemilik', label: 'Pemilik proses', jenis: 'text', wajib: true },
    { kunci: 'ruang_lingkup', label: 'Ruang lingkup', jenis: 'textarea' },
    { kunci: 'isi', label: 'Isi kebijakan / SOP', jenis: 'textarea', wajib: true },
    { kunci: 'dasar', label: 'Dasar hukum / standar', jenis: 'textarea', bantuan: 'Contoh: UU Penyiaran 32/2002, P3SPS, UU PDP, ISO 9001:2015 §7.5.' },
    { kunci: 'peninjauan', label: 'Jadwal peninjauan', jenis: 'tanggal' }
  ]
};

/* ---------- util bersama ---------- */
const layak = (k) => Object.prototype.hasOwnProperty.call(modul, k);
const ambil = (k) => (layak(k) ? modul[k] : null);
const semua = () => Object.keys(modul).map(k => ({ modul: k, judul: modul[k].judul, prefiks: modul[k].prefiks, deskripsi: modul[k].deskripsi }));

/* jenis dokumen mengisi opsi field 'jenis' — satu sumber, tanpa duplikasi */
Object.values(modul).forEach(m => {
  const f = (m.field || []).find(x => x.kunci === 'jenis');
  if (f) f.opsi = m.jenisDokumen;
});

module.exports = { ALUR, STATUS_LABEL, modul, layak, ambil, semua };
