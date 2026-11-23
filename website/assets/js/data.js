/* MBCINDONESIA.TV — Data konten + hidrasi dari API (fallback: data statis)
   Server adalah sumber kebenaran saat online; offline → data bawaan ini. */
const MBCDATA = {
  videos: {
    bunny: "assets/video/bunny.mp4",
    elephants: "assets/video/elephants.mp4",
    sintel: "assets/video/sintel.mp4",
    tos: "assets/video/tos.mp4",
    blazes: "assets/video/blazes.mp4",
    escapes: "assets/video/escapes.mp4",
    joyrides: "assets/video/joyrides.mp4",
    meltdowns: "assets/video/meltdowns.mp4",
    fun: "assets/video/fun.mp4",
    flicks: "assets/video/flicks.mp4",
    subaru: "assets/video/subaru.mp4",
    live: "assets/video/live-24jam.mp4"
  },
  programs: [
    { id:"kabar-nusantara", title:"Kabar Nusantara", cat:"Berita", img:"assets/img/kabar-nusantara.jpg",
      desc:"Siaran berita nasional dan daerah: politik, ekonomi, hukum, dan peristiwa penting sepanjang hari dengan laporan langsung dari jaringan koresponden MBC Indonesia.",
      rating:4.8, views:"1,2 jt", hl:"Tayang setiap hari · 06.00 & 19.00 WIB",
      eps:[["Kabar Nusantara Pagi — Edisi 21 Nov 2026","32:14","blazes"],["Kabar Nusantara Petang — Edisi 20 Nov 2026","28:47","escapes"],["Sorotan Minggu Ini: Ekonomi Daerah","41:05","fun"],["Laporan Khusus: Infrastruktur Jawa Timur","36:30","joyrides"]]},
    { id:"jejak-nusantara", title:"Jejak Nusantara", cat:"Dokumenter", img:"assets/img/jejak-nusantara.jpg",
      desc:"Dokumenter perjalanan menyusuri bentang alam dan sejarah Indonesia — dari kawah Bromo hingga candi-candi di Jawa — bersama para peneliti dan pemandu lokal.",
      rating:4.9, views:"860 rb", hl:"Musim 2 · Tayang Rabu 20.00 WIB",
      eps:[["Ep 8 — Bromo: Negeri di Atas Awan","48:12","sintel"],["Ep 7 — Borobudur: Candi Terbesar di Dunia","44:03","bunny"],["Ep 6 — Raja Ampat dari Ketinggian","46:39","elephants"],["Spesial — Warisan Maritim Nusantara","58:20","tos"]]},
    { id:"selasar-budaya", title:"Selasar Budaya", cat:"Budaya", img:"assets/img/selasar-budaya.jpg",
      desc:"Panggung apresiasi seni dan budaya Nusantara: tari tradisional, gamelan, sastra, dan maestro di baliknya. Direkam langsung dari pendopo dan sanggar di seluruh Indonesia.",
      rating:4.7, views:"420 rb", hl:"Tayang Jumat 21.00 WIB",
      eps:[["Ep 12 — Gamelan & Gerak: Yogyakarta","52:10","bunny"],["Ep 11 — Wayang Kulit: Dalang Muda Surakarta","49:44","elephants"],["Ep 10 — Tari Saman di Tanah Gayo","45:58","sintel"]]},
    { id:"ruang-bisnis", title:"Ruang Bisnis", cat:"Bisnis", img:"assets/img/ruang-bisnis.jpg",
      desc:"Dialog tajam bersama pelaku usaha, ekonom, dan regulator: strategi UMKM naik kelas, pasar modal, dan arah ekonomi Indonesia bersama pemimpin industri.",
      rating:4.6, views:"510 rb", hl:"Tayang Kamis 19.30 WIB",
      eps:[["Ep 24 — UMKM Kediri Go Global","38:26","subaru"],["Ep 23 — Arah Suku Bunga & Investasi 2027","42:17","fun"],["Ep 22 — Rantai Pasok Ekspor Jawa Timur","40:02","escapes"]]},
    { id:"bicara-petang", title:"Bicara Petang", cat:"Podcast", img:"assets/img/bicara-petang.jpg",
      desc:"Obrolan santai tapi mendalam setiap petang: tokoh inspiratif, kreator, atlet, dan pemikir muda Indonesia. Dengarkan juga di Spotify dan YouTube Music.",
      rating:4.8, views:"690 rb", hl:"Tayang Senin–Jumat 17.00 WIB",
      eps:[["Ep 101 — Pelajaran dari Pemilik Kedai Kopi Viral","55:31","fun"],["Ep 100 — 100 Episode: Refleksi Bersama","1:02:18","meltdowns"],["Ep 99 — Atlet Panjat Tebing & Mental Juara","58:47","flicks"]]},
    { id:"kamera-komunitas", title:"Kamera Komunitas", cat:"Komunitas", img:"assets/img/kamera-komunitas.jpg",
      desc:"Jurnalisme warga: kru MBC Indonesia turun ke kampung, pasar, dan gang-gang kota untuk merekam cerita rakyat biasa yang luar biasa.",
      rating:4.5, views:"300 rb", hl:"Tayang Sabtu 16.00 WIB",
      eps:[["Ep 15 — Pasar Pahing: Jantung Kota Kediri","34:20","joyrides"],["Ep 14 — Nelayan Muara Angke Bertahan","36:08","blazes"],["Ep 13 — Komunitas Sepeda Tua Bandung","31:52","escapes"]]},
    { id:"dapur-rempah", title:"Dapur Rempah", cat:"Kuliner", img:"assets/img/dapur-rempah.jpg",
      desc:"Menjelajah dapur Nusantara: dari rendang Payakumbuh sampai rawon Kediri. Resep autentik, teknik, dan cerita di balik setiap bumbu.",
      rating:4.9, views:"780 rb", hl:"Tayang Minggu 10.00 WIB",
      eps:[["Ep 9 — Rawon Kediri: Kuah Hitam yang Juara","33:41","meltdowns"],["Ep 8 — Rendang: 12 Jam Kesabaran","47:19","blazes"],["Ep 7 — Soto Lamongan & Koya Legendaris","39:27","fun"]]},
    { id:"panggung-musik", title:"Panggung Musik", cat:"Musik", img:"assets/img/panggung-musik.jpg",
      desc:"Konser intim dan sesi akustik musisi Indonesia — dari panggung indie sampai legenda — direkam live di Studio MBC Indonesia.",
      rating:4.7, views:"640 rb", hl:"Tayang Minggu 20.00 WIB",
      eps:[["Ep 18 — Panggung Akustik: Lintang & Samudra","59:33","flicks"],["Ep 17 — Indie Kediri Night","1:04:11","joyrides"],["Ep 16 — Kolaborasi: Gamelan x Elektronik","51:07","meltdowns"]]}
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
