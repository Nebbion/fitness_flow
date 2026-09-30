-- ============================================================
-- FitnessFlow — Migration 002: Automazioni, Billing, AI
-- ============================================================

-- ============================================================
-- TABELLA: whatsapp_messages
-- ============================================================
CREATE TABLE whatsapp_messages (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  direction       message_direction NOT NULL,
  body            TEXT NOT NULL,
  wa_message_id   TEXT,          -- ID restituito da Meta API
  status          message_status NOT NULL DEFAULT 'pending',
  trigger_event   TEXT,          -- es. "appointment_created", "reminder_24h"
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELLA: email_logs
-- ============================================================
CREATE TABLE email_logs (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  template        TEXT NOT NULL, -- es. "appointment_confirmation"
  resend_id       TEXT,          -- ID restituito da Resend
  to_email        TEXT NOT NULL,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending|sent|bounced|failed
  locale          preferred_language NOT NULL DEFAULT 'it',
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELLA: notification_rules
-- ============================================================
CREATE TABLE notification_rules (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_trigger   TEXT NOT NULL, -- es. "appointment_created", "reminder_24h", "client_inactive_30d"
  channel         notification_channel NOT NULL DEFAULT 'whatsapp',
  delay_minutes   INT DEFAULT 0, -- ritardo dall'evento (negativo = prima)
  template_key    TEXT NOT NULL, -- chiave del template i18n
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, event_trigger, channel, delay_minutes)
);

-- ============================================================
-- TABELLA: ai_usage_logs
-- ============================================================
CREATE TABLE ai_usage_logs (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  feature         TEXT NOT NULL, -- es. "nutrition_plan", "workout_draft", "summarize_client"
  model           TEXT NOT NULL DEFAULT 'gpt-4o',
  prompt_tokens   INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens    INT GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  cost_usd        NUMERIC(10,6),
  duration_ms     INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELLA: subscription_events (log webhook Stripe)
-- ============================================================
CREATE TABLE subscription_events (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  processed       BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELLA: onboarding_steps (traccia wizard onboarding)
-- ============================================================
CREATE TABLE onboarding_steps (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  step_company    BOOLEAN DEFAULT FALSE,
  step_profession BOOLEAN DEFAULT FALSE,
  step_services   BOOLEAN DEFAULT FALSE,
  step_billing    BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FUNZIONE: aggiorna updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger su tutte le tabelle con updated_at
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNZIONE: aggiorna last_appointment_at su clients
-- ============================================================
CREATE OR REPLACE FUNCTION update_client_last_appointment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE clients
    SET last_appointment_at = NEW.end_at
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appointment_completed
  AFTER UPDATE ON appointments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_client_last_appointment();

-- ============================================================
-- FUNZIONE: crea profilo automaticamente dopo signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'preferred_language')::preferred_language, 'it')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
