// ============================================================
// FitnessFlow — Tipi TypeScript condivisi
// ============================================================

// ─── ENUMS ───────────────────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'STAFF' | 'CLIENT'

export type TenantPlan = 'trial' | 'starter' | 'professional' | 'business'

export type TenantStatus = 'active' | 'inactive' | 'suspended' | 'cancelled'

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type DocumentType =
  | 'nutrition_plan'
  | 'workout_plan'
  | 'report'
  | 'medical'
  | 'image'
  | 'other'

export type ProfessionType =
  | 'nutritionist'
  | 'personal_trainer'
  | 'physiotherapist'
  | 'osteopath'
  | 'massage_therapist'
  | 'other'

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multi_select'
  | 'checkbox'
  | 'textarea'

export type PreferredLanguage = 'it' | 'en'

export type NotificationChannel = 'whatsapp' | 'email' | 'both'

export type MessageDirection = 'inbound' | 'outbound'

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

// ─── TENANT ──────────────────────────────────────────────────

export interface Tenant {
  id: string
  name: string
  slug: string
  logo_url: string | null
  brand_primary: string
  brand_accent: string
  profession: ProfessionType
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  plan: TenantPlan
  trial_ends_at: string | null
  status: TenantStatus
  max_clients: number
  timezone: string
  locale: PreferredLanguage
  created_at: string
  updated_at: string
}

export interface TenantWithStats extends Tenant {
  total_clients: number
  total_appointments: number
  monthly_revenue: number
}

// ─── PROFILO UTENTE ───────────────────────────────────────────

export interface Profile {
  id: string
  tenant_id: string | null
  role: UserRole
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  preferred_language: PreferredLanguage
  active: boolean
  created_at: string
  updated_at: string
}

// ─── CLIENTE ─────────────────────────────────────────────────

export interface Client {
  id: string
  tenant_id: string
  profile_id: string | null
  assigned_staff_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
  gender: string | null
  notes: string | null
  tags: string[]
  custom_fields: Record<string, unknown>
  preferred_language: PreferredLanguage
  active: boolean
  last_appointment_at: string | null
  created_at: string
  updated_at: string
}

export interface ClientWithRelations extends Client {
  assigned_staff: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
  upcoming_appointments_count: number
  total_appointments_count: number
}

// ─── SERVIZIO ─────────────────────────────────────────────────

export interface Service {
  id: string
  tenant_id: string
  name: string
  description: string | null
  duration_min: number
  price: number | null
  currency: string
  color: string
  active: boolean
  created_at: string
  updated_at: string
}

// ─── APPUNTAMENTO ─────────────────────────────────────────────

export interface Appointment {
  id: string
  tenant_id: string
  client_id: string
  staff_id: string
  service_id: string | null
  start_at: string
  end_at: string
  status: AppointmentStatus
  notes: string | null
  google_event_id: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentWithRelations extends Appointment {
  client: Pick<Client, 'id' | 'full_name' | 'email' | 'phone' | 'preferred_language'>
  staff: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
  service: Pick<Service, 'id' | 'name' | 'duration_min' | 'price' | 'color'> | null
}

// ─── DOCUMENTO ───────────────────────────────────────────────

export interface Document {
  id: string
  tenant_id: string
  client_id: string
  uploaded_by: string
  appointment_id: string | null
  type: DocumentType
  name: string
  storage_path: string
  size_bytes: number | null
  mime_type: string | null
  visible_to_client: boolean
  created_at: string
}

export interface DocumentWithUrl extends Document {
  signed_url: string
  uploader: Pick<Profile, 'id' | 'full_name'>
}

// ─── PROGRESSO ───────────────────────────────────────────────

export interface ProgressEntry {
  id: string
  tenant_id: string
  client_id: string
  recorded_by: string | null
  recorded_at: string
  weight_kg: number | null
  height_cm: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  measurements: Record<string, number>
  notes: string | null
  created_at: string
}

// ─── CAMPI CUSTOM ────────────────────────────────────────────

export interface CustomFieldDefinition {
  id: string
  tenant_id: string
  entity_type: string
  field_key: string
  label_it: string
  label_en: string
  field_type: CustomFieldType
  options: string[]
  required: boolean
  sort_order: number
  active: boolean
  created_at: string
}

// ─── MESSAGGI WHATSAPP ───────────────────────────────────────

export interface WhatsappMessage {
  id: string
  tenant_id: string
  client_id: string | null
  direction: MessageDirection
  body: string
  wa_message_id: string | null
  status: MessageStatus
  trigger_event: string | null
  appointment_id: string | null
  sent_at: string | null
  created_at: string
}

// ─── AI USAGE ────────────────────────────────────────────────

export interface AiUsageLog {
  id: string
  tenant_id: string
  user_id: string
  feature: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number | null
  duration_ms: number | null
  created_at: string
}

// ─── JWT CLAIMS (custom) ──────────────────────────────────────

export interface JwtClaims {
  sub: string        // user id
  email: string
  user_role: UserRole
  tenant_id: string | null
  profession: ProfessionType | null
  plan: TenantPlan | null
  iat: number
  exp: number
}

// ─── API RESPONSES ────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ─── FORM TYPES ──────────────────────────────────────────────

export interface CreateClientInput {
  full_name: string
  email?: string
  phone?: string
  birth_date?: string
  gender?: string
  notes?: string
  tags?: string[]
  assigned_staff_id?: string
  preferred_language?: PreferredLanguage
  custom_fields?: Record<string, unknown>
}

export interface CreateAppointmentInput {
  client_id: string
  staff_id: string
  service_id?: string
  start_at: string
  end_at: string
  notes?: string
}

export interface CreateServiceInput {
  name: string
  description?: string
  duration_min: number
  price?: number
  currency?: string
  color?: string
}

// ─── ONBOARDING ──────────────────────────────────────────────

export interface OnboardingData {
  company_name: string
  slug: string
  profession: ProfessionType
  logo_url?: string
  brand_primary?: string
  brand_accent?: string
  timezone?: string
  locale?: PreferredLanguage
}

// ─── STRIPE ──────────────────────────────────────────────────

export const PLAN_LIMITS: Record<TenantPlan, { max_clients: number; label: string }> = {
  trial:        { max_clients: 10,         label: 'Trial' },
  starter:      { max_clients: 50,         label: 'Starter' },
  professional: { max_clients: 250,        label: 'Professional' },
  business:     { max_clients: 999999,     label: 'Business' },
}

export const PLAN_PRICES: Record<Exclude<TenantPlan, 'trial'>, { monthly: number; yearly: number }> = {
  starter:      { monthly: 29,  yearly: 290  },
  professional: { monthly: 59,  yearly: 590  },
  business:     { monthly: 99,  yearly: 990  },
}
