-- ============================================================
-- FitnessFlow — Migration 004: Storage Buckets + Seed
-- ============================================================

-- ─── STORAGE BUCKETS ─────────────────────────────────────────

-- Bucket principale documenti clienti (privato)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  FALSE,
  52428800, -- 50MB max per file
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket avatar e loghi tenant (pubblico)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  5242880, -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── RLS STORAGE: client-documents ───────────────────────────

-- Staff del tenant può leggere i documenti del proprio tenant
-- Path struttura: {tenant_id}/{client_id}/{filename}
CREATE POLICY "tenant_staff_read_docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth_tenant_id()::TEXT
    AND is_staff_or_above()
  );

-- Il cliente può leggere solo i propri documenti
CREATE POLICY "client_read_own_docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[2] IN (
      SELECT id::TEXT FROM clients WHERE profile_id = auth.uid()
    )
  );

-- Staff può caricare documenti nel tenant
CREATE POLICY "tenant_staff_upload_docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth_tenant_id()::TEXT
    AND is_staff_or_above()
  );

-- Cliente può caricare i propri file
CREATE POLICY "client_upload_own_docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[2] IN (
      SELECT id::TEXT FROM clients WHERE profile_id = auth.uid()
    )
  );

-- Solo tenant admin può eliminare
CREATE POLICY "tenant_admin_delete_docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth_tenant_id()::TEXT
    AND is_tenant_admin()
  );

-- ─── RLS STORAGE: avatars ─────────────────────────────────────

-- Tutti possono leggere gli avatar (bucket pubblico)
CREATE POLICY "public_read_avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Ogni utente carica solo il proprio avatar
CREATE POLICY "own_avatar_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "own_avatar_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ============================================================
-- SEED: Regole notifiche default (applicate a ogni nuovo tenant)
-- ============================================================
-- Nota: questo viene inserito via funzione trigger su INSERT IN tenants

CREATE OR REPLACE FUNCTION create_default_notification_rules()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_rules (tenant_id, event_trigger, channel, delay_minutes, template_key, active)
  VALUES
    -- Conferma appuntamento (subito)
    (NEW.id, 'appointment_created',    'whatsapp', 0,     'appt_confirmation',  TRUE),
    (NEW.id, 'appointment_created',    'email',    0,     'appt_confirmation',  TRUE),
    -- Reminder 24h prima (delay negativo = minuti prima dell'evento)
    (NEW.id, 'appointment_reminder',   'whatsapp', -1440, 'appt_reminder_24h',  TRUE),
    (NEW.id, 'appointment_reminder',   'email',    -1440, 'appt_reminder_24h',  TRUE),
    -- Reminder 2h prima
    (NEW.id, 'appointment_reminder',   'whatsapp', -120,  'appt_reminder_2h',   TRUE),
    -- Follow-up 3 giorni dopo
    (NEW.id, 'appointment_completed',  'whatsapp', 4320,  'appt_followup',      TRUE),
    -- Cliente inattivo 30 giorni
    (NEW.id, 'client_inactive',        'whatsapp', 0,     'client_reengagement',TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_new_tenant_notification_rules
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION create_default_notification_rules();

-- ============================================================
-- SEED: Onboarding step record per ogni nuovo tenant
-- ============================================================
CREATE OR REPLACE FUNCTION create_onboarding_record()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO onboarding_steps (tenant_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_new_tenant_onboarding
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION create_onboarding_record();

-- ============================================================
-- SEED: Servizi predefiniti per professione
-- Nota: chiamato dall'API dopo la creazione del tenant
-- ============================================================
CREATE OR REPLACE FUNCTION seed_default_services(p_tenant_id UUID, p_profession profession_type)
RETURNS VOID AS $$
BEGIN
  CASE p_profession
    WHEN 'nutritionist' THEN
      INSERT INTO services (tenant_id, name, description, duration_min, price, currency)
      VALUES
        (p_tenant_id, 'Prima Visita',          'Consulenza nutrizionale iniziale con anamnesi completa', 60, 80.00, 'EUR'),
        (p_tenant_id, 'Visita di Controllo',   'Follow-up e aggiornamento piano alimentare',             45, 50.00, 'EUR'),
        (p_tenant_id, 'Piano Alimentare',      'Elaborazione piano alimentare personalizzato',            0,  60.00, 'EUR');

    WHEN 'personal_trainer' THEN
      INSERT INTO services (tenant_id, name, description, duration_min, price, currency)
      VALUES
        (p_tenant_id, 'Valutazione Iniziale',  'Assessment posturale e test fitness',                    60, 60.00, 'EUR'),
        (p_tenant_id, 'Allenamento Personale', 'Sessione di personal training',                          60, 50.00, 'EUR'),
        (p_tenant_id, 'Scheda Allenamento',    'Elaborazione programma di allenamento',                  0,  40.00, 'EUR');

    WHEN 'physiotherapist' THEN
      INSERT INTO services (tenant_id, name, description, duration_min, price, currency)
      VALUES
        (p_tenant_id, 'Prima Valutazione',     'Valutazione fisioterapica completa',                     60, 70.00, 'EUR'),
        (p_tenant_id, 'Seduta Fisioterapia',   'Trattamento fisioterapico',                              45, 55.00, 'EUR'),
        (p_tenant_id, 'Rieducazione Motoria',  'Sessione di rieducazione funzionale',                    60, 60.00, 'EUR');

    WHEN 'osteopath' THEN
      INSERT INTO services (tenant_id, name, description, duration_min, price, currency)
      VALUES
        (p_tenant_id, 'Prima Seduta',          'Anamnesi e trattamento osteopatico iniziale',            75, 80.00, 'EUR'),
        (p_tenant_id, 'Seduta Osteopatica',    'Trattamento osteopatico',                                60, 65.00, 'EUR');

    WHEN 'massage_therapist' THEN
      INSERT INTO services (tenant_id, name, description, duration_min, price, currency)
      VALUES
        (p_tenant_id, 'Massaggio Rilassante',  'Massaggio decontratturante rilassante',                  60, 55.00, 'EUR'),
        (p_tenant_id, 'Massaggio Sportivo',    'Massaggio specifico per sportivi',                       60, 60.00, 'EUR'),
        (p_tenant_id, 'Massaggio Decontratturante', 'Trattamento muscolare profondo',                    45, 50.00, 'EUR');

    ELSE
      INSERT INTO services (tenant_id, name, description, duration_min, price, currency)
      VALUES
        (p_tenant_id, 'Consulenza',            'Consulenza professionale',                               60, 60.00, 'EUR'),
        (p_tenant_id, 'Sessione',              'Sessione standard',                                      60, 50.00, 'EUR');
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SEED: Campi custom predefiniti per professione
-- ============================================================
CREATE OR REPLACE FUNCTION seed_default_custom_fields(p_tenant_id UUID, p_profession profession_type)
RETURNS VOID AS $$
BEGIN
  -- Campi comuni a tutte le professioni
  INSERT INTO custom_field_definitions (tenant_id, entity_type, field_key, label_it, label_en, field_type, sort_order)
  VALUES
    (p_tenant_id, 'client', 'weight_kg',    'Peso (kg)',    'Weight (kg)',   'number', 1),
    (p_tenant_id, 'client', 'height_cm',    'Altezza (cm)', 'Height (cm)',   'number', 2),
    (p_tenant_id, 'client', 'occupation',   'Professione',  'Occupation',    'text',   3);

  -- Campi specifici per professione
  CASE p_profession
    WHEN 'nutritionist' THEN
      INSERT INTO custom_field_definitions (tenant_id, entity_type, field_key, label_it, label_en, field_type, sort_order)
      VALUES
        (p_tenant_id, 'client', 'body_fat_pct',    'Massa Grassa (%)',      'Body Fat (%)',         'number',   4),
        (p_tenant_id, 'client', 'allergies',        'Allergie Alimentari',   'Food Allergies',       'textarea', 5),
        (p_tenant_id, 'client', 'diet_type',        'Tipo Dieta',            'Diet Type',
         'select', 6);

    WHEN 'personal_trainer' THEN
      INSERT INTO custom_field_definitions (tenant_id, entity_type, field_key, label_it, label_en, field_type, sort_order)
      VALUES
        (p_tenant_id, 'client', 'fitness_level',   'Livello Fitness',       'Fitness Level',        'select',   4),
        (p_tenant_id, 'client', 'bench_press_max', 'Panca Piana Max (kg)',  'Bench Press Max (kg)', 'number',   5),
        (p_tenant_id, 'client', 'squat_max',       'Squat Max (kg)',        'Squat Max (kg)',       'number',   6),
        (p_tenant_id, 'client', 'training_goal',   'Obiettivo',             'Training Goal',        'select',   7);

    WHEN 'physiotherapist' THEN
      INSERT INTO custom_field_definitions (tenant_id, entity_type, field_key, label_it, label_en, field_type, sort_order)
      VALUES
        (p_tenant_id, 'client', 'pain_score',      'Livello Dolore (0-10)', 'Pain Score (0-10)',    'number',   4),
        (p_tenant_id, 'client', 'pathology',       'Patologia Principale',  'Main Pathology',       'text',     5),
        (p_tenant_id, 'client', 'surgery_history', 'Interventi Chirurgici', 'Surgery History',      'textarea', 6);

    ELSE NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
