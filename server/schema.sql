-- MBCINDONESIA.TV — Skema database (PostgreSQL 14+, kompatibel Neon)
-- Jalankan: psql $DATABASE_URL -f schema.sql   (idempotent: aman dijalankan ulang)

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('direksi','finance','sales','editorial')),
  role_label   TEXT NOT NULL,
  pass_hash    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS programs (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  cat          TEXT NOT NULL,
  img          TEXT NOT NULL,
  descr        TEXT NOT NULL,
  rating       NUMERIC(2,1) NOT NULL DEFAULT 4.5,
  views        TEXT NOT NULL DEFAULT '0',
  hl           TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS episodes (
  id           SERIAL PRIMARY KEY,
  program_id   TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  ep_index     INT  NOT NULL,
  title        TEXT NOT NULL,
  dur          TEXT NOT NULL,
  video_key    TEXT NOT NULL,
  UNIQUE (program_id, ep_index)
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id           SERIAL PRIMARY KEY,
  stage        TEXT NOT NULL CHECK (stage IN ('prospek','penawaran','negosiasi','kontrak','selesai')) DEFAULT 'prospek',
  company      TEXT NOT NULL,
  deal         TEXT NOT NULL,
  value_jt     NUMERIC(12,2) NOT NULL CHECK (value_jt >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_stage ON crm_deals(stage);

CREATE TABLE IF NOT EXISTS production_projects (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  client       TEXT NOT NULL,
  stage        INT  NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 5),
  progress     INT  NOT NULL DEFAULT 2 CHECK (progress BETWEEN 0 AND 100),
  due          TEXT NOT NULL DEFAULT '—',
  budget_jt    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_slots (
  id           SERIAL PRIMARY KEY,
  slot         TEXT NOT NULL,
  price        TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('Tersedia','Terjual')) DEFAULT 'Tersedia'
);

CREATE TABLE IF NOT EXISTS campaigns (
  id           SERIAL PRIMARY KEY,
  company      TEXT NOT NULL,
  package      TEXT NOT NULL,
  total        INT NOT NULL CHECK (total > 0),
  done         INT NOT NULL DEFAULT 0 CHECK (done >= 0)
);

CREATE TABLE IF NOT EXISTS invoices (
  id           SERIAL PRIMARY KEY,
  inv          TEXT NOT NULL UNIQUE,
  company      TEXT NOT NULL,
  amount_jt    NUMERIC(12,2) NOT NULL,
  due          TEXT NOT NULL,
  aging        TEXT NOT NULL CHECK (aging IN ('Lancar','1–30 hari','60+ hari')) DEFAULT 'Lancar'
);

CREATE TABLE IF NOT EXISTS approvals (
  id           SERIAL PRIMARY KEY,
  ref          TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL,
  amount_jt    NUMERIC(12,2) NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  decided_by   TEXT,
  decided_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS master_items (
  id           SERIAL PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('klien','vendor','produk')),
  c1           TEXT NOT NULL,
  c2           TEXT NOT NULL DEFAULT '',
  c3           TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_master_kind ON master_items(kind);

CREATE TABLE IF NOT EXISTS audit_log (
  id           SERIAL PRIMARY KEY,
  action       TEXT NOT NULL,
  who          TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id           SERIAL PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id           SERIAL PRIMARY KEY,
  program_id   TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  author       TEXT NOT NULL,
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_program ON comments(program_id, created_at DESC);

COMMIT;
