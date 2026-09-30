-- Le informazioni del tenant vengono assegnate al profilo durante l'onboarding.
-- Non sono disponibili nel JWT fino al successivo refresh della sessione.
-- Le policy RLS devono quindi leggere il profilo dell'utente autenticato.

CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;
