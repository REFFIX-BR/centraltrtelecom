-- Tokens Expo Push e histórico de envios (opcional; a API também grava JSON).

BEGIN;

CREATE TABLE IF NOT EXISTS push_tokens (
  token         TEXT PRIMARY KEY,
  document      TEXT NOT NULL DEFAULT '',
  login         TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT '',
  platform      TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_document
  ON push_tokens (document);

CREATE INDEX IF NOT EXISTS idx_push_tokens_login
  ON push_tokens (login);

CREATE TABLE IF NOT EXISTS push_history (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  route         TEXT NOT NULL DEFAULT '',
  send_to_all   BOOLEAN NOT NULL DEFAULT FALSE,
  document      TEXT NOT NULL DEFAULT '',
  login         TEXT NOT NULL DEFAULT '',
  recipients    INTEGER NOT NULL DEFAULT 0,
  delivered     INTEGER NOT NULL DEFAULT 0,
  errors        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
