-- ============================================================
-- Central do Assinante — schema inicial (Postgres)
-- Banco: centralapp
-- Rode manualmente (psql / DBeaver / pgAdmin):
--   psql "postgresql://centralapp:...@10.10.10.209:5432/centralapp" -f 001_init.sql
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- Propagandas (carrossel da Home)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banners (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL DEFAULT '',
  subtitle        TEXT NOT NULL DEFAULT '',
  cta_label       TEXT NOT NULL DEFAULT '',
  link_url        TEXT NOT NULL DEFAULT '',
  image_url       TEXT NOT NULL DEFAULT '',
  theme           TEXT NOT NULL DEFAULT 'navy'
                  CHECK (theme IN ('navy', 'blue', 'sky')),
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  show_cta        BOOLEAN NOT NULL DEFAULT FALSE,
  image_only      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active_order
  ON banners (active, sort_order);

-- ------------------------------------------------------------
-- Planos móveis (sync AltaRede + liberação no app)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mobile_plans (
  id                    TEXT PRIMARY KEY,
  code                  INTEGER NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  display_name          TEXT NOT NULL,
  monthly_price         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  data_gb               NUMERIC(10, 2) NOT NULL DEFAULT 0,
  port_gb               NUMERIC(10, 2) NOT NULL DEFAULT 0,
  bonus_gb              NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_gb              NUMERIC(10, 2) NOT NULL DEFAULT 0,
  voice_minutes         TEXT NOT NULL DEFAULT '',
  sms                   TEXT NOT NULL DEFAULT '',
  benefits              TEXT NOT NULL DEFAULT '',
  lineup                TEXT NOT NULL DEFAULT 'altarede',
  habilitar_contratacao BOOLEAN NOT NULL DEFAULT TRUE,
  show_in_app           BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order            INTEGER NOT NULL DEFAULT 500,
  missing_from_altarede BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_plans_show_order
  ON mobile_plans (show_in_app, sort_order);

-- ------------------------------------------------------------
-- Ordens / solicitações (upgrade fibra, chip, recarga, etc.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_orders (
  id                    TEXT PRIMARY KEY,
  type                  TEXT NOT NULL
                        CHECK (type IN (
                          'upgrade',
                          'mobile_interest',
                          'mobile_recharge',
                          'support',
                          'other'
                        )),
  protocol              TEXT,
  sale_id               TEXT,
  status                TEXT NOT NULL DEFAULT 'aguardando'
                        CHECK (status IN (
                          'aguardando',
                          'em_analise',
                          'em_andamento',
                          'concluida',
                          'cancelada'
                        )),
  status_label          TEXT NOT NULL DEFAULT 'Aguardando',

  customer_name         TEXT NOT NULL DEFAULT '',
  customer_document     TEXT NOT NULL DEFAULT '',
  customer_phone        TEXT NOT NULL DEFAULT '',
  customer_email        TEXT NOT NULL DEFAULT '',
  customer_login        TEXT NOT NULL DEFAULT '',
  contract_id           TEXT NOT NULL DEFAULT '',

  -- Upgrade fibra
  current_plan_name     TEXT,
  current_speed_mbps    INTEGER,
  requested_plan_name   TEXT,
  requested_speed_mbps  INTEGER,
  monthly_price         NUMERIC(12, 2),
  commercial_plan_id    INTEGER,

  -- Telefonia / recarga
  line_msisdn           TEXT,
  mobile_plan_name      TEXT,
  mobile_plan_price     NUMERIC(12, 2),
  data_left_label       TEXT,

  notes                 TEXT NOT NULL DEFAULT '',
  source                TEXT NOT NULL DEFAULT 'central-assinante',
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_type_status
  ON service_orders (type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_orders_document
  ON service_orders (customer_document);

CREATE INDEX IF NOT EXISTS idx_service_orders_protocol
  ON service_orders (protocol);

-- ------------------------------------------------------------
-- Tickets de suporte (quando sair do fluxo só WhatsApp)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id                  TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  customer_name       TEXT NOT NULL DEFAULT '',
  customer_document   TEXT NOT NULL DEFAULT '',
  customer_phone      TEXT NOT NULL DEFAULT '',
  customer_login      TEXT NOT NULL DEFAULT '',
  contract_id         TEXT NOT NULL DEFAULT '',
  subject             TEXT NOT NULL DEFAULT '',
  message             TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'aberto'
                      CHECK (status IN ('aberto', 'em_atendimento', 'resolvido', 'fechado')),
  source              TEXT NOT NULL DEFAULT 'central-assinante',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets (status, created_at DESC);

-- ------------------------------------------------------------
-- Configurações do painel / app
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('upgrade_whatsapp', '"24993279575"'::jsonb),
  ('admin_notes', '"Central TR Telecom"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- updated_at automático
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_banners_updated_at ON banners;
CREATE TRIGGER trg_banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_mobile_plans_updated_at ON mobile_plans;
CREATE TRIGGER trg_mobile_plans_updated_at
  BEFORE UPDATE ON mobile_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_service_orders_updated_at ON service_orders;
CREATE TRIGGER trg_service_orders_updated_at
  BEFORE UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- Conferência rápida:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
