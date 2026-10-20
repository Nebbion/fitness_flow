-- A portal account can be linked to one client record for each professional.
-- Sharing is explicit, directional and read-only for the receiving tenant.
CREATE TABLE client_data_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  recipient_client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('training', 'nutrition')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (owner_client_id <> recipient_client_id),
  UNIQUE(owner_client_id, recipient_client_id, scope)
);
CREATE INDEX client_data_shares_recipient ON client_data_shares(recipient_client_id, scope);
ALTER TABLE client_data_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON client_data_shares FROM anon, authenticated;
GRANT ALL ON client_data_shares TO service_role;

CREATE TRIGGER trg_client_data_shares_updated_at
  BEFORE UPDATE ON client_data_shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Multi-professional version of the portal session writer. It confirms that
-- the selected client record belongs to the authenticated portal account.
CREATE FUNCTION portal_training_session_write_for_client(
  p_user UUID, p_client UUID, p_action TEXT, p_id UUID DEFAULT NULL,
  p_version INT DEFAULT NULL, p_entries JSONB DEFAULT NULL,
  p_mutation UUID DEFAULT NULL, p_notes TEXT DEFAULT NULL,
  p_plan_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE customer clients; session training_sessions;
BEGIN
  SELECT c.* INTO customer FROM clients c
    JOIN profiles p ON p.id = c.profile_id
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.id = p_client AND c.profile_id = p_user AND p.role = 'CLIENT'
      AND p.active AND c.active AND t.status = 'active'
    FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'access_denied'; END IF;

  IF p_action = 'start' THEN
    RETURN start_client_training(customer.id, customer.tenant_id, p_plan_id);
  END IF;

  SELECT * INTO session FROM training_sessions
    WHERE id = p_id AND client_id = customer.id AND tenant_id = customer.tenant_id FOR UPDATE;
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
  RETURN to_jsonb(session);
END $$;
REVOKE ALL ON FUNCTION portal_training_session_write_for_client(UUID,UUID,TEXT,UUID,INT,JSONB,UUID,TEXT,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION portal_training_session_write_for_client(UUID,UUID,TEXT,UUID,INT,JSONB,UUID,TEXT,UUID) TO service_role;
