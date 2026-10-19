ALTER TABLE training_exercise_library
  ADD COLUMN default_isometry_seconds INTEGER
  CHECK (default_isometry_seconds BETWEEN 1 AND 3600);
