/* Seed data contoh MBCINDONESIA.TV (idempotent: hapus & isi ulang tabel demo) */
'use strict';
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ---- Users (kata sandi demo: demo123 — WAJIB diubah di produksi) ----
    const passHash = await bcrypt.hash('demo123', 10);
    const users = [
      ['direktur@mbcindonesia.tv', 'Andika Pratama', 'direksi', 'Direktur Utama'],
      ['finance@mbcindonesia.tv',  'Dewi Anggraini', 'finance', 'Manager Keuangan'],
      ['sales@mbcindonesia.tv',    'Rangga Saputra', 'sales',   'Account Executive'],
      ['redaksi@mbcindonesia.tv',  'Sinta Maharani', 'editorial','Produser Redaksi']
    ];
    for (const [email, name, role, roleLabel] of users) {
      await client.query(
        `INSERT INTO users(email,name,role,role_label,pass_hash) VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, role_label=EXCLUDED.role_label, pass_hash=EXCLUDED.pass_hash`,
        [email, name, role, roleLabel, passHash]);
    }

    // ---- Programs + episodes ----
    const programs = [
      ['kabar-nusantara','Kabar Nusantara','Berita','assets/img/kabar-nusantara.jpg','Siaran berita nasional dan daerah: politik, ekonomi, hukum, dan peristiwa penting sepanjang hari dengan laporan langsung dari jaringan koresponden MBC Indonesia.',4.8,'1,2 jt','Tayang setiap hari · 06.00 & 19.00 WIB',
        [['Kabar Nusantara Pagi — Edisi 21 Nov 2026','32:14','blazes'],['Kabar Nusantara Petang — Edisi 20 Nov 2026','28:47','escapes'],['Sorotan Minggu Ini: Ekonomi Daerah','41:05','fun'],['Laporan Khusus: Infrastruktur Jawa Timur','36:30','joyrides']]],
      ['jejak-nusantara','Jejak Nusantara','Dokumenter','assets/img/jejak-nusantara.jpg','Dokumenter perjalanan menyusuri bentang alam dan sejarah Indonesia — dari kawah Bromo hingga candi-candi di Jawa — bersama para peneliti dan pemandu lokal.',4.9,'860 rb','Musim 2 · Tayang Rabu 20.00 WIB',
        [['Ep 8 — Bromo: Negeri di Atas Awan','48:12','sintel'],['Ep 7 — Borobudur: Candi Terbesar di Dunia','44:03','bunny'],['Ep 6 — Raja Ampat dari Ketinggian','46:39','elephants'],['Spesial — Warisan Maritim Nusantara','58:20','tos']]],
      ['selasar-budaya','Selasar Budaya','Budaya','assets/img/selasar-budaya.jpg','Panggung apresiasi seni dan budaya Nusantara: tari tradisional, gamelan, sastra, dan maestro di baliknya. Direkam langsung dari pendopo dan sanggar di seluruh Indonesia.',4.7,'420 rb','Tayang Jumat 21.00 WIB',
        [['Ep 12 — Gamelan & Gerak: Yogyakarta','52:10','bunny'],['Ep 11 — Wayang Kulit: Dalang Muda Surakarta','49:44','elephants'],['Ep 10 — Tari Saman di Tanah Gayo','45:58','sintel']]],
      ['ruang-bisnis','Ruang Bisnis','Bisnis','assets/img/ruang-bisnis.jpg','Dialog tajam bersama pelaku usaha, ekonom, dan regulator: strategi UMKM naik kelas, pasar modal, dan arah ekonomi Indonesia bersama pemimpin industri.',4.6,'510 rb','Tayang Kamis 19.30 WIB',
        [['Ep 24 — UMKM Kediri Go Global','38:26','subaru'],['Ep 23 — Arah Suku Bunga & Investasi 2027','42:17','fun'],['Ep 22 — Rantai Pasok Ekspor Jawa Timur','40:02','escapes']]],
      ['bicara-petang','Bicara Petang','Podcast','assets/img/bicara-petang.jpg','Obrolan santai tapi mendalam setiap petang: tokoh inspiratif, kreator, atlet, dan pemikir muda Indonesia. Dengarkan juga di Spotify dan YouTube Music.',4.8,'690 rb','Tayang Senin–Jumat 17.00 WIB',
        [['Ep 101 — Pelajaran dari Pemilik Kedai Kopi Viral','55:31','fun'],['Ep 100 — 100 Episode: Refleksi Bersama','1:02:18','meltdowns'],['Ep 99 — Atlet Panjat Tebing & Mental Juara','58:47','flicks']]],
      ['kamera-komunitas','Kamera Komunitas','Komunitas','assets/img/kamera-komunitas.jpg','Jurnalisme warga: kru MBC Indonesia turun ke kampung, pasar, dan gang-gang kota untuk merekam cerita rakyat biasa yang luar biasa.',4.5,'300 rb','Tayang Sabtu 16.00 WIB',
        [['Ep 15 — Pasar Pahing: Jantung Kota Kediri','34:20','joyrides'],['Ep 14 — Nelayan Muara Angke Bertahan','36:08','blazes'],['Ep 13 — Komunitas Sepeda Tua Bandung','31:52','escapes']]],
      ['dapur-rempah','Dapur Rempah','Kuliner','assets/img/dapur-rempah.jpg','Menjelajah dapur Nusantara: dari rendang Payakumbuh sampai rawon Kediri. Resep autentik, teknik, dan cerita di balik setiap bumbu.',4.9,'780 rb','Tayang Minggu 10.00 WIB',
        [['Ep 9 — Rawon Kediri: Kuah Hitam yang Juara','33:41','meltdowns'],['Ep 8 — Rendang: 12 Jam Kesabaran','47:19','blazes'],['Ep 7 — Soto Lamongan & Koya Legendaris','39:27','fun']]],
      ['panggung-musik','Panggung Musik','Musik','assets/img/panggung-musik.jpg','Konser intim dan sesi akustik musisi Indonesia — dari panggung indie sampai legenda — direkam live di Studio MBC Indonesia.',4.7,'640 rb','Tayang Minggu 20.00 WIB',
        [['Ep 18 — Panggung Akustik: Lintang & Samudra','59:33','flicks'],['Ep 17 — Indie Kediri Night','1:04:11','joyrides'],['Ep 16 — Kolaborasi: Gamelan x Elektronik','51:07','meltdowns']]]
    ];
    for (const [id,title,cat,img,descr,rating,views,hl,eps] of programs) {
      await client.query(
        `INSERT INTO programs(id,title,cat,img,descr,rating,views,hl) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, cat=EXCLUDED.cat, img=EXCLUDED.img, descr=EXCLUDED.descr, rating=EXCLUDED.rating, views=EXCLUDED.views, hl=EXCLUDED.hl`,
        [id,title,cat,img,descr,rating,views,hl]);
      await client.query('DELETE FROM episodes WHERE program_id=$1', [id]);
      for (let i=0;i<eps.length;i++) {
        const [t,d,v] = eps[i];
        await client.query('INSERT INTO episodes(program_id,ep_index,title,dur,video_key) VALUES($1,$2,$3,$4,$5)', [id,i,t,d,v]);
      }
    }

    // ---- CRM deals ----
    await client.query('DELETE FROM crm_deals');
    const deals = [
      ['prospek','PT Sumber Rejeki Abadi','Video company profile 60 detik',45],
      ['prospek','Klinik Sehat Keluarga','Paket konten korporat bulanan',18],
      ['prospek','Pemkot Kediri','Dokumentasi HUT Kota 2027',120],
      ['penawaran','CV Karya Mandiri','3 episode podcast sponsor',27],
      ['penawaran','Koperasi Tani Makmur','Iklan digital + 15" TV',15],
      ['negosiasi','PT Bank Jatim Tbk','Sponsorship Ruang Bisnis Q1 2027',150],
      ['kontrak','PT Indofood CBP','Branded content Dapur Rempah (4 eps)',85],
      ['kontrak','Telkomsel','Paket iklan cross-channel Des',200],
      ['selesai','Pemkot Kediri','Liputan HUT RI ke-81',60]
    ];
    for (const [stage,company,deal,value] of deals) {
      await client.query('INSERT INTO crm_deals(stage,company,deal,value_jt) VALUES($1,$2,$3,$4)', [stage,company,deal,value]);
    }

    // ---- Production projects ----
    await client.query('DELETE FROM production_projects');
    const projects = [
      ['Video Company Profile PT SRA','PT Sumber Rejeki Abadi',2,62,'05 Des 2026',45],
      ['Dokumenter “Kopi Kediri” Ep 3','Produksi Internal MBC',3,71,'28 Nov 2026',120],
      ['Iklan Telkomsel — 3 spot 15"','Telkomsel',4,88,'25 Nov 2026',200],
      ['Podcast Bicara Petang Ep 102–105','Internal — Divisi Podcast',1,30,'01 Des 2026',12],
      ['Branded Content Dapur Rempah','PT Indofood CBP',3,64,'10 Des 2026',85],
      ['Liputan HUT Kota Kediri 2027','Pemkot Kediri',0,8,'20 Jan 2027',120]
    ];
    for (const [name,clientName,stage,progress,due,budget] of projects) {
      await client.query('INSERT INTO production_projects(name,client,stage,progress,due,budget_jt) VALUES($1,$2,$3,$4,$5,$6)', [name,clientName,stage,progress,due,budget]);
    }

    // ---- Ad slots & campaigns ----
    await client.query('DELETE FROM ad_slots');
    const slots = [
      ['Kabar Nusantara Pagi · 06.30 (15")','Rp 8 jt / tayang','Tersedia'],
      ['Ruang Bisnis · 19.30 (30")','Rp 18 jt / tayang','Terjual'],
      ['Dapur Rempah · Minggu 10.15 (15")','Rp 12 jt / tayang','Tersedia'],
      ['Panggung Musik · Minggu 20.45 (30")','Rp 15 jt / tayang','Terjual'],
      ['Sponsor Bicara Petang (per bulan)','Rp 25 jt / bln','Tersedia']
    ];
    for (const [slot,price,status] of slots) await client.query('INSERT INTO ad_slots(slot,price,status) VALUES($1,$2,$3)', [slot,price,status]);

    await client.query('DELETE FROM campaigns');
    const campaigns = [
      ['Telkomsel','Cross-channel — Desember',24,18],
      ['Indofood CBP','Dapur Rempah — 4 episode',8,5],
      ['Bank Jatim','Ruang Bisnis Q4 — selesai',12,12]
    ];
    for (const [company,pkg,total,done] of campaigns) await client.query('INSERT INTO campaigns(company,package,total,done) VALUES($1,$2,$3,$4)', [company,pkg,total,done]);

    // ---- Invoices & approvals ----
    await client.query('DELETE FROM invoices');
    const invoices = [
      ['INV/2026/0112','PT Indofood CBP',85,'15 Okt 2026','60+ hari'],
      ['INV/2026/0128','Telkomsel',200,'10 Nov 2026','1–30 hari'],
      ['INV/2026/0131','CV Karya Mandiri',27,'18 Nov 2026','1–30 hari'],
      ['INV/2026/0136','Pemkot Kediri',60,'30 Nov 2026','Lancar']
    ];
    for (const [inv,company,amt,due,aging] of invoices) await client.query('INSERT INTO invoices(inv,company,amount_jt,due,aging) VALUES($1,$2,$3,$4,$5)', [inv,company,amt,due,aging]);

    await client.query('DELETE FROM approvals');
    const approvals = [
      ['PBJ-2026-031','Sewa kamera Sony FX6 + lensa — 3 hari shoot',18.5],
      ['PBJ-2026-034','Honor koresponden Jawa Timur — November 2026',22.3],
      ['PBJ-2026-037','Lisensi musik Dapur Rempah Ep 9',7.5]
    ];
    for (const [ref,description,amt] of approvals) await client.query('INSERT INTO approvals(ref,description,amount_jt,status) VALUES($1,$2,$3,$4)', [ref,description,amt,'pending']);

    // ---- Master data ----
    await client.query('DELETE FROM master_items');
    const master = [
      ['klien','PT Indofood CBP Sukses Makmur','Klien Produksi','Jakarta'],
      ['klien','Telkomsel','Pengiklan','Jakarta'],
      ['klien','Pemkot Kediri','Institusi','Kediri'],
      ['klien','PT Bank Jatim Tbk','Sponsor','Surabaya'],
      ['klien','CV Karya Mandiri','Klien UMKM','Kediri'],
      ['klien','Koperasi Tani Makmur','Klien UMKM','Nganjuk'],
      ['vendor','PT Sewa Alat Studio Nusantara','Sewa alat produksi',''],
      ['vendor','CV Cahaya Lensa','Fotografi & drone',''],
      ['vendor','PT Multi Media Transcoding','Transcoding & storage',''],
      ['vendor','Studio Grafis Laras','Motion graphic & grafis',''],
      ['vendor','PT Asuransi Jasindo','Asuransi alat & kru',''],
      ['produk','Jasa Video Profile (60 dtk)','Rp 35–60 jt','45%'],
      ['produk','Produksi Podcast (per episode)','Rp 9–15 jt','50%'],
      ['produk','Slot Iklan 15" (per tayang)','Rp 8 jt','70%'],
      ['produk','Sponsorship Program (per bulan)','Rp 25–80 jt','55%'],
      ['produk','Dokumenter Khusus (per episode)','Rp 80–150 jt','40%'],
      ['produk','Retainer Kelola Kanal (per bulan)','Rp 20–45 jt','50%']
    ];
    for (const [kind,c1,c2,c3] of master) await client.query('INSERT INTO master_items(kind,c1,c2,c3) VALUES($1,$2,$3,$4)', [kind,c1,c2,c3]);

    // ---- Audit seed ----
    await client.query('DELETE FROM audit_log');
    const auditSeed = [
      ['Approval INV/2026/0112 dialihkan ke Direksi','System'],
      ['Login — Manager Keuangan','Dewi Anggraini'],
      ['Upload bukti tayang: Bank Jatim — Ruang Bisnis','Rangga Saputra'],
      ['Seed database demo awal (migrasi blueprint fase 2–3)','System']
    ];
    for (const [action,who] of auditSeed) await client.query('INSERT INTO audit_log(action,who) VALUES($1,$2)', [action,who]);

    // ---- Comments demo ----
    await client.query('DELETE FROM comments');
    const commentSeed = [
      ['jejak-nusantara','Dewi Lestari','Dokumenter Bromo-nya luar biasa! Ditunggu episode berikutnya.'],
      ['jejak-nusantara','Rangga P.','Kualitas gambar dan audionya sudah setara TV nasional. Bangga!'],
      ['bicara-petang','Sinta_RD','Episode Kopi Viral menginspirasi sekali.'],
      ['kabar-nusantara','BimoKediri','Kabar daerah makin lengkap. Sukses selalu MBC!']
    ];
    for (const [pid,author,body] of commentSeed) await client.query('INSERT INTO comments(program_id,author,body) VALUES($1,$2,$3)', [pid,author,body]);

    await client.query('COMMIT');
    console.log('✅ Seed selesai.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed gagal:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
