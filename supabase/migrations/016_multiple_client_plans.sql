ALTER TABLE training_plans DROP CONSTRAINT training_plans_client_id_key;
ALTER TABLE nutrition_plans DROP CONSTRAINT nutrition_plans_client_id_key;
CREATE INDEX training_plans_client ON training_plans(tenant_id, client_id, updated_at DESC);
CREATE INDEX nutrition_plans_client ON nutrition_plans(tenant_id, client_id, created_at DESC);
ALTER TABLE nutrition_plans
  ADD COLUMN starts_on DATE,
  ADD COLUMN ends_on DATE,
  ADD COLUMN initial_measurements JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN final_measurements JSONB NOT NULL DEFAULT '{}',
  ADD CONSTRAINT nutrition_period CHECK (ends_on IS NULL OR (starts_on IS NOT NULL AND ends_on >= starts_on));

-- Serialize starts from both access methods on the same client row.
CREATE FUNCTION start_client_training(p_client UUID, p_tenant UUID, p_plan UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s training_sessions; p training_plans;
BEGIN
  PERFORM 1 FROM clients WHERE id = p_client AND tenant_id = p_tenant AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'access_denied'; END IF;
  SELECT * INTO s FROM training_sessions WHERE client_id = p_client AND tenant_id = p_tenant AND completed_at IS NULL;
  IF FOUND THEN
    IF p_plan IS NOT NULL AND s.plan_snapshot->>'id' <> p_plan::TEXT THEN RAISE EXCEPTION 'open_session_exists'; END IF;
    RETURN to_jsonb(s);
  END IF;
  SELECT * INTO p FROM training_plans WHERE client_id = p_client AND tenant_id = p_tenant
    AND (p_plan IS NULL OR id = p_plan) ORDER BY updated_at DESC, id LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_missing'; END IF;
  INSERT INTO training_sessions(tenant_id, client_id, plan_snapshot)
    VALUES(p_tenant, p_client, to_jsonb(p)) RETURNING * INTO s;
  RETURN to_jsonb(s);
END $$;
REVOKE ALL ON FUNCTION start_client_training(UUID,UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION start_client_training(UUID,UUID,UUID) TO service_role;

ALTER FUNCTION training_session_write(TEXT,TEXT,UUID,INT,JSONB,UUID,TEXT) RENAME TO training_session_write_previous;
CREATE FUNCTION training_session_write(p_hash TEXT, p_action TEXT, p_id UUID DEFAULT NULL,
  p_version INT DEFAULT NULL, p_entries JSONB DEFAULT NULL, p_mutation UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL, p_plan_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a training_access;
BEGIN
  IF p_action <> 'start' THEN
    RETURN training_session_write_previous(p_hash,p_action,p_id,p_version,p_entries,p_mutation,p_notes);
  END IF;
  SELECT x.* INTO a FROM training_access x JOIN clients c ON c.id=x.client_id AND c.tenant_id=x.tenant_id
    JOIN tenants t ON t.id=x.tenant_id WHERE x.token_hash=p_hash AND x.revoked_at IS NULL
    AND x.expires_at > now() AND c.active AND t.status='active' FOR SHARE OF x;
  IF NOT FOUND THEN RAISE EXCEPTION 'access_denied'; END IF;
  RETURN start_client_training(a.client_id,a.tenant_id,p_plan_id);
END $$;
REVOKE ALL ON FUNCTION training_session_write(TEXT,TEXT,UUID,INT,JSONB,UUID,TEXT,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION training_session_write(TEXT,TEXT,UUID,INT,JSONB,UUID,TEXT,UUID) TO service_role;

ALTER FUNCTION portal_training_session_write(UUID,TEXT,UUID,INT,JSONB,UUID,TEXT) RENAME TO portal_training_session_write_previous;
CREATE FUNCTION portal_training_session_write(p_user UUID, p_action TEXT, p_id UUID DEFAULT NULL,
  p_version INT DEFAULT NULL, p_entries JSONB DEFAULT NULL, p_mutation UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL, p_plan_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c clients;
BEGIN
  IF p_action <> 'start' THEN
    RETURN portal_training_session_write_previous(p_user,p_action,p_id,p_version,p_entries,p_mutation,p_notes);
  END IF;
  SELECT x.* INTO c FROM clients x JOIN profiles p ON p.id=x.profile_id AND p.tenant_id=x.tenant_id
    JOIN tenants t ON t.id=x.tenant_id WHERE p.id=p_user AND p.role='CLIENT' AND p.active AND x.active AND t.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'access_denied'; END IF;
  RETURN start_client_training(c.id,c.tenant_id,p_plan_id);
END $$;
REVOKE ALL ON FUNCTION portal_training_session_write(UUID,TEXT,UUID,INT,JSONB,UUID,TEXT,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION portal_training_session_write(UUID,TEXT,UUID,INT,JSONB,UUID,TEXT,UUID) TO service_role;
