-- ============================================================
-- FitnessFlow — Migration 023: trial, quote AI e billing
-- ============================================================

-- Il trial applicativo dura 30 giorni e parte con massimo 10 clienti.
ALTER TABLE tenants
  ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '30 days'),
  ALTER COLUMN max_clients SET DEFAULT 10;

UPDATE tenants
SET max_clients = 10
WHERE plan = 'trial';

-- Estende a 30 giorni solo i trial che usavano ancora il vecchio default
-- (o non avevano una scadenza), senza sovrascrivere proroghe manuali.
UPDATE tenants
SET trial_ends_at = created_at + INTERVAL '30 days'
WHERE plan = 'trial'
  AND (
    trial_ends_at IS NULL
    OR trial_ends_at <= created_at + INTERVAL '15 days'
  );

-- Prenota atomicamente una generazione AI. L'advisory lock impedisce che
-- richieste concorrenti superino la quota mensile dello stesso tenant.
CREATE OR REPLACE FUNCTION reserve_ai_usage(
  p_tenant_id UUID,
  p_user_id UUID,
  p_feature TEXT,
  p_model TEXT,
  p_monthly_limit INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM');
  v_period_start TIMESTAMPTZ := date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_usage_count INT;
  v_usage_id UUID;
BEGIN
  IF p_monthly_limit < 1 OR p_monthly_limit > 100000 THEN
    RAISE EXCEPTION 'Invalid AI monthly limit';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = p_user_id
      AND tenant_id = p_tenant_id
      AND active = TRUE
  ) THEN
    RAISE EXCEPTION 'User does not belong to tenant';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::TEXT), hashtext(v_period));

  SELECT COUNT(*)
  INTO v_usage_count
  FROM ai_usage_logs
  WHERE tenant_id = p_tenant_id
    AND created_at >= v_period_start;

  IF v_usage_count >= p_monthly_limit THEN
    RETURN NULL;
  END IF;

  INSERT INTO ai_usage_logs (
    tenant_id,
    user_id,
    feature,
    model,
    prompt_tokens,
    completion_tokens
  )
  VALUES (
    p_tenant_id,
    p_user_id,
    p_feature,
    p_model,
    0,
    0
  )
  RETURNING id INTO v_usage_id;

  RETURN v_usage_id;
END;
$$;

REVOKE ALL ON FUNCTION reserve_ai_usage(UUID, UUID, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION reserve_ai_usage(UUID, UUID, TEXT, TEXT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION reserve_ai_usage(UUID, UUID, TEXT, TEXT, INT) TO service_role;

-- Il limite clienti è applicato anche nel database, così due richieste
-- concorrenti o una scrittura fuori dall'interfaccia non possono superarlo.
CREATE OR REPLACE FUNCTION enforce_tenant_client_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_max_clients INT;
  v_plan tenant_plan;
  v_status tenant_status;
  v_trial_ends_at TIMESTAMPTZ;
  v_active_clients INT;
BEGIN
  IF NEW.active IS NOT TRUE OR (TG_OP = 'UPDATE' AND OLD.active IS TRUE) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.tenant_id::TEXT), 1);

  SELECT max_clients, plan, status, trial_ends_at
  INTO v_max_clients, v_plan, v_status, v_trial_ends_at
  FROM tenants
  WHERE id = NEW.tenant_id;

  IF v_status <> 'active' OR (v_plan = 'trial' AND (v_trial_ends_at IS NULL OR v_trial_ends_at <= NOW())) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Subscription is not active';
  END IF;

  SELECT COUNT(*)
  INTO v_active_clients
  FROM clients
  WHERE tenant_id = NEW.tenant_id
    AND active = TRUE
    AND id IS DISTINCT FROM NEW.id;

  IF v_active_clients >= v_max_clients THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Client limit reached';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_tenant_client_limit
  BEFORE INSERT OR UPDATE OF active, tenant_id ON clients
  FOR EACH ROW EXECUTE FUNCTION enforce_tenant_client_limit();
