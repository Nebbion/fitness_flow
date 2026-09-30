-- ============================================================
-- FitnessFlow — Migration 001: Core Schema
-- ============================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- per full-text search sui clienti
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- UUID nei vincoli di esclusione GiST

-- ─── ENUM TYPES ─────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF', 'CLIENT');
CREATE TYPE tenant_plan AS ENUM ('trial', 'starter', 'professional', 'business');
CREATE TYPE tenant_status AS ENUM ('active', 'inactive', 'suspended', 'cancelled');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE document_type AS ENUM ('nutrition_plan', 'workout_plan', 'report', 'medical', 'image', 'other');
CREATE TYPE profession_type AS ENUM ('nutritionist', 'personal_trainer', 'physiotherapist', 'osteopath', 'massage_therapist', 'other');
CREATE TYPE custom_field_type AS ENUM ('text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'textarea');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE notification_channel AS ENUM ('whatsapp', 'email', 'both');
CREATE TYPE preferred_language AS ENUM ('it', 'en');

-- ============================================================
-- TABELLA: tenants
-- ============================================================
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,  -- es. "nutrifit-studio"
  logo_url        TEXT,
  brand_primary   TEXT DEFAULT '#2563EB',
  brand_accent    TEXT DEFAULT '#06B6D4',
  profession      profession_type NOT NULL DEFAULT 'other',
  -- Stripe
  stripe_customer_id       TEXT UNIQUE,
  stripe_subscription_id   TEXT UNIQUE,
  stripe_price_id          TEXT,
  plan            tenant_plan NOT NULL DEFAULT 'trial',
  trial_ends_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  status          tenant_status NOT NULL DEFAULT 'active',
  -- Limiti piano
  max_clients     INT NOT NULL DEFAULT 50,
  -- Impostazioni
  timezone        TEXT NOT NULL DEFAULT 'Europe/Rome',
  locale          preferred_language NOT NULL DEFAULT 'it',
  -- Metadati
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELLA: profiles (estende auth.users di Supabase)
-- ============================================================
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role            user_role NOT NULL DEFAULT 'CLIENT',
  full_name       TEXT,
  avatar_url      TEXT,
  phone           TEXT,
  preferred_language preferred_language NOT NULL DEFAULT 'it',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELLA: clients
-- ============================================================
CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id      UUID REFERENCES profiles(id) ON DELETE SET NULL, -- se ha accesso al portale
  assigned_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Anagrafica
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  birth_date      DATE,
  gender          TEXT,
  -- CRM
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  custom_fields   JSONB DEFAULT '{}',  -- campi dinamici per tenant
  preferred_language preferred_language NOT NULL DEFAULT 'it',
  -- Stato
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_appointment_at TIMESTAMPTZ,
  -- Metadati
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Constraint: email unica per tenant
  UNIQUE(tenant_id, email)
);

-- ============================================================
-- TABELLA: services
-- ============================================================
CREATE TABLE services (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  duration_min    INT NOT NULL DEFAULT 60,
  price           NUMERIC(10,2),
  currency        TEXT NOT NULL DEFAULT 'EUR',
  color           TEXT DEFAULT '#2563EB', -- colore nel calendario
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELLA: appointments
-- ============================================================
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  service_id      UUID REFERENCES services(id) ON DELETE SET NULL,
  -- Orari
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  -- Stato
  status          appointment_status NOT NULL DEFAULT 'scheduled',
  notes           TEXT,
  -- Integrazioni
  google_event_id TEXT,
  -- Metadati
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Nessuna sovrapposizione per lo stesso staff
  CONSTRAINT no_overlap EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status NOT IN ('cancelled'))
);

-- ============================================================
-- TABELLA: documents
-- ============================================================
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  type            document_type NOT NULL DEFAULT 'other',
  name            TEXT NOT NULL,
  storage_path    TEXT NOT NULL, -- path in Supabase Storage
  size_bytes      BIGINT,
  mime_type       TEXT,
  visible_to_client BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELLA: progress_entries
-- ============================================================
CREATE TABLE progress_entries (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  recorded_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Metriche standard
  weight_kg       NUMERIC(5,2),
  height_cm       NUMERIC(5,1),
  body_fat_pct    NUMERIC(4,1),
  muscle_mass_kg  NUMERIC(5,2),
  -- Misure corporee (jsonb flessibile)
  measurements    JSONB DEFAULT '{}', -- { "waist_cm": 82, "chest_cm": 95, ... }
  -- Note
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELLA: custom_field_definitions
-- ============================================================
CREATE TABLE custom_field_definitions (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL DEFAULT 'client', -- 'client' | 'appointment'
  field_key       TEXT NOT NULL, -- es. "bench_press_max"
  label_it        TEXT NOT NULL, -- es. "Panca Piana Max"
  label_en        TEXT NOT NULL, -- es. "Bench Press Max"
  field_type      custom_field_type NOT NULL,
  options         JSONB DEFAULT '[]', -- per select / multi_select
  required        BOOLEAN DEFAULT FALSE,
  sort_order      INT DEFAULT 0,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, entity_type, field_key)
);
