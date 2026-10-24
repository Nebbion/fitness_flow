-- ============================================================
-- FitnessFlow — Migration 024: import nutrizione e Idee Pasti
-- ============================================================

CREATE TABLE meal_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  category TEXT NOT NULL DEFAULT '' CHECK (char_length(category) <= 80),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 3000),
  ingredients TEXT NOT NULL DEFAULT '' CHECK (char_length(ingredients) <= 5000),
  instructions TEXT NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 5000),
  source_url TEXT CHECK (source_url IS NULL OR char_length(source_url) <= 1000),
  images JSONB NOT NULL DEFAULT '[]'
    CHECK (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) <= 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (professional_id, tenant_id)
    REFERENCES profiles(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX meal_ideas_owner
  ON meal_ideas(tenant_id, professional_id, lower(title));

ALTER TABLE meal_ideas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON meal_ideas FROM anon, authenticated;
GRANT ALL ON meal_ideas TO service_role;

CREATE TRIGGER trg_meal_ideas_updated_at
  BEFORE UPDATE ON meal_ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION meal_idea_append_image(
  p_id UUID,
  p_tenant UUID,
  p_professional UUID,
  p_image JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  idea meal_ideas;
BEGIN
  SELECT * INTO idea
  FROM meal_ideas
  WHERE id = p_id
    AND tenant_id = p_tenant
    AND professional_id = p_professional
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'meal_idea_missing'; END IF;
  IF jsonb_array_length(idea.images) >= 6 THEN RAISE EXCEPTION 'image_limit'; END IF;
  IF jsonb_typeof(p_image) <> 'object' OR COALESCE(p_image->>'path', '') = '' THEN
    RAISE EXCEPTION 'invalid_image';
  END IF;

  UPDATE meal_ideas
  SET images = images || jsonb_build_array(p_image), updated_at = now()
  WHERE id = p_id
  RETURNING * INTO idea;

  RETURN to_jsonb(idea);
END;
$$;

REVOKE ALL ON FUNCTION meal_idea_append_image(UUID, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION meal_idea_append_image(UUID, UUID, UUID, JSONB) TO service_role;

-- Media persistenti delle idee pasto. Le letture passano da URL firmati creati
-- da route server autorizzate.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meal-idea-media',
  'meal-idea-media',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- File sorgente temporanei per l'importazione AI del piano alimentare.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'nutrition-imports',
  'nutrition-imports',
  FALSE,
  12582912,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Nessuna policy anon/authenticated: caricamenti, letture e firme sono mediati
-- dalle route server dopo il controllo tenant/professionista.
