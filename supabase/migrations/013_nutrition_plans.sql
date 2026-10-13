-- Structured nutrition plans for nutritionist tenants.
CREATE TABLE nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL UNIQUE,
  professional_id UUID NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  guidelines TEXT NOT NULL DEFAULT '',
  target_calories INT CHECK (target_calories IS NULL OR target_calories BETWEEN 0 AND 10000),
  days JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(days) = 'array'),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (client_id, tenant_id) REFERENCES clients(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (professional_id, tenant_id) REFERENCES profiles(id, tenant_id)
);

CREATE INDEX nutrition_plans_tenant_updated
  ON nutrition_plans(tenant_id, updated_at DESC);

ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nutrition_plans FROM anon, authenticated;
GRANT ALL ON nutrition_plans TO service_role;
