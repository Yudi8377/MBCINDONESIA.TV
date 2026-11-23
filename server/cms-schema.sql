-- ============================================================
-- MBC INDONESIA NEWSROOM — skema CMS editorial (idempotent)
-- Dijalankan setelah schema.sql. Aman dijalankan berulang.
-- ============================================================
BEGIN;

-- ---------- Taksonomi: kanal & tag ----------
CREATE TABLE IF NOT EXISTS channels (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT DEFAULT '',
  color        TEXT DEFAULT '#e63329',
  sort_order   INT  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  slug         TEXT NOT NULL UNIQUE,
  usage_count  INT  NOT NULL DEFAULT 0
);

-- ---------- Penulis / redaktur ----------
CREATE TABLE IF NOT EXISTS staff (
  id           SERIAL PRIMARY KEY,
  user_email   TEXT NOT NULL UNIQUE REFERENCES users(email) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  title        TEXT DEFAULT 'Jurnalis',
  bio          TEXT DEFAULT '',
  avatar_color TEXT DEFAULT '#e63329',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Konten: artikel (semua status) ----------
CREATE TABLE IF NOT EXISTS articles (
  id             SERIAL PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  deck           TEXT NOT NULL DEFAULT '',
  body           TEXT NOT NULL DEFAULT '',            -- markdown ringan
  channel_id     TEXT REFERENCES channels(id) ON DELETE SET NULL,
  author_email   TEXT REFERENCES staff(user_email) ON DELETE SET NULL,
  editor_email   TEXT REFERENCES staff(user_email) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('ide','draft','review','fakta','hukum','siap','terjadwal','tayang','arsip','ditarik')),
  priority       TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('rendah','normal','tinggi','mendesak')),
  is_breaking    BOOLEAN NOT NULL DEFAULT FALSE,
  tags           TEXT[] NOT NULL DEFAULT '{}',
  hero_image     TEXT DEFAULT '',
  seo_title      TEXT DEFAULT '',
  seo_desc       TEXT DEFAULT '',
  ai_summary     TEXT DEFAULT '',
  ai_sentiment   TEXT DEFAULT '',
  ai_keywords    TEXT[] NOT NULL DEFAULT '{}',
  fact_checks    JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{claim, status, source, by, at}]
  sources        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{title, url, type, note}]
  scheduled_at   TIMESTAMPTZ,
  published_at   TIMESTAMPTZ,
  word_count     INT NOT NULL DEFAULT 0,
  read_time_min  INT NOT NULL DEFAULT 1,
  views          INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_articles_status  ON articles(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_channel ON articles(channel_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_slug    ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_tags    ON articles USING GIN(tags);

-- ---------- Versi artikel (riwayat revisi) ----------
CREATE TABLE IF NOT EXISTS article_revisions (
  id          SERIAL PRIMARY KEY,
  article_id  INT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  version     INT NOT NULL,
  title       TEXT NOT NULL,
  deck        TEXT DEFAULT '',
  body        TEXT DEFAULT '',
  edited_by   TEXT,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id, version)
);

-- ---------- Komentar internal (catatan redaksi per artikel) ----------
CREATE TABLE IF NOT EXISTS editorial_notes (
  id          SERIAL PRIMARY KEY,
  article_id  INT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author      TEXT NOT NULL,
  body        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'catatan' CHECK (kind IN ('catatan','koreksi','permintaan','hukum')),
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_article ON editorial_notes(article_id, resolved, created_at DESC);

-- ---------- Alur persetujuan editorial ----------
CREATE TABLE IF NOT EXISTS editorial_approvals (
  id          SERIAL PRIMARY KEY,
  article_id  INT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  stage       TEXT NOT NULL CHECK (stage IN ('redaktur','fakta','hukum','pemimpin')),
  status      TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','disetujui','ditolak','revisi')),
  actor       TEXT,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_appr_article ON editorial_approvals(article_id, created_at DESC);

-- ---------- Rencana editorial (editorial calendar) dan tugas ----------
CREATE TABLE IF NOT EXISTS editorial_tasks (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  assignee     TEXT,
  plan_date    DATE NOT NULL,
  slot         TEXT DEFAULT 'pagi' CHECK (slot IN ('pagi','siang','sore','malam')),
  channel_id   TEXT REFERENCES channels(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'rencana' CHECK (status IN ('rencana','dikerjakan','selesai','batal')),
  angle        TEXT DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON editorial_tasks(plan_date, slot);

-- ---------- Media library ----------
CREATE TABLE IF NOT EXISTS media_assets (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'gambar' CHECK (kind IN ('gambar','video','audio','dokumen')),
  path        TEXT NOT NULL,
  size_kb     INT DEFAULT 0,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  credit      TEXT DEFAULT '',
  uploaded_by TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Analitik konten (rollup harian per artikel) ----------
CREATE TABLE IF NOT EXISTS content_analytics (
  id           SERIAL PRIMARY KEY,
  article_id   INT REFERENCES articles(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  views        INT NOT NULL DEFAULT 0,
  read_complete INT NOT NULL DEFAULT 0,
  shares       INT NOT NULL DEFAULT 0,
  avg_scroll   INT NOT NULL DEFAULT 0,
  UNIQUE(article_id, day)
);

-- ---------- Multi-agent AI: registry, run, temuan ----------
CREATE TABLE IF NOT EXISTS ai_agents (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  icon         TEXT DEFAULT '◆',
  color        TEXT DEFAULT '#e63329',
  is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  run_count    INT NOT NULL DEFAULT 0,
  last_run_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id          SERIAL PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  article_id  INT REFERENCES articles(id) ON DELETE CASCADE,
  trigger     TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','otomatis','jadwal','sweep')),
  status      TEXT NOT NULL DEFAULT 'selesai' CHECK (status IN ('selesai','gagal','sebagian')),
  input       JSONB NOT NULL DEFAULT '{}'::jsonb,
  output      JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_ms INT NOT NULL DEFAULT 0,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runs_agent ON ai_runs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_article ON ai_runs(article_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_findings (
  id          SERIAL PRIMARY KEY,
  article_id  INT REFERENCES articles(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','saran','peringatan','kritis')),
  title       TEXT NOT NULL,
  detail      TEXT DEFAULT '',
  evidence    JSONB NOT NULL DEFAULT '[]'::jsonb,
  status      TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru','dibaca','diterapkan','diabaikan')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_findings_status ON ai_findings(status, severity, created_at DESC);

-- ---------- Antrean tugas agen (orchestrator) ----------
CREATE TABLE IF NOT EXISTS agent_jobs (
  id          SERIAL PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  article_id  INT REFERENCES articles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'antre' CHECK (status IN ('antre','jalan','selesai','gagal')),
  priority    INT NOT NULL DEFAULT 5,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- ---------- Moderasi komentar publik ----------
CREATE TABLE IF NOT EXISTS comment_moderation (
  id            SERIAL PRIMARY KEY,
  comment_id    INT NOT NULL REFERENCES comments(id) ON DELETE CASCADE UNIQUE,
  status        TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','tayang','sembunyi','spam')),
  reason        TEXT DEFAULT '',
  moderated_by  TEXT,
  moderated_at  TIMESTAMPTZ
);

COMMIT;
