-- ============================================================
-- FitnessFlow — Migration 003: Indici + RLS Policies
-- ============================================================

-- ─── ESTENSIONE per EXCLUDE su appointments ──────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- INDICI — Performance
-- ============================================================

-- tenants
CREATE INDEX idx_tenants_slug         ON tenants(slug);
CREATE INDEX idx_tenants_status       ON tenants(status);
CREATE INDEX idx_tenants_stripe       ON tenants(stripe_customer_id);

-- profiles
CREATE INDEX idx_profiles_tenant      ON profiles(tenant_id);
CREATE INDEX idx_profiles_role        ON profiles(role);

-- clients
CREATE INDEX idx_clients_tenant       ON clients(tenant_id);
CREATE INDEX idx_clients_staff        ON clients(assigned_staff_id);
CREATE INDEX idx_clients_email        ON clients(tenant_id, email);
CREATE INDEX idx_clients_last_appt    ON clients(tenant_id, last_appointment_at);
CREATE INDEX idx_clients_active       ON clients(tenant_id, active);
-- Full-text search sul nome cliente
CREATE INDEX idx_clients_name_trgm    ON clients USING gin(full_name gin_trgm_ops);

-- appointments
CREATE INDEX idx_appts_tenant_date    ON appointments(tenant_id, start_at);
CREATE INDEX idx_appts_client         ON appointments(client_id);
CREATE INDEX idx_appts_staff_date     ON appointments(staff_id, start_at);
CREATE INDEX idx_appts_status         ON appointments(tenant_id, status);

-- documents
CREATE INDEX idx_docs_client          ON documents(client_id, tenant_id);
CREATE INDEX idx_docs_type            ON documents(tenant_id, type);

-- progress_entries
CREATE INDEX idx_progress_client      ON progress_entries(client_id, recorded_at DESC);

-- whatsapp_messages
CREATE INDEX idx_wa_tenant_date       ON whatsapp_messages(tenant_id, created_at DESC);
CREATE INDEX idx_wa_client            ON whatsapp_messages(client_id);

-- email_logs
CREATE INDEX idx_email_tenant         ON email_logs(tenant_id, created_at DESC);

-- ai_usage_logs
CREATE INDEX idx_ai_tenant_date       ON ai_usage_logs(tenant_id, created_at DESC);

-- subscription_events
CREATE INDEX idx_stripe_events        ON subscription_events(stripe_event_id);
CREATE INDEX idx_stripe_processed     ON subscription_events(processed, created_at);

-- ============================================================
-- ROW LEVEL SECURITY — Abilitazione su tutte le tabelle
-- ============================================================

ALTER TABLE tenants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE services              ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS (usate nelle policy RLS)
-- ============================================================

-- Restituisce il tenant_id dell'utente corrente
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$;

-- Restituisce il ruolo dell'utente corrente
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Controlla se l'utente è SUPER_ADMIN
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT auth_user_role() = 'SUPER_ADMIN';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Controlla se l'utente è TENANT_ADMIN nel proprio tenant
CREATE OR REPLACE FUNCTION is_tenant_admin()
RETURNS BOOLEAN AS $$
  SELECT auth_user_role() IN ('SUPER_ADMIN', 'TENANT_ADMIN');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Controlla se l'utente è STAFF o superiore
CREATE OR REPLACE FUNCTION is_staff_or_above()
RETURNS BOOLEAN AS $$
  SELECT auth_user_role() IN ('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- RLS: tenants
-- ============================================================

-- SUPER_ADMIN: vede tutti i tenant
CREATE POLICY "super_admin_all_tenants" ON tenants
  FOR ALL USING (is_super_admin());

-- TENANT_ADMIN: vede solo il proprio tenant
CREATE POLICY "tenant_admin_own_tenant" ON tenants
  FOR SELECT USING (id = auth_tenant_id());

-- TENANT_ADMIN: aggiorna solo il proprio tenant
CREATE POLICY "tenant_admin_update_own" ON tenants
  FOR UPDATE USING (id = auth_tenant_id() AND is_tenant_admin());

-- ============================================================
-- RLS: profiles
-- ============================================================

-- Ogni utente vede il proprio profilo
CREATE POLICY "own_profile_select" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Staff e superiori vedono i profili del proprio tenant
CREATE POLICY "tenant_profiles_select" ON profiles
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND is_staff_or_above()
  );

-- SUPER_ADMIN: vede tutto
CREATE POLICY "super_admin_all_profiles" ON profiles
  FOR ALL USING (is_super_admin());

-- Aggiornamento profilo proprio
CREATE POLICY "own_profile_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- RLS: clients
-- ============================================================

-- Staff e superiori del tenant vedono tutti i clienti del tenant
CREATE POLICY "tenant_clients_select" ON clients
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND is_staff_or_above()
  );

-- Staff vedono solo i clienti assegnati a loro
CREATE POLICY "staff_own_clients" ON clients
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'STAFF'
    AND assigned_staff_id = auth.uid()
  );

-- Il cliente vede solo se stesso (tramite profile_id)
CREATE POLICY "client_own_record" ON clients
  FOR SELECT USING (profile_id = auth.uid());

-- TENANT_ADMIN: gestione completa clienti
CREATE POLICY "tenant_admin_clients_all" ON clients
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );

-- SUPER_ADMIN: tutto
CREATE POLICY "super_admin_all_clients" ON clients
  FOR ALL USING (is_super_admin());

-- ============================================================
-- RLS: services
-- ============================================================

CREATE POLICY "tenant_services_select" ON services
  FOR SELECT USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_admin_services_all" ON services
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );

CREATE POLICY "super_admin_all_services" ON services
  FOR ALL USING (is_super_admin());

-- ============================================================
-- RLS: appointments
-- ============================================================

-- Staff e superiori vedono tutti gli appuntamenti del tenant
CREATE POLICY "tenant_appts_select" ON appointments
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND is_staff_or_above()
  );

-- Il cliente vede solo i propri appuntamenti
CREATE POLICY "client_own_appts" ON appointments
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

-- TENANT_ADMIN: gestione completa
CREATE POLICY "tenant_admin_appts_all" ON appointments
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );

-- STAFF: modifica solo i propri appuntamenti
CREATE POLICY "staff_own_appts" ON appointments
  FOR UPDATE USING (
    tenant_id = auth_tenant_id()
    AND staff_id = auth.uid()
    AND auth_user_role() = 'STAFF'
  );

CREATE POLICY "super_admin_all_appts" ON appointments
  FOR ALL USING (is_super_admin());

-- ============================================================
-- RLS: documents
-- ============================================================

-- Staff: tutti i documenti del tenant
CREATE POLICY "tenant_docs_select" ON documents
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND is_staff_or_above()
  );

-- Cliente: solo i propri documenti visibili
CREATE POLICY "client_own_docs" ON documents
  FOR SELECT USING (
    visible_to_client = TRUE
    AND client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "tenant_admin_docs_all" ON documents
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );

CREATE POLICY "super_admin_all_docs" ON documents
  FOR ALL USING (is_super_admin());

-- ============================================================
-- RLS: progress_entries
-- ============================================================

CREATE POLICY "tenant_progress_select" ON progress_entries
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND is_staff_or_above()
  );

CREATE POLICY "client_own_progress" ON progress_entries
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "tenant_admin_progress_all" ON progress_entries
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );

CREATE POLICY "super_admin_all_progress" ON progress_entries
  FOR ALL USING (is_super_admin());

-- ============================================================
-- RLS: custom_field_definitions
-- ============================================================

CREATE POLICY "tenant_custom_fields_select" ON custom_field_definitions
  FOR SELECT USING (tenant_id = auth_tenant_id());

CREATE POLICY "tenant_admin_custom_fields_all" ON custom_field_definitions
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );

CREATE POLICY "super_admin_all_custom_fields" ON custom_field_definitions
  FOR ALL USING (is_super_admin());

-- ============================================================
-- RLS: whatsapp_messages
-- ============================================================

CREATE POLICY "tenant_wa_select" ON whatsapp_messages
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND is_staff_or_above()
  );

CREATE POLICY "tenant_admin_wa_all" ON whatsapp_messages
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );

CREATE POLICY "super_admin_all_wa" ON whatsapp_messages
  FOR ALL USING (is_super_admin());

-- ============================================================
-- RLS: email_logs
-- ============================================================

CREATE POLICY "tenant_email_select" ON email_logs
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND is_staff_or_above()
  );

CREATE POLICY "tenant_admin_email_all" ON email_logs
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );

CREATE POLICY "super_admin_all_email" ON email_logs
  FOR ALL USING (is_super_admin());

-- ============================================================
-- RLS: ai_usage_logs
-- ============================================================

CREATE POLICY "tenant_admin_ai_select" ON ai_usage_logs
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );

CREATE POLICY "insert_own_ai_log" ON ai_usage_logs
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "super_admin_all_ai" ON ai_usage_logs
  FOR ALL USING (is_super_admin());

-- ============================================================
-- RLS: subscription_events, notification_rules, onboarding_steps
-- ============================================================

CREATE POLICY "tenant_admin_sub_events" ON subscription_events
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );
CREATE POLICY "super_admin_all_sub_events" ON subscription_events
  FOR ALL USING (is_super_admin());

CREATE POLICY "tenant_notification_rules" ON notification_rules
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND is_tenant_admin()
  );
CREATE POLICY "super_admin_all_notif" ON notification_rules
  FOR ALL USING (is_super_admin());

CREATE POLICY "tenant_onboarding" ON onboarding_steps
  FOR ALL USING (tenant_id = auth_tenant_id());
CREATE POLICY "super_admin_all_onboarding" ON onboarding_steps
  FOR ALL USING (is_super_admin());
