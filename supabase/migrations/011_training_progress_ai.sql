-- Progress dashboard, session notes and server-only AI cache.
ALTER TABLE training_sessions
  ADD COLUMN notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000);

DROP FUNCTION IF EXISTS training_session_write(TEXT,TEXT,UUID,INT,JSONB,UUID);
CREATE FUNCTION training_session_write(
  p_hash TEXT,
  p_action TEXT,
  p_id UUID DEFAULT NULL,
  p_version INT DEFAULT NULL,
  p_entries JSONB DEFAULT NULL,
  p_mutation UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE access training_access; session training_sessions; plan training_plans;
BEGIN
  SELECT x.* INTO access FROM training_access x
    JOIN clients c ON c.id = x.client_id AND c.tenant_id = x.tenant_id
    JOIN tenants t ON t.id = x.tenant_id
    WHERE token_hash = p_hash AND revoked_at IS NULL AND expires_at > now()
      AND c.active AND t.status = 'active'
    FOR UPDATE OF x;
  IF NOT FOUND THEN RAISE EXCEPTION 'access_denied'; END IF;

  IF p_action = 'start' THEN
    SELECT * INTO session FROM training_sessions
      WHERE client_id = access.client_id AND tenant_id = access.tenant_id AND completed_at IS NULL;
    IF FOUND THEN RETURN to_jsonb(session); END IF;
    SELECT * INTO plan FROM training_plans
      WHERE client_id = access.client_id AND tenant_id = access.tenant_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'plan_missing'; END IF;
    INSERT INTO training_sessions(tenant_id,client_id,plan_snapshot)
      VALUES(access.tenant_id,access.client_id,to_jsonb(plan)) RETURNING * INTO session;
  ELSE
    SELECT * INTO session FROM training_sessions
      WHERE id = p_id AND client_id = access.client_id AND tenant_id = access.tenant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'session_missing'; END IF;
    IF session.last_mutation = p_mutation THEN RETURN to_jsonb(session); END IF;
    IF session.completed_at IS NOT NULL OR session.version <> p_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
    IF p_action NOT IN ('save','complete') OR p_mutation IS NULL
      OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR char_length(COALESCE(p_notes,'')) > 2000 THEN
      RAISE EXCEPTION 'invalid_entries';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_entries) e WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(session.plan_snapshot->'exercises') x
        WHERE x->>'id' = e->>'exerciseId'
    )) THEN RAISE EXCEPTION 'invalid_exercise'; END IF;
    UPDATE training_sessions SET entries = p_entries, notes = COALESCE(p_notes,''),
      version = version + 1, last_mutation = p_mutation,
      completed_at = CASE WHEN p_action = 'complete' THEN now() ELSE NULL END
      WHERE id = session.id RETURNING * INTO session;
  END IF;
  RETURN to_jsonb(session);
END $$;
REVOKE ALL ON FUNCTION training_session_write(TEXT,TEXT,UUID,INT,JSONB,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION training_session_write(TEXT,TEXT,UUID,INT,JSONB,UUID,TEXT) TO service_role;

CREATE TABLE training_progress_ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  range_months INT NOT NULL CHECK (range_months IN (1,3,6,12,24)),
  source_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  statistics JSONB NOT NULL,
  analysis TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  FOREIGN KEY (client_id, tenant_id) REFERENCES clients(id, tenant_id) ON DELETE CASCADE,
  UNIQUE (client_id, range_months, source_hash, provider, model)
);
CREATE INDEX training_progress_ai_rate
  ON training_progress_ai_cache(client_id, created_at DESC);
ALTER TABLE training_progress_ai_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON training_progress_ai_cache FROM anon, authenticated;
