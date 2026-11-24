-- ============================================================================
-- MBC INDONESIA — MIGRASI 1.5.0 (MBC Single Account)
-- ----------------------------------------------------------------------------
-- PENTING: rilis 1.5.0 SUDAH BERJALAN TANPA migrasi ini.
-- Modul `server/akun.js` menyimpan seluruh data akun di tabel yang sudah ada
-- (`users`, `ai_findings`, `audit_log`) karena akun aplikasi `mbc_app` tidak
-- berhak DDL di Supabase. Migrasi ini OPSIONAL dan bersifat "rapikan struktur":
-- jalankan bila tim IT ingin data akun tersimpan di tabel relasional sendiri
-- (lebih mudah diaudit, dibackup selektif, dan dipisah dari tabel AI).
--
-- Setelah migrasi dijalankan, modul otomatis memakai tabel `members`
-- (dideteksi lewat information_schema) tanpa perlu mengubah konfigurasi.
--
-- Cara menjalankan (dari mesin yang punya kredensial owner/pasca):
--   psql "$SUPABASE_DB_URL" -f docs/MIGRASI-1.5.0.sql
-- atau tempel isi berkas ini di SQL Editor dasbor Supabase.
--
-- Aman diulang (idempoten): semua pernyataan memakai IF NOT EXISTS.
-- ============================================================================

-- 1) Tabel akun anggota publik -------------------------------------------------
create table if not exists public.members (
  id            serial primary key,
  email         text not null,
  nama          text not null,
  pass_hash     text not null,               -- bcrypt cost 12
  peran         text not null default 'pembaca',
  label_peran   text not null default 'Anggota Publik · Pembaca',
  bio           text not null default '',
  wilayah       text not null default '',
  minat         jsonb not null default '[]'::jsonb,
  avatar        text not null default '#1e88e5',
  aktif         boolean not null default true,
  terverifikasi boolean not null default false,
  verifikasi_pada timestamptz,
  pulih_pada    timestamptz,
  setuju_pada   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint members_peran_check check (peran in ('pembaca','kreator','mitra','editorial'))
);

create unique index if not exists members_email_uniq on public.members (lower(email));
create index if not exists members_created_idx on public.members (created_at desc);

-- 2) Sesi perangkat (menggantikan daftar sesi di ai_findings) ------------------
create table if not exists public.member_sessions (
  id          bigserial primary key,
  member_id   integer not null references public.members(id) on delete cascade,
  sid         text not null,                 -- sid = sha256(token) 32 karakter
  ip          text not null default '',
  user_agent  text not null default '',
  perangkat   text not null default 'peramban',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create unique index if not exists member_sessions_sid_uniq on public.member_sessions (sid);
create index if not exists member_sessions_member_idx on public.member_sessions (member_id, expires_at desc);

-- 3) Kode sekali pakai (OTP verifikasi & pemulihan) ---------------------------
create table if not exists public.member_codes (
  id          bigserial primary key,
  member_id   integer references public.members(id) on delete cascade,
  email       text not null,
  jenis       text not null,                 -- 'verifikasi' | 'pulih'
  kode_hash   text not null,
  percobaan   smallint not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists member_codes_cari_idx on public.member_codes (lower(email), jenis, expires_at desc);

-- 4) 2FA TOTP & kode cadangan ------------------------------------------------
create table if not exists public.member_2fa (
  member_id   integer primary key references public.members(id) on delete cascade,
  rahasia     text not null,                 -- seed base32 (simpan terenkripsi bila perlu)
  aktif       boolean not null default false,
  cadangan    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 5) Jejak aktivitas akun (boleh juga tetap memakai audit_log) ----------------
create table if not exists public.member_events (
  id          bigserial primary key,
  member_id   integer references public.members(id) on delete set null,
  aksi        text not null,
  ip          text not null default '',
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists member_events_member_idx on public.member_events (member_id, created_at desc);

-- 6) Kolom tambahan pada users (staf) — opsional, agar staf pun bisa 2FA ------
alter table public.users add column if not exists slug     text;
alter table public.users add column if not exists bio      text not null default '';
alter table public.users add column if not exists avatar   text not null default '#1e88e5';
alter table public.users add column if not exists verified boolean not null default false;
alter table public.users add column if not exists twofa    text;

-- 7) Pindahkan 4 akun staf yang sudah ada menjadi anggota terdaftar -----------
--    (kata sandi tetap; hanya agar muncul di daftar anggota bila diperlukan)
insert into public.members (email, nama, pass_hash, peran, label_peran, terverifikasi)
select u.email, u.name, u.pass_hash,
       case u.role when 'editorial' then 'editorial' else 'pembaca' end,
       coalesce(u.role_label, 'Staf MBC'),
       true
  from public.users u
 where u.pass_hash is not null
on conflict do nothing;

-- 8) Bersihkan catatan akun yang menumpang di ai_findings (dijalankan manual) -
--    HANYA jalankan setelah aplikasi versi 1.5.0 memakai tabel members:
-- delete from public.ai_findings
--  where agent_id = 'etika'
--    and evidence->>'jenis' in ('sesi','profil','otp','2fa','2fa-pending','2fa-cadangan');

-- 9) Verifikasi ---------------------------------------------------------------
-- select count(*) as anggota from public.members;
-- select table_name from information_schema.tables
--  where table_schema='public' and table_name like 'member%';
