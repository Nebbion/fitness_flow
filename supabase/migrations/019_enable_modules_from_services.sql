-- Existing service catalogues can activate the relevant professional module.
UPDATE tenants t
SET enabled_modules = ARRAY(
  SELECT DISTINCT module
  FROM unnest(
    t.enabled_modules || CASE
      WHEN EXISTS (
        SELECT 1 FROM services s
        WHERE s.tenant_id = t.id AND s.active
          AND lower(s.name) ~ '(allenamento|workout|palestra)'
      ) THEN ARRAY['training']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END || CASE
      WHEN EXISTS (
        SELECT 1 FROM services s
        WHERE s.tenant_id = t.id AND s.active
          AND lower(s.name) ~ '(alimentazione|alimentare|nutrizione|nutrizionale)'
      ) THEN ARRAY['nutrition']::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END
  ) AS module
);
