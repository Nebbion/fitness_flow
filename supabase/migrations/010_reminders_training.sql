-- Server-only tables: every API must resolve the actor before using service_role.
ALTER TABLE profiles ADD CONSTRAINT profiles_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE clients ADD CONSTRAINT clients_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE whatsapp_connections DROP CONSTRAINT whatsapp_connections_tenant_id_key;
ALTER TABLE whatsapp_connections ADD COLUMN professional_id UUID;
UPDATE whatsapp_connections w SET professional_id = (
  SELECT p.id FROM profiles p WHERE p.tenant_id = w.tenant_id AND p.role = 'TENANT_ADMIN'
  ORDER BY p.created_at, p.id LIMIT 1
);
-- Unowned legacy connections remain disconnected, never used as a fallback.
UPDATE whatsapp_connections SET status = 'disconnected' WHERE professional_id IS NULL;
ALTER TABLE whatsapp_connections ADD CONSTRAINT whatsapp_professional_key UNIQUE (professional_id);
ALTER TABLE whatsapp_connections ADD FOREIGN KEY (professional_id, tenant_id) REFERENCES profiles(id, tenant_id) ON DELETE CASCADE;
ALTER TABLE whatsapp_connections ADD COLUMN reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE whatsapp_connections ADD COLUMN reminder_minutes INT NOT NULL DEFAULT 1440 CHECK (reminder_minutes BETWEEN 5 AND 10080);
ALTER TABLE whatsapp_connections ADD COLUMN reminder_template TEXT NOT NULL DEFAULT 'appointment_reminder';
ALTER TABLE whatsapp_connections ADD COLUMN reminder_language TEXT NOT NULL DEFAULT 'it';
ALTER TABLE whatsapp_connections ADD COLUMN reminder_timezone TEXT NOT NULL DEFAULT 'Europe/Rome';
ALTER TABLE clients ADD COLUMN whatsapp_reminders_consent BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing connections inherit the tenant timezone; professionals can override it.
UPDATE whatsapp_connections w SET reminder_timezone = t.timezone FROM tenants t WHERE t.id = w.tenant_id;

CREATE TABLE appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL,
  appointment_version TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','sending','sent','delivered','read','retry','failed','unknown','cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  claim_token UUID,
  wa_message_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, appointment_version),
  FOREIGN KEY (professional_id, tenant_id) REFERENCES profiles(id, tenant_id)
);
CREATE INDEX appointment_reminders_due ON appointment_reminders(available_at, due_at) WHERE status IN ('pending','retry');
CREATE TABLE reminder_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES appointment_reminders(id) ON DELETE CASCADE,
  attempt INT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'sending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reminder_id, attempt)
);
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON appointment_reminders, reminder_attempts FROM anon, authenticated;

-- Only delivery-affecting appointment changes invalidate a reminder; notes do not.
ALTER TABLE appointments ADD COLUMN reminder_version TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE FUNCTION invalidate_appointment_reminders() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF ROW(NEW.start_at, NEW.end_at, NEW.staff_id, NEW.client_id, NEW.service_id)
       IS DISTINCT FROM ROW(OLD.start_at, OLD.end_at, OLD.staff_id, OLD.client_id, OLD.service_id)
     OR (OLD.status = 'cancelled' AND NEW.status <> 'cancelled') THEN
    NEW.reminder_version = clock_timestamp();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_reminder_version BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION invalidate_appointment_reminders();

CREATE FUNCTION claim_appointment_reminders(p_limit INT DEFAULT 10)
RETURNS SETOF appointment_reminders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- A crash after starting the HTTP request has an ambiguous outcome: never resend.
  UPDATE appointment_reminders SET status = 'unknown', last_error = 'Worker interrotto durante invio: verificare su Meta'
    WHERE status = 'sending' AND claimed_at < now() - interval '5 minutes';
  UPDATE appointment_reminders SET status = 'retry', claim_token = NULL
    WHERE status = 'claimed' AND claimed_at < now() - interval '5 minutes';
  UPDATE appointment_reminders r SET status = 'cancelled'
    WHERE r.status IN ('pending','retry','claimed') AND NOT EXISTS (
      SELECT 1 FROM appointments a JOIN whatsapp_connections w ON w.professional_id = a.staff_id AND w.tenant_id = a.tenant_id
      WHERE a.id = r.appointment_id AND a.reminder_version = r.appointment_version
        AND a.status IN ('scheduled','confirmed') AND a.start_at > now() AND w.reminder_enabled AND w.status = 'active'
    );
  INSERT INTO appointment_reminders(tenant_id, appointment_id, professional_id, appointment_version, due_at)
    SELECT a.tenant_id, a.id, a.staff_id, a.reminder_version, a.start_at - make_interval(mins => w.reminder_minutes)
    FROM appointments a JOIN whatsapp_connections w ON w.professional_id = a.staff_id AND w.tenant_id = a.tenant_id
    JOIN profiles p ON p.id = a.staff_id AND p.tenant_id = a.tenant_id AND p.active
    JOIN tenants t ON t.id = a.tenant_id AND t.status = 'active'
    JOIN clients c ON c.id = a.client_id AND c.tenant_id = a.tenant_id AND c.active AND c.whatsapp_reminders_consent
    WHERE a.status IN ('scheduled','confirmed') AND a.start_at > now()
      AND a.start_at - make_interval(mins => w.reminder_minutes) <= now()
      AND w.reminder_enabled AND w.status = 'active'
    ON CONFLICT DO NOTHING;
  RETURN QUERY
    WITH candidates AS (
      SELECT r.id FROM appointment_reminders r
      JOIN appointments a ON a.id = r.appointment_id
      JOIN whatsapp_connections w ON w.professional_id = a.staff_id AND w.tenant_id = a.tenant_id
      WHERE r.status IN ('pending','retry') AND r.available_at <= now()
        AND a.start_at - make_interval(mins => w.reminder_minutes) <= now()
        AND a.start_at > now() AND a.reminder_version = r.appointment_version
      ORDER BY r.due_at FOR UPDATE OF r SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,1),50)
    ) UPDATE appointment_reminders r SET status = 'claimed', claimed_at = now(), claim_token = gen_random_uuid()
      FROM candidates c WHERE r.id = c.id RETURNING r.*;
END $$;

CREATE FUNCTION begin_reminder_send(p_id UUID, p_claim UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r appointment_reminders; a appointments; w whatsapp_connections; c clients; p profiles; t tenants; s TEXT;
BEGIN
  SELECT * INTO r FROM appointment_reminders WHERE id = p_id AND status = 'claimed' AND claim_token = p_claim FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO a FROM appointments WHERE id = r.appointment_id FOR SHARE;
  SELECT * INTO w FROM whatsapp_connections WHERE professional_id = a.staff_id AND tenant_id = a.tenant_id FOR SHARE;
  SELECT * INTO c FROM clients WHERE id = a.client_id AND tenant_id = a.tenant_id FOR SHARE;
  SELECT * INTO p FROM profiles WHERE id = a.staff_id AND tenant_id = a.tenant_id;
  SELECT * INTO t FROM tenants WHERE id = a.tenant_id;
  IF a.reminder_version IS DISTINCT FROM r.appointment_version OR a.status NOT IN ('scheduled','confirmed')
    OR a.start_at <= now() OR w.id IS NULL OR NOT w.reminder_enabled OR w.status <> 'active'
    OR c.id IS NULL OR NOT c.active OR NOT c.whatsapp_reminders_consent OR NOT p.active OR t.status <> 'active' THEN
    UPDATE appointment_reminders SET status = 'cancelled' WHERE id = r.id;
    RETURN NULL;
  END IF;
  IF a.start_at - make_interval(mins => w.reminder_minutes) > now() THEN
    UPDATE appointment_reminders SET status = 'pending' WHERE id = r.id;
    RETURN NULL;
  END IF;
  UPDATE appointment_reminders SET status = 'sending', attempts = attempts + 1, claimed_at = now() WHERE id = r.id;
  INSERT INTO reminder_attempts(reminder_id, attempt) VALUES(r.id, r.attempts + 1);
  SELECT name INTO s FROM services WHERE id = a.service_id AND tenant_id = a.tenant_id;
  RETURN jsonb_build_object('reminder', to_jsonb(r), 'appointment', to_jsonb(a), 'connection', to_jsonb(w),
    'client', jsonb_build_object('full_name',c.full_name,'phone',c.phone), 'professional',p.full_name, 'service',s);
END $$;
REVOKE ALL ON FUNCTION claim_appointment_reminders(INT), begin_reminder_send(UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_appointment_reminders(INT), begin_reminder_send(UUID,UUID) TO service_role;

CREATE TABLE training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL UNIQUE,
  professional_id UUID NOT NULL,
  title TEXT NOT NULL,
  exercises JSONB NOT NULL CHECK (jsonb_typeof(exercises) = 'array'),
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (client_id, tenant_id) REFERENCES clients(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (professional_id, tenant_id) REFERENCES profiles(id, tenant_id)
);
CREATE TABLE training_access (
  client_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  FOREIGN KEY (client_id, tenant_id) REFERENCES clients(id, tenant_id) ON DELETE CASCADE
);
CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  plan_snapshot JSONB NOT NULL,
  entries JSONB NOT NULL DEFAULT '[]',
  version INT NOT NULL DEFAULT 1,
  last_mutation UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  FOREIGN KEY (client_id, tenant_id) REFERENCES clients(id, tenant_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX training_one_open_session ON training_sessions(client_id) WHERE completed_at IS NULL;
CREATE INDEX training_history ON training_sessions(client_id, started_at DESC);
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON training_plans, training_access, training_sessions FROM anon, authenticated;

CREATE FUNCTION training_session_write(p_hash TEXT, p_action TEXT, p_id UUID DEFAULT NULL,
  p_version INT DEFAULT NULL, p_entries JSONB DEFAULT NULL, p_mutation UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE access training_access; session training_sessions; plan training_plans;
BEGIN
  SELECT x.* INTO access FROM training_access x JOIN clients c ON c.id = x.client_id AND c.tenant_id = x.tenant_id
    JOIN tenants t ON t.id = x.tenant_id
    WHERE token_hash = p_hash AND revoked_at IS NULL AND expires_at > now() AND c.active AND t.status = 'active'
    FOR UPDATE OF x;
  IF NOT FOUND THEN RAISE EXCEPTION 'access_denied'; END IF;
  IF p_action = 'start' THEN
    SELECT * INTO session FROM training_sessions WHERE client_id = access.client_id AND completed_at IS NULL;
    IF FOUND THEN RETURN to_jsonb(session); END IF;
    SELECT * INTO plan FROM training_plans WHERE client_id = access.client_id AND tenant_id = access.tenant_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'plan_missing'; END IF;
    INSERT INTO training_sessions(tenant_id,client_id,plan_snapshot)
      VALUES(access.tenant_id,access.client_id,to_jsonb(plan)) RETURNING * INTO session;
  ELSE
    SELECT * INTO session FROM training_sessions WHERE id = p_id AND client_id = access.client_id AND tenant_id = access.tenant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'session_missing'; END IF;
    IF session.last_mutation = p_mutation THEN RETURN to_jsonb(session); END IF;
    IF session.completed_at IS NOT NULL OR session.version <> p_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
    IF p_action NOT IN ('save','complete') OR p_mutation IS NULL OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'invalid_entries';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_entries) e WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(session.plan_snapshot->'exercises') x WHERE x->>'id' = e->>'exerciseId'
    )) THEN RAISE EXCEPTION 'invalid_exercise'; END IF;
    UPDATE training_sessions SET entries = p_entries, version = version + 1, last_mutation = p_mutation,
      completed_at = CASE WHEN p_action = 'complete' THEN now() ELSE NULL END WHERE id = session.id RETURNING * INTO session;
  END IF;
  RETURN to_jsonb(session);
END $$;
REVOKE ALL ON FUNCTION training_session_write(TEXT,TEXT,UUID,INT,JSONB,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION training_session_write(TEXT,TEXT,UUID,INT,JSONB,UUID) TO service_role;

-- Prevent privilege escalation through the pre-existing self-profile update policy.
CREATE FUNCTION protect_profile_authority() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND
    ROW(NEW.role,NEW.tenant_id,NEW.active) IS DISTINCT FROM ROW(OLD.role,OLD.tenant_id,OLD.active) THEN
    RAISE EXCEPTION 'Profile authority can only be changed by the server';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_profile_authority BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_authority();
