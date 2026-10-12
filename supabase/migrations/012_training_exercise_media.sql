-- Professional exercise library and private media.
CREATE TABLE training_exercise_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  default_sets INT NOT NULL DEFAULT 3 CHECK (default_sets BETWEEN 1 AND 20),
  default_reps TEXT NOT NULL DEFAULT '8-12' CHECK (char_length(default_reps) BETWEEN 1 AND 30),
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
  images JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) <= 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (professional_id, tenant_id) REFERENCES profiles(id, tenant_id) ON DELETE CASCADE
);
CREATE INDEX training_exercise_library_owner
  ON training_exercise_library(tenant_id, professional_id, lower(name));
ALTER TABLE training_exercise_library ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON training_exercise_library FROM anon, authenticated;

CREATE FUNCTION training_exercise_append_image(
  p_id UUID,
  p_tenant UUID,
  p_professional UUID,
  p_image JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE exercise training_exercise_library;
BEGIN
  SELECT * INTO exercise FROM training_exercise_library
    WHERE id = p_id AND tenant_id = p_tenant AND professional_id = p_professional
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'exercise_missing'; END IF;
  IF jsonb_array_length(exercise.images) >= 6 THEN RAISE EXCEPTION 'image_limit'; END IF;
  IF jsonb_typeof(p_image) <> 'object' OR COALESCE(p_image->>'path', '') = '' THEN
    RAISE EXCEPTION 'invalid_image';
  END IF;
  UPDATE training_exercise_library
    SET images = images || jsonb_build_array(p_image), updated_at = now()
    WHERE id = p_id RETURNING * INTO exercise;
  RETURN to_jsonb(exercise);
END $$;
REVOKE ALL ON FUNCTION training_exercise_append_image(UUID,UUID,UUID,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION training_exercise_append_image(UUID,UUID,UUID,JSONB) TO service_role;

-- Private exercise media. Access is granted only through authorized server routes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-media',
  'exercise-media',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No anon/authenticated storage policies: service_role signs reads after app authorization.
