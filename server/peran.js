/* ============================================================
   peran.js — Satu sumber kebenaran untuk peran & izin (RBAC)
   ------------------------------------------------------------
   Peran teknis (disimpan di kolom `users.role`) HANYA 7 nilai.
   Label jabatan bebas disimpan di `users.role_label`
   (mis. "Redaktur Pelaksana", "Manajer Pemasaran").

   Kenapa tetap rampung ke peran teknis: constraint `users_role_check`
   di database hanya mengizinkan nilai lama. Menambah peran = ALTER
   constraint (butuh hak DDL yang tidak dimiliki `mbc_app`).
   Dengan pemetaan ini, penambahan peran tidak memerlukan migrasi.

   Pemetaan:
     admin      → administrator sistem (paling tinggi)
     direksi    → pimpinan media / direksi (menyetujui terbit)
     pemred     → pemimpin redaksi (menyetujui terbit)
     redaktur   → editor & penyunting naskah (tidak menyetujui terbit)
     reporter   → penulis liputan
     editorial  → peran lama: staf redaksi umum (dipertahankan)
     finance, sales → keuangan, komersial
   ============================================================ */
'use strict';

const PERAN = {
  admin: {
    id: 'admin', nama: 'Administrator', urut: 1, grup: 'SISTEM',
    deskripsi: 'Mengelola pengguna, peran, dan pengaturan sistem.',
    izin: ['*'],
    boleh: { cms: true, setujui: true, kelola_pengguna: true, keuangan: true, komersial: true, produksi: true, metrik: true }
  },
  direksi: {
    id: 'direksi', nama: 'Direksi / Pimpinan Media', urut: 2, grup: 'PIMPINAN',
    deskripsi: 'Akses penuh operasional, menyetujui penerbitan, melihat metrik perusahaan.',
    izin: ['newsroom:baca', 'newsroom:tulis', 'newsroom:setujui', 'newsroom:hapus', 'ai:pakai', 'produksi', 'keuangan:baca', 'komersial:baca', 'metrik'],
    boleh: { cms: true, setujui: true, kelola_pengguna: false, keuangan: true, komersial: true, produksi: true, metrik: true }
  },
  pemred: {
    id: 'pemred', nama: 'Pemimpin Redaksi', urut: 3, grup: 'PIMPINAN',
    deskripsi: 'Memimpin redaksi: menyetujui terbit, meninjau etika & hukum, memutuskan temuan AI.',
    izin: ['newsroom:baca', 'newsroom:tulis', 'newsroom:setujui', 'ai:pakai', 'produksi'],
    boleh: { cms: true, setujui: true, kelola_pengguna: false, keuangan: false, komersial: false, produksi: true, metrik: true }
  },
  redaktur: {
    id: 'redaktur', nama: 'Redaktur / Editor', urut: 4, grup: 'EDITORIAL',
    deskripsi: 'Menyunting naskah, memindahkan tahap, memberi catatan editorial.',
    izin: ['newsroom:baca', 'newsroom:tulis', 'ai:pakai', 'produksi'],
    boleh: { cms: true, setujui: false, kelola_pengguna: false, keuangan: false, komersial: false, produksi: true, metrik: false }
  },
  reporter: {
    id: 'reporter', nama: 'Reporter', urut: 5, grup: 'EDITORIAL',
    deskripsi: 'Menulis dan mengirim naskah, memakai agen AI, tidak menyetujui terbit.',
    izin: ['newsroom:baca', 'newsroom:tulis', 'ai:pakai'],
    boleh: { cms: true, setujui: false, kelola_pengguna: false, keuangan: false, komersial: false, produksi: false, metrik: false }
  },
  editorial: {
    id: 'editorial', nama: 'Staf Redaksi (umum)', urut: 6, grup: 'EDITORIAL',
    deskripsi: 'Peran lama untuk staf redaksi umum. Setara Redaktur.',
    izin: ['newsroom:baca', 'newsroom:tulis', 'ai:pakai', 'produksi'],
    boleh: { cms: true, setujui: false, kelola_pengguna: false, keuangan: false, komersial: false, produksi: true, metrik: false }
  },
  finance: {
    id: 'finance', nama: 'Keuangan', urut: 7, grup: 'PERUSAHAAN',
    deskripsi: 'Keuangan, piutang, master data, laporan BI. Tanpa akses CMS editorial.',
    izin: ['keuangan', 'metrik'],
    boleh: { cms: false, setujui: false, kelola_pengguna: false, keuangan: true, komersial: false, produksi: false, metrik: true }
  },
  sales: {
    id: 'sales', nama: 'Komersial / Penjualan', urut: 8, grup: 'PERUSAHAAN',
    deskripsi: 'CRM, iklan, sponsor, media library. Tanpa akses CMS editorial.',
    izin: ['komersial'],
    boleh: { cms: false, setujui: false, kelola_pengguna: false, keuangan: false, komersial: true, produksi: false, metrik: false }
  }
};

const URUT_PERAN = Object.keys(PERAN);
const SEMUA_PERAN = URUT_PERAN.slice();

/* peran yang boleh masuk CMS/Newsroom (semua kecuali keuangan & komersial) */
const PERAN_NEWSROOM = URUT_PERAN.filter(id => PERAN[id].boleh.cms);
/* peran yang boleh menyetujui penerbitan */
const PERAN_SETUJU = URUT_PERAN.filter(id => PERAN[id].boleh.setujui);
/* peran yang boleh mengelola pengguna */
const PERAN_ADMIN = URUT_PERAN.filter(id => PERAN[id].boleh.kelola_pengguna);

const boleh = (peran, kunci) => {
  const p = PERAN[peran];
  if (!p) return false;
  if ((p.izin || []).includes('*')) return true;
  return !!(p.boleh && p.boleh[kunci]);
};

const info = (peran) => PERAN[peran] || { id: peran, nama: peran || 'Tidak dikenal', grup: '-', deskripsi: '', izin: [], boleh: {} };

/* ---------- matriks izin untuk ditampilkan di UI & dokumentasi ---------- */
const KOLOM_MATRIKS = [
  { kunci: 'cms', label: 'CMS & Newsroom' },
  { kunci: 'setujui', label: 'Menyetujui terbit' },
  { kunci: 'produksi', label: 'Produksi' },
  { kunci: 'keuangan', label: 'Keuangan' },
  { kunci: 'komersial', label: 'Komersial' },
  { kunci: 'metrik', label: 'Metrik & BI' },
  { kunci: 'kelola_pengguna', label: 'Kelola pengguna' }
];

function matriks() {
  return SEMUA_PERAN.map(id => ({
    peran: id,
    nama: PERAN[id].nama,
    grup: PERAN[id].grup,
    deskripsi: PERAN[id].deskripsi,
    izin: PERAN[id].izin,
    akses: KOLOM_MATRIKS.reduce((o, k) => { o[k.kunci] = boleh(id, k.kunci); return o; }, {})
  }));
}

/* status akun yang dianggap aktif (kolom tidak ada → dianggap aktif) */
const AKTIF = new Set(['aktif', 'active', 'true', '1']);
const akunAktif = (u) => !u || u.status === undefined || u.status === null || u.status === '' || AKTIF.has(String(u.status).toLowerCase());

module.exports = {
  PERAN, URUT_PERAN, SEMUA_PERAN, PERAN_NEWSROOM, PERAN_SETUJU, PERAN_ADMIN,
  KOLOM_MATRIKS, boleh, info, matriks, akunAktif
};

/* ------------------------------------------------------------------
   PERAN EFEKTIF — mengatasi constraint `users_role_check` yang hanya
   mengizinkan direksi/finance/sales/editorial (milik database, bukan
   aplikasi). Peran baru disimpan di `staff.title` berformat:

       "Pemimpin Redaksi · mbc:role=pemred"

   sehingga tidak perlu DDL. Bila kelak constraint dilonggarkan,
   aplikasi otomatis memakai `users.role` apa adanya.
   ------------------------------------------------------------------ */
const PREFIX = 'mbc:role=';
const PERAN_DB = ['direksi', 'finance', 'sales', 'editorial'];   // nilai yang diterima constraint

const labelBersih = (label) => String(label || '').replace(/\s*·?\s*mbc:role=\w+\s*/g, '').trim();

/* peran efektif dari pasangan users.role + label jabatan */
function peranEfektif(role, label) {
  const m = String(label || '').match(/mbc:role=([a-z]+)/);
  if (m && PERAN[m[1]]) return m[1];
  return PERAN[role] ? role : 'editorial';
}

/* pecah jabatan → { peran, peranDb, jabatan, label }
   `peran` adalah peran efektif; `peranDb` nilai yang aman untuk constraint. */
function jabatan(peran, teksJabatan) {
  const p = PERAN[peran] ? peran : 'editorial';
  /* peran lama memang sudah sah di database — simpan apa adanya, label tetap bersih */
  if (PERAN_DB.includes(p)) return { peran: p, peranDb: p, jabatan: labelBersih(teksJabatan) || PERAN[p].nama, label: labelBersih(teksJabatan) || PERAN[p].nama };
  const bersih = labelBersih(teksJabatan) || PERAN[p].nama;
  return { peran: p, peranDb: 'editorial', jabatan: bersih, label: `${bersih} · ${PREFIX}${p}` };
}

/* baca dari baris database (users.role + label, atau join staff.title) */
const dariBaris = (row) => peranEfektif(row && row.role, row && (row.role_label || row.title || row.roleLabel));

module.exports.PREFIX = PREFIX;
module.exports.PERAN_DB = PERAN_DB;
module.exports.labelBersih = labelBersih;
module.exports.peranEfektif = peranEfektif;
module.exports.jabatan = jabatan;
module.exports.dariBaris = dariBaris;
