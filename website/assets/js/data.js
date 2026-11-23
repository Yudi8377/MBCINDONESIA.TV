/* MBCINDONESIA.TV — Data konten + hidrasi dari API (fallback: data statis)
   Server adalah sumber kebenaran saat online; offline → data bawaan ini. */
const MBCDATA = {
  videos: {
    "ep-101-pelajaran-dari-pemilik-kedai-kopi-viral": "assets/video/ep-101-pelajaran-dari-pemilik-kedai-kopi-viral.mp4",
    "ep-100-100-episode-refleksi-bersama": "assets/video/ep-100-100-episode-refleksi-bersama.mp4",
    "ep-99-atlet-panjat-tebing-mental-juara": "assets/video/ep-99-atlet-panjat-tebing-mental-juara.mp4",
    "ep-9-rawon-kediri-kuah-hitam-yang-juara": "assets/video/ep-9-rawon-kediri-kuah-hitam-yang-juara.mp4",
    "ep-8-rendang-12-jam-kesabaran": "assets/video/ep-8-rendang-12-jam-kesabaran.mp4",
    "ep-7-soto-lamongan-koya-legendaris": "assets/video/ep-7-soto-lamongan-koya-legendaris.mp4",
    "ep-8-bromo-negeri-di-atas-awan": "assets/video/ep-8-bromo-negeri-di-atas-awan.mp4",
    "ep-7-borobudur-candi-terbesar-di-dunia": "assets/video/ep-7-borobudur-candi-terbesar-di-dunia.mp4",
    "ep-6-raja-ampat-dari-ketinggian": "assets/video/ep-6-raja-ampat-dari-ketinggian.mp4",
    "spesial-warisan-maritim-nusantara": "assets/video/spesial-warisan-maritim-nusantara.mp4",
    "kabar-nusantara-pagi-edisi-21-nov-2026": "assets/video/kabar-nusantara-pagi-edisi-21-nov-2026.mp4",
    "kabar-nusantara-petang-edisi-20-nov-2026": "assets/video/kabar-nusantara-petang-edisi-20-nov-2026.mp4",
    "sorotan-minggu-ini-ekonomi-daerah": "assets/video/sorotan-minggu-ini-ekonomi-daerah.mp4",
    "laporan-khusus-infrastruktur-jawa-timur": "assets/video/laporan-khusus-infrastruktur-jawa-timur.mp4",
    "ep-15-pasar-pahing-jantung-kota-kediri": "assets/video/ep-15-pasar-pahing-jantung-kota-kediri.mp4",
    "ep-14-nelayan-muara-angke-bertahan": "assets/video/ep-14-nelayan-muara-angke-bertahan.mp4",
    "ep-13-komunitas-sepeda-tua-bandung": "assets/video/ep-13-komunitas-sepeda-tua-bandung.mp4",
    "ep-18-panggung-akustik-lintang-samudra": "assets/video/ep-18-panggung-akustik-lintang-samudra.mp4",
    "ep-17-indie-kediri-night": "assets/video/ep-17-indie-kediri-night.mp4",
    "ep-16-kolaborasi-gamelan-x-elektronik": "assets/video/ep-16-kolaborasi-gamelan-x-elektronik.mp4",
    "ep-24-umkm-kediri-go-global": "assets/video/ep-24-umkm-kediri-go-global.mp4",
    "ep-23-arah-suku-bunga-investasi-2027": "assets/video/ep-23-arah-suku-bunga-investasi-2027.mp4",
    "ep-22-rantai-pasok-ekspor-jawa-timur": "assets/video/ep-22-rantai-pasok-ekspor-jawa-timur.mp4",
    "ep-12-gamelan-gerak-yogyakarta": "assets/video/ep-12-gamelan-gerak-yogyakarta.mp4",
    "ep-11-wayang-kulit-dalang-muda-surakarta": "assets/video/ep-11-wayang-kulit-dalang-muda-surakarta.mp4",
    "ep-10-tari-saman-di-tanah-gayo": "assets/video/ep-10-tari-saman-di-tanah-gayo.mp4",
    live: "assets/video/live-24jam.mp4"
  },
  programs: [
    { id:"kabar-nusantara", title:"Kabar Nusantara", cat:"Berita", img:"assets/img/kabar-nusantara.jpg",
      desc:"Siaran berita nasional dan daerah: politik, ekonomi, hukum, dan peristiwa penting sepanjang hari dengan laporan langsung dari jaringan koresponden MBC Indonesia.",
      rating:4.8, views:"1,2 jt", hl:"Tayang setiap hari · 06.00 & 19.00 WIB",
      eps:[["Kabar Nusantara Pagi — Edisi 21 Nov 2026","32:14","kabar-nusantara-pagi-edisi-21-nov-2026"],["Kabar Nusantara Petang — Edisi 20 Nov 2026","28:47","kabar-nusantara-petang-edisi-20-nov-2026"],["Sorotan Minggu Ini: Ekonomi Daerah","41:05","sorotan-minggu-ini-ekonomi-daerah"],["Laporan Khusus: Infrastruktur Jawa Timur","36:30","laporan-khusus-infrastruktur-jawa-timur"]]},
    { id:"jejak-nusantara", title:"Jejak Nusantara", cat:"Dokumenter", img:"assets/img/jejak-nusantara.jpg",
      desc:"Dokumenter perjalanan menyusuri bentang alam dan sejarah Indonesia — dari kawah Bromo hingga candi-candi di Jawa — bersama para peneliti dan pemandu lokal.",
      rating:4.9, views:"860 rb", hl:"Musim 2 · Tayang Rabu 20.00 WIB",
      eps:[["Ep 8 — Bromo: Negeri di Atas Awan","48:12","ep-8-bromo-negeri-di-atas-awan"],["Ep 7 — Borobudur: Candi Terbesar di Dunia","44:03","ep-7-borobudur-candi-terbesar-di-dunia"],["Ep 6 — Raja Ampat dari Ketinggian","46:39","ep-6-raja-ampat-dari-ketinggian"],["Spesial — Warisan Maritim Nusantara","58:20","spesial-warisan-maritim-nusantara"]]},
    { id:"selasar-budaya", title:"Selasar Budaya", cat:"Budaya", img:"assets/img/selasar-budaya.jpg",
      desc:"Panggung apresiasi seni dan budaya Nusantara: tari tradisional, gamelan, sastra, dan maestro di baliknya. Direkam langsung dari pendopo dan sanggar di seluruh Indonesia.",
      rating:4.7, views:"420 rb", hl:"Tayang Jumat 21.00 WIB",
      eps:[["Ep 12 — Gamelan & Gerak: Yogyakarta","52:10","ep-12-gamelan-gerak-yogyakarta"],["Ep 11 — Wayang Kulit: Dalang Muda Surakarta","49:44","ep-11-wayang-kulit-dalang-muda-surakarta"],["Ep 10 — Tari Saman di Tanah Gayo","45:58","ep-10-tari-saman-di-tanah-gayo"]]},
    { id:"ruang-bisnis", title:"Ruang Bisnis", cat:"Bisnis", img:"assets/img/ruang-bisnis.jpg",
      desc:"Dialog tajam bersama pelaku usaha, ekonom, dan regulator: strategi UMKM naik kelas, pasar modal, dan arah ekonomi Indonesia bersama pemimpin industri.",
      rating:4.6, views:"510 rb", hl:"Tayang Kamis 19.30 WIB",
      eps:[["Ep 24 — UMKM Kediri Go Global","38:26","ep-24-umkm-kediri-go-global"],["Ep 23 — Arah Suku Bunga & Investasi 2027","42:17","ep-23-arah-suku-bunga-investasi-2027"],["Ep 22 — Rantai Pasok Ekspor Jawa Timur","40:02","ep-22-rantai-pasok-ekspor-jawa-timur"]]},
    { id:"bicara-petang", title:"Bicara Petang", cat:"Podcast", img:"assets/img/bicara-petang.jpg",
      desc:"Obrolan santai tapi mendalam setiap petang: tokoh inspiratif, kreator, atlet, dan pemikir muda Indonesia. Dengarkan juga di Spotify dan YouTube Music.",
      rating:4.8, views:"690 rb", hl:"Tayang Senin–Jumat 17.00 WIB",
      eps:[["Ep 101 — Pelajaran dari Pemilik Kedai Kopi Viral","55:31","ep-101-pelajaran-dari-pemilik-kedai-kopi-viral"],["Ep 100 — 100 Episode: Refleksi Bersama","1:02:18","ep-100-100-episode-refleksi-bersama"],["Ep 99 — Atlet Panjat Tebing & Mental Juara","58:47","ep-99-atlet-panjat-tebing-mental-juara"]]},
    { id:"kamera-komunitas", title:"Kamera Komunitas", cat:"Komunitas", img:"assets/img/kamera-komunitas.jpg",
      desc:"Jurnalisme warga: kru MBC Indonesia turun ke kampung, pasar, dan gang-gang kota untuk merekam cerita rakyat biasa yang luar biasa.",
      rating:4.5, views:"300 rb", hl:"Tayang Sabtu 16.00 WIB",
      eps:[["Ep 15 — Pasar Pahing: Jantung Kota Kediri","34:20","ep-15-pasar-pahing-jantung-kota-kediri"],["Ep 14 — Nelayan Muara Angke Bertahan","36:08","ep-14-nelayan-muara-angke-bertahan"],["Ep 13 — Komunitas Sepeda Tua Bandung","31:52","ep-13-komunitas-sepeda-tua-bandung"]]},
    { id:"dapur-rempah", title:"Dapur Rempah", cat:"Kuliner", img:"assets/img/dapur-rempah.jpg",
      desc:"Menjelajah dapur Nusantara: dari rendang Payakumbuh sampai rawon Kediri. Resep autentik, teknik, dan cerita di balik setiap bumbu.",
      rating:4.9, views:"780 rb", hl:"Tayang Minggu 10.00 WIB",
      eps:[["Ep 9 — Rawon Kediri: Kuah Hitam yang Juara","33:41","ep-9-rawon-kediri-kuah-hitam-yang-juara"],["Ep 8 — Rendang: 12 Jam Kesabaran","47:19","ep-8-rendang-12-jam-kesabaran"],["Ep 7 — Soto Lamongan & Koya Legendaris","39:27","ep-7-soto-lamongan-koya-legendaris"]]},
    { id:"panggung-musik", title:"Panggung Musik", cat:"Musik", img:"assets/img/panggung-musik.jpg",
      desc:"Konser intim dan sesi akustik musisi Indonesia — dari panggung indie sampai legenda — direkam live di Studio MBC Indonesia.",
      rating:4.7, views:"640 rb", hl:"Tayang Minggu 20.00 WIB",
      eps:[["Ep 18 — Panggung Akustik: Lintang & Samudra","59:33","ep-18-panggung-akustik-lintang-samudra"],["Ep 17 — Indie Kediri Night","1:04:11","ep-17-indie-kediri-night"],["Ep 16 — Kolaborasi: Gamelan x Elektronik","51:07","ep-16-kolaborasi-gamelan-x-elektronik"]]}
  ],
  apiOnline: false,
  getProgram(id){ return this.programs.find(p => p.id === id) || this.programs[0]; }
};
window.MBCDATA = MBCDATA; // akses dari skrip lain & debugging

/* Hidrasi dari API saat online (server = sumber kebenaran). */
(async function hydrateFromApi(){
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('/api/programs', { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (Array.isArray(data.programs) && data.programs.length) {
      MBCDATA.apiOnline = true;
      MBCDATA.programs = data.programs.map(p => ({ ...p, rating: Number(p.rating) }));
      window.dispatchEvent(new Event('mbc:data-updated'));
    }
  } catch (e) { /* offline/preview statis: pakai data bawaan */ }
})();
