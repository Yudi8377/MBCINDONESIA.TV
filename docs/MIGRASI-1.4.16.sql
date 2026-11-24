-- ============================================================================
-- MBC INDONESIA — Migrasi 1.4.16 (OPSIONAL, dijalankan pengelola DB/Supabase SQL)
-- Tujuan: mengganti pemakaian audit_log & ai_findings dengan tabel khusus yang
-- lebih rapi. Aplikasi 1.4.16 SUDAH BERJALAN tanpa migrasi ini.
-- Akun aplikasi mbc_app tidak berhak DDL, jadi jalankan sebagai owner/postgres.
-- ============================================================================

-- 1. Analitik pengunjung
create table if not exists analytics_events (
  id          bigserial primary key,
  session_id  text,
  page        text        not null,
  type        text        not null check (type in ('view','read','video','share')),
  seconds     integer     not null default 0,
  device      text,
  referrer    text,
  created_at  timestamptz not null default now()
);
create index if not exists analytics_events_created_idx on analytics_events (created_at desc);
create index if not exists analytics_events_type_idx    on analytics_events (type, created_at desc);
create index if not exists analytics_events_page_idx    on analytics_events (page);

-- 2. Sesi penonton live (heartbeat)
create table if not exists live_sessions (
  id          bigserial primary key,
  session_id  text        not null,
  created_at  timestamptz not null default now()
);
create index if not exists live_sessions_created_idx on live_sessions (created_at desc);

-- 3. Kiriman kontributor
create table if not exists contributor_submissions (
  id          bigserial primary key,
  nama        text not null,
  email       text not null,
  judul       text not null,
  isi         text not null,
  kategori    text not null default 'daerah',
  wilayah     text not null default 'nasional',
  tautan      text,
  status      text not null default 'baru'
              check (status in ('baru','dibaca','diterima','ditolak')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists contributor_submissions_status_idx
  on contributor_submissions (status, created_at desc);

-- 4. Laporan konten / penyalahgunaan
create table if not exists reports (
  id          bigserial primary key,
  jenis       text not null default 'lainnya'
              check (jenis in ('spam','sara','hoaks','pelecehan','hak-cipta','lainnya')),
  target      text not null,
  catatan     text,
  email       text,
  halaman     text,
  status      text not null default 'baru'
              check (status in ('baru','ditinjau','selesai','diabaikan')),
  handled_by  text,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists reports_status_idx on reports (status, created_at desc);

-- 5. Hak akses untuk akun aplikasi
grant select, insert, update on analytics_events, live_sessions, contributor_submissions, reports to mbc_app;
grant usage, select on all sequences in schema public to mbc_app;

-- 6. Pemeliharaan: simpan analitik 90 hari, hapus sesi live > 1 hari
--    (jadwalkan lewat pg_cron atau cron eksternal)
-- delete from analytics_events where created_at < now() - interval '90 days';
-- delete from live_sessions      where created_at < now() - interval '1 day';

-- 7. Setelah migrasi dijalankan, tukar sumber data di server/server.js:
--    - analytics/collect  : INSERT INTO audit_log(...)   -> INSERT INTO analytics_events(...)
--    - analytics/summary  : SELECT ... FROM audit_log    -> SELECT ... FROM analytics_events
--    - live/heartbeat     : audit_log                    -> live_sessions
--    - kontributor/lapor  : ai_findings                  -> contributor_submissions / reports
--    - /api/newsroom/antrean tetap kompatibel bila view berikut dibuat:
create or replace view antrean_publik as
  select id, 'kontributor' as jenis, judul as title, isi as detail,
         jsonb_build_object('jenis','kontributor','nama',nama,'email',email,
                            'kategori',kategori,'wilayah',wilayah,'tautan',tautan) as evidence,
         status, created_at
    from contributor_submissions
  union all
  select id, 'laporan', target, coalesce(catatan,''),
         jsonb_build_object('jenis','laporan','tipe',jenis,'email',email,'halaman',halaman),
         status, created_at
    from reports;
grant select on antrean_publik to mbc_app;
