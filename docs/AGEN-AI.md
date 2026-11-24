# Multi-Agen AI Editorial — Panduan Teknis & Redaksi

Rilis 1.6.0 · 6 agen spesialis untuk membantu tugas redaksi MBC Indonesia.

## 1. Apa yang dilakukan agen (dan apa yang TIDAK)

| Agen | Tugas | Keluaran utama |
|---|---|---|
| 🔎 **Pencari Berita** (`riset`) | Memetakan isu, sudut yang belum digarap, kata kunci pemantauan, pertanyaan riset | `sudut_belum_digarap`, `kata_kunci`, `pertanyaan_riset`, `pemantau` |
| 🛡️ **Verifikator & Klarifikasi** (`klarifikasi`) | Memilah klaim berangka/atributif/kabur, menilai sumber, menyusun langkah klarifikasi & hak jawab | `klaim[]`, `langkah_klarifikasi[]`, `skor_kesiapan`, `status` |
| ✍️ **Penyunting Naskah** (`penyunting`) | Menilai struktur (lead, kutipan, tindak lanjut), panjang kalimat/paragraf, memberi suntingan konkret | `suntingan[]`, `lead_usulan`, `judul_usulan[]` |
| ⌕ **SEO & Judul** (`seo`) | Judul & meta description, kepadatan kata kunci, judul push, hashtag | `judul_seo`, `meta_description`, `kepadatan_persen` |
| ⚖️ **Hukum & Etika** (`etika`) | Clickbait, praduga tak bersalah, data pribadi (UU PDP 27/2022), hak jawab | `skor_kepatuhan`, `rekomendasi[]`, temuan kritis/peringatan |
| 📊 **Analis Data** (`data`) | Angka penting, klaim tanpa periode/pembanding, sumber data resmi | `angka_penting[]`, `sumber_pembanding[]`, `pembanding_disarankan[]` |

**Agen tidak pernah** menerbitkan artikel, mengubah naskah, atau menyimpan perubahan tanpa perintah.
Semua hasil hanya bahan keputusan manusia. Setiap jalan tercatat di `audit_log`.

## 2. Dua mode (hibrida)

```
            ┌──────────────────────────┐
naskah  ──▶ │  MESIN LOKAL (selalu)    │──▶ keluaran lengkap, deterministik
            └───────────┬──────────────┘
                        │ bila LLM_API_KEY diisi
                        ▼
            ┌──────────────────────────┐
            │  LLM (opsional)          │──▶ pengayaan (ringkasan, sudut, klarifikasi)
            └───────────┬──────────────┘
                        │ gagal/timeout/kuota habis
                        ▼
                    jatuh otomatis ke mesin lokal (tidak pernah error ke pengguna)
```

Setiap hasil menyebut sumbernya: `lokal`, `hibrida`, atau `lokal` + `catatan_llm`
(`http_500`, `timeout`, `kuota_harian_habis`, …).

### Mengaktifkan LLM (opsional, tanpa ubah kode)

Set variabel lingkungan di Vercel (Project → Settings → Environment Variables):

| Variabel | Wajib | Contoh |
|---|---|---|
| `LLM_PROVIDER` | ya (untuk LLM) | `openai`, `groq`, `openrouter`, `together`, `deepseek`, `ollama` |
| `LLM_API_KEY` | ya, kecuali `ollama` | `sk-…` |
| `LLM_MODEL` | tidak | `gpt-4o-mini`, `llama-3.1-8b-instant` |
| `LLM_BASE_URL` | tidak | untuk server sendiri / `http://127.0.0.1:11434/v1` |
| `LLM_TIMEOUT_MS` | tidak | `20000` (default) |
| `LLM_BATAS_HARIAN` | tidak | `200` panggilan/hari (pengaman biaya) |

Semua provider memakai protokol `chat/completions` gaya OpenAI, jadi menukar provider cukup
mengganti dua variabel. Bila kunci tidak ada, aplikasi **tetap berfungsi penuh** dengan mesin lokal.

> Catatan privasi: dengan LLM aktif, potongan naskah (maks. 700 kata) dikirim ke provider.
> Bila kebijakan redaksi melarang, biarkan mode lokal — hasil tetap lengkap, hanya tanpa pengayaan model.

## 3. Endpoint API

Semua endpoint memerlukan **token staf** (`Authorization: Bearer <jwt>`) dan hanya untuk peran
`editorial` / `direksi`. Peran lain → **403**; tanpa token → **401**.

| Metode | Jalur | Isi | Keterangan |
|---|---|---|---|
| GET | `/api/newsroom/agen/daftar` | – | 6 agen + status LLM (tanpa membocorkan kunci) |
| POST | `/api/newsroom/agen/jalankan` | `{artikel_id}` atau `{teks, judul, dek}`; opsional `{agen:[...], pakai_llm:false}` | Menjalankan agen terpilih |
| POST | `/api/newsroom/agen/cari` | `{q}` | Cari artikel arsip untuk bahan agen |
| POST | `/api/newsroom/agen/simpan` | `{artikel_id, temuan:[{agent,tingkat,judul,rincian,bukti}]}` | Simpan temuan ke kotak temuan |
| GET | `/api/newsroom/agen/riwayat` | – | 30 jalan agen terakhir |

Contoh:

```bash
curl -s -X POST https://mbcindonesia-tv.vercel.app/api/newsroom/agen/jalankan \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"artikel_id": 12, "agen": ["klarifikasi","etika"]}' | jq '.hasil[] | {agent, ringkas, sumber}'
```

Bentuk hasil satu agen:

```json
{ "agent": "klarifikasi", "nama": "Verifikator & Klarifikasi", "sumber": "lokal",
  "ringkas": "4 klaim perlu bukti; 0 sumber tercatat; 0 klaim belum diverifikasi.",
  "data": { "klaim": [...], "langkah_klarifikasi": [...], "skor_kesiapan": 30, "status": "belum layak tayang" },
  "temuan": [ { "tingkat": "kritis", "judul": "Belum ada sumber tercatat", "rincian": "..." } ],
  "catatan_llm": null, "durasi_ms": 2 }
```

`tingkat` mengikuti skema tabel `ai_findings`: `info | saran | peringatan | kritis`.

## 4. Memakai di Newsroom (UI)

1. Masuk `/newsroom` dengan akun **editorial** atau **direksi**.
2. Buka menu **Studio AI**.
3. Pilih agen dengan mengklik kartunya (Enter/Spasi juga bisa), lalu **▶ Jalankan agen terpilih**.
4. Baca hasil per agen; klik **💾 Simpan temuan ke kotak temuan** agar masuk menu **Temuan AI**.
5. Butuh bahan? Gunakan kotak **🔎 Cari di arsip MBC**, atau tempel draf di **Periksa draf teks**
   (draf tidak disimpan ke CMS).

Badge di atas hasil menunjukkan mode yang benar-benar dipakai (`MESIN LOKAL` / `HIBRIDA`).

## 5. Uji otomatis (wajib dijalankan sebelum rilis)

```bash
python3 ops/uji-agen-ai.py     # 30 pemeriksaan API: peran, validasi, hasil, audit (tanpa DB)
python3 ops/uji-agen-llm.py    # 13 pemeriksaan jalur LLM: berhasil, gagal (500), lambat (timeout)
python3 ops/uji-ui-agen.py     # 33 pemeriksaan UI browser: kartu, pilih agen, hasil, simpan, draf, penolakan peran
```

Ketiganya memakai `express` asli + klien `pg` tiruan / server LLM tiruan, sehingga bisa dijalankan
di mesin tanpa PostgreSQL maupun tanpa kunci API. Harness sementara ditulis ke
`server/scripts/_harness-*.js` dan sudah masuk `.gitignore`.

## 6. Batasan yang perlu diketahui manajemen

- Mesin lokal bersifat **heuristik** (pola istilah + statistik teks): bagus untuk menandai risiko dan
  menyusun bahan, **bukan** pengganti verifikasi manusia.
- Agen tidak mencari ke internet; ia menelusuri arsip CMS + daftar rujukan resmi (`server/agen-ai.js` → `RUJUKAN`).
  Daftar rujukan boleh ditambah tim redaksi (BMKG, BPS, Kemnaker, BNPB, Dewan Pers, KPU, PDDikti, MA).
- Rekomendasi hukum/etika bersifat penanda awal, bukan pendapat hukum.
- Biaya LLM dibatasi `LLM_BATAS_HARIAN` (default 200 panggilan/hari) dan dipantau dari `GET /agen/daftar`.
