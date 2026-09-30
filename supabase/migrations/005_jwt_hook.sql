-- ============================================================
-- FitnessFlow — Migration 005: JWT Custom Claims Hook
-- ============================================================
-- Questo hook viene chiamato da Supabase Auth ad ogni generazione
-- di JWT per iniettare tenant_id, user_role e profession nel token.
-- Va registrato in: Supabase Dashboard → Auth → Hooks → Custom JWT Claims
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_jwt_claims(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_profile     RECORD;
  v_tenant      RECORD;
  v_claims      JSONB;
BEGIN
  v_user_id := (event ->> 'user_id')::UUID;

  -- Recupera profilo utente
  SELECT
    p.tenant_id,
    p.role,
    p.active
  INTO v_profile
  FROM profiles p
  WHERE p.id = v_user_id;

  -- Se non ha profilo (utente appena creato), restituisce claims vuoti
  IF NOT FOUND THEN
    RETURN event;
  END IF;

  -- Se utente non è attivo, blocca il token
  IF NOT v_profile.active THEN
    RAISE EXCEPTION 'Utente disattivato';
  END IF;

  -- Se è SUPER_ADMIN non ha tenant
  IF v_profile.role = 'SUPER_ADMIN' THEN
    v_claims := jsonb_build_object(
      'user_role',  v_profile.role::TEXT,
      'tenant_id',  NULL,
      'profession', NULL
    );
    RETURN jsonb_set(event, '{claims}', (event -> 'claims') || v_claims);
  END IF;

  -- Per tutti gli altri ruoli, recupera il tenant
  IF v_profile.tenant_id IS NOT NULL THEN
    SELECT
      t.profession,
      t.status,
      t.plan
    INTO v_tenant
    FROM tenants t
    WHERE t.id = v_profile.tenant_id;

    -- Se il tenant è sospeso/cancellato, blocca
    IF v_tenant.status IN ('suspended', 'cancelled') THEN
      RAISE EXCEPTION 'Tenant non attivo: %', v_tenant.status;
    END IF;

    v_claims := jsonb_build_object(
      'user_role',  v_profile.role::TEXT,
      'tenant_id',  v_profile.tenant_id::TEXT,
      'profession', v_tenant.profession::TEXT,
      'plan',       v_tenant.plan::TEXT
    );
  ELSE
    -- Profilo senza tenant (es. durante onboarding)
    v_claims := jsonb_build_object(
      'user_role',  v_profile.role::TEXT,
      'tenant_id',  NULL,
      'profession', NULL
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', (event -> 'claims') || v_claims);
END;
$$;

-- Grant di esecuzione per Supabase Auth
GRANT EXECUTE ON FUNCTION public.custom_jwt_claims(JSONB) TO supabase_auth_admin;

-- ============================================================
-- NOTA DI CONFIGURAZIONE
-- ============================================================
-- Dopo aver applicato questa migration, vai in:
-- Supabase Dashboard → Authentication → Hooks
-- Aggiungi un hook "Custom Access Token":
--   Schema: public
--   Function: custom_jwt_claims
-- ============================================================
