-- Connessione Google Calendar distinta per ogni professionista.
-- Il refresh token viene cifrato dall'applicazione prima del salvataggio e la
-- tabella e accessibile esclusivamente dalle API server-side.

CREATE TABLE google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL,
  google_account_email TEXT,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  calendar_name TEXT,
  calendar_timezone TEXT,
  refresh_token_encrypted TEXT NOT NULL,
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disconnected', 'error')),
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (professional_id),
  FOREIGN KEY (professional_id, tenant_id)
    REFERENCES profiles(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX google_calendar_connections_tenant
  ON google_calendar_connections(tenant_id);

CREATE TRIGGER google_calendar_connections_updated_at
  BEFORE UPDATE ON google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON google_calendar_connections FROM anon, authenticated;

CREATE POLICY "super_admin_all_google_calendar_connections"
  ON google_calendar_connections
  FOR ALL USING (is_super_admin());

