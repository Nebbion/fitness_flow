-- Connessione WhatsApp Business distinta per ogni studio.
-- Il token viene cifrato dall'applicazione prima del salvataggio.

CREATE TABLE whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  whatsapp_business_account_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL UNIQUE,
  display_phone_number TEXT,
  verified_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disconnected', 'error')),
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_connections_tenant ON whatsapp_connections(tenant_id);

CREATE TRIGGER trg_whatsapp_connections_updated_at
  BEFORE UPDATE ON whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- Le API server-side usano la service role e restituiscono al browser solo lo
-- stato della connessione. I token non sono mai leggibili dal client Supabase.
CREATE POLICY "super_admin_all_whatsapp_connections" ON whatsapp_connections
  FOR ALL USING (is_super_admin());

CREATE UNIQUE INDEX whatsapp_messages_appointment_confirmation_once
  ON whatsapp_messages (tenant_id, appointment_id, trigger_event)
  WHERE appointment_id IS NOT NULL AND trigger_event = 'appointment_created';
