ALTER TABLE training_sessions ADD COLUMN weight_history JSONB NOT NULL DEFAULT '[]';
ALTER TABLE training_exercise_library ADD COLUMN default_weight_kg NUMERIC
  CHECK (default_weight_kg BETWEEN 0 AND 2000);

-- Capture changes in the same transaction as the version-checked session save.
CREATE FUNCTION capture_training_weights() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE exercise JSONB; series JSONB; previous JSONB; position INT;
BEGIN
  NEW.weight_history := OLD.weight_history;
  FOR exercise IN SELECT value FROM jsonb_array_elements(NEW.entries) LOOP
    position := 0;
    FOR series IN SELECT value FROM jsonb_array_elements(exercise->'sets') LOOP
      SELECT e->'sets'->position INTO previous FROM jsonb_array_elements(OLD.entries) e
        WHERE e->>'exerciseId' = exercise->>'exerciseId';
      IF series->'weightKg' IS DISTINCT FROM previous->'weightKg'
        AND (series->>'weightKg' IS NOT NULL OR previous->>'weightKg' IS NOT NULL) THEN
        NEW.weight_history := NEW.weight_history || jsonb_build_array(jsonb_build_object(
          'exerciseId', exercise->>'exerciseId', 'setIndex', position,
          'previousKg', previous->'weightKg', 'weightKg', series->'weightKg',
          'recordedAt', now(), 'version', NEW.version));
      END IF;
      position := position + 1;
    END LOOP;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER training_weights BEFORE UPDATE OF entries ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION capture_training_weights();

-- Cookie-authenticated portal access; never creates or changes personal links.
CREATE FUNCTION portal_training_session_write(p_user UUID, p_action TEXT,
  p_id UUID DEFAULT NULL, p_version INT DEFAULT NULL, p_entries JSONB DEFAULT NULL,
  p_mutation UUID DEFAULT NULL, p_notes TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE customer clients; session training_sessions; plan training_plans;
BEGIN
  SELECT c.* INTO customer FROM clients c JOIN profiles p ON p.id = c.profile_id
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.profile_id = p_user AND p.role = 'CLIENT' AND p.active AND c.active
      AND p.tenant_id = c.tenant_id AND t.status = 'active'
    FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'access_denied'; END IF;
  IF p_action = 'start' THEN
    SELECT * INTO session FROM training_sessions WHERE client_id = customer.id
      AND tenant_id = customer.tenant_id AND completed_at IS NULL;
    IF FOUND THEN RETURN to_jsonb(session); END IF;
    SELECT * INTO plan FROM training_plans WHERE client_id = customer.id AND tenant_id = customer.tenant_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'plan_missing'; END IF;
    INSERT INTO training_sessions(tenant_id,client_id,plan_snapshot)
      VALUES(customer.tenant_id,customer.id,to_jsonb(plan))
      ON CONFLICT (client_id) WHERE completed_at IS NULL DO NOTHING RETURNING * INTO session;
    IF NOT FOUND THEN
      SELECT * INTO session FROM training_sessions WHERE client_id = customer.id AND completed_at IS NULL;
    END IF;
  ELSE
    SELECT * INTO session FROM training_sessions WHERE id = p_id AND client_id = customer.id
      AND tenant_id = customer.tenant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'access_denied'; END IF;
    IF session.last_mutation = p_mutation THEN RETURN to_jsonb(session); END IF;
    IF session.completed_at IS NOT NULL OR session.version <> p_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
    IF p_action NOT IN ('save','complete') OR p_mutation IS NULL
      OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR char_length(COALESCE(p_notes,'')) > 2000 THEN
      RAISE EXCEPTION 'invalid_entries';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_entries) e WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(session.plan_snapshot->'exercises') x WHERE x->>'id' = e->>'exerciseId'
    )) THEN RAISE EXCEPTION 'invalid_exercise'; END IF;
    UPDATE training_sessions SET entries = p_entries, notes = COALESCE(p_notes,''), version = version + 1,
      last_mutation = p_mutation, completed_at = CASE WHEN p_action = 'complete' THEN now() ELSE NULL END
      WHERE id = session.id RETURNING * INTO session;
  END IF;
  RETURN to_jsonb(session);
END $$;
REVOKE ALL ON FUNCTION portal_training_session_write(UUID,TEXT,UUID,INT,JSONB,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION portal_training_session_write(UUID,TEXT,UUID,INT,JSONB,UUID,TEXT) TO service_role;
