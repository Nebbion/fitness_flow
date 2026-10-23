-- Professional category suggests defaults, while modules remain opt-in and editable.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] NOT NULL DEFAULT '{}';

UPDATE tenants
SET enabled_modules = CASE profession
  WHEN 'personal_trainer' THEN ARRAY['training']
  WHEN 'nutritionist' THEN ARRAY['nutrition']
  ELSE ARRAY[]::TEXT[]
END
WHERE cardinality(enabled_modules) = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tenants'::regclass
      AND conname = 'tenants_enabled_modules_valid'
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_enabled_modules_valid
      CHECK (enabled_modules <@ ARRAY['training', 'nutrition']::TEXT[]);
  END IF;
END
$$;
