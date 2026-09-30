import { z } from 'zod'

// ============================================================
// FitnessFlow — Zod Schemas con messaggi i18n
// ============================================================
// I messaggi di errore usano chiavi i18n.
// Il componente Form traduce le chiavi con useTranslations('errors')
// ============================================================

// ─── TENANT / ONBOARDING ─────────────────────────────────────

export const onboardingSchema = z.object({
  company_name: z
    .string()
    .min(2, { message: 'errors.minLength' })
    .max(100, { message: 'errors.maxLength' }),
  slug: z
    .string()
    .min(3, { message: 'errors.minLength' })
    .max(50, { message: 'errors.maxLength' })
    .regex(/^[a-z0-9-]+$/, { message: 'errors.slugInvalid' }),
  profession: z.enum([
    'nutritionist',
    'personal_trainer',
    'physiotherapist',
    'osteopath',
    'massage_therapist',
    'other',
  ]),
  logo_url: z.string().url().optional().or(z.literal('')),
  brand_primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  brand_accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  timezone: z.string().optional().default('Europe/Rome'),
  locale: z.enum(['it', 'en']).optional().default('it'),
})

// ─── AUTH ─────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'errors.required' })
    .email({ message: 'errors.invalidEmail' }),
  password: z
    .string()
    .min(8, { message: 'errors.minLength' }),
})

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(2, { message: 'errors.minLength' })
      .max(100, { message: 'errors.maxLength' }),
    email: z
      .string()
      .min(1, { message: 'errors.required' })
      .email({ message: 'errors.invalidEmail' }),
    password: z
      .string()
      .min(8, { message: 'errors.minLength' })
      .max(72, { message: 'errors.maxLength' }),
    password_confirm: z.string(),
  })
  .refine(data => data.password === data.password_confirm, {
    message: 'errors.passwordMismatch',
    path: ['password_confirm'],
  })

// ─── CLIENT ──────────────────────────────────────────────────

export const createClientSchema = z.object({
  full_name: z
    .string()
    .min(2, { message: 'errors.minLength' })
    .max(150, { message: 'errors.maxLength' }),
  email: z
    .string()
    .email({ message: 'errors.invalidEmail' })
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^[\d\s\+\-\(\)]{7,20}$/, { message: 'errors.invalidPhone' })
    .optional()
    .or(z.literal('')),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  gender: z
    .enum(['male', 'female', 'other', 'not_specified'])
    .optional(),
  notes: z
    .string()
    .max(2000, { message: 'errors.maxLength' })
    .optional(),
  tags: z.array(z.string()).optional().default([]),
  assigned_staff_id: z.string().uuid().optional().or(z.literal('')),
  preferred_language: z.enum(['it', 'en']).optional().default('it'),
  custom_fields: z.record(z.unknown()).optional().default({}),
})

export const updateClientSchema = createClientSchema.partial()

// ─── SERVICE ──────────────────────────────────────────────────

export const createServiceSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'errors.minLength' })
    .max(100, { message: 'errors.maxLength' }),
  description: z
    .string()
    .max(500, { message: 'errors.maxLength' })
    .optional(),
  duration_min: z
    .number()
    .int()
    .min(5)
    .max(480),
  price: z
    .number()
    .min(0)
    .max(99999)
    .optional(),
  currency: z.string().length(3).optional().default('EUR'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .default('#2563EB'),
  active: z.boolean().optional().default(true),
})

// ─── APPOINTMENT ─────────────────────────────────────────────

export const createAppointmentSchema = z
  .object({
    client_id: z
      .string()
      .uuid({ message: 'errors.required' }),
    staff_id: z
      .string()
      .uuid({ message: 'errors.required' }),
    service_id: z.string().uuid().optional().or(z.literal('')),
    start_at: z.string().datetime({ offset: true }),
    end_at: z.string().datetime({ offset: true }),
    notes: z
      .string()
      .max(1000, { message: 'errors.maxLength' })
      .optional(),
  })
  .refine(data => new Date(data.end_at) > new Date(data.start_at), {
    message: 'errors.endBeforeStart',
    path: ['end_at'],
  })

export const updateAppointmentSchema = z.object({
  start_at: z.string().datetime({ offset: true }).optional(),
  end_at: z.string().datetime({ offset: true }).optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().max(1000).optional(),
  service_id: z.string().uuid().optional(),
})

// ─── DOCUMENT ────────────────────────────────────────────────

export const uploadDocumentSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'errors.required' })
    .max(200, { message: 'errors.maxLength' }),
  type: z.enum([
    'nutrition_plan',
    'workout_plan',
    'report',
    'medical',
    'image',
    'other',
  ]),
  visible_to_client: z.boolean().default(true),
  appointment_id: z.string().uuid().optional().or(z.literal('')),
})

// ─── PROGRESS ENTRY ──────────────────────────────────────────

export const createProgressEntrySchema = z.object({
  recorded_at: z.string().datetime({ offset: true }).optional(),
  weight_kg: z.number().min(0).max(500).optional(),
  height_cm: z.number().min(0).max(300).optional(),
  body_fat_pct: z.number().min(0).max(100).optional(),
  muscle_mass_kg: z.number().min(0).max(200).optional(),
  measurements: z.record(z.number()).optional().default({}),
  notes: z.string().max(1000).optional(),
})

// ─── CUSTOM FIELD DEFINITION ─────────────────────────────────

export const createCustomFieldSchema = z.object({
  field_key: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z_]+$/, { message: 'errors.fieldKeyInvalid' }),
  label_it: z
    .string()
    .min(1, { message: 'errors.required' })
    .max(100),
  label_en: z
    .string()
    .min(1, { message: 'errors.required' })
    .max(100),
  field_type: z.enum([
    'text',
    'number',
    'date',
    'select',
    'multi_select',
    'checkbox',
    'textarea',
  ]),
  options: z.array(z.string()).optional().default([]),
  required: z.boolean().optional().default(false),
  sort_order: z.number().int().optional().default(0),
})

// ─── STAFF INVITE ────────────────────────────────────────────

export const inviteStaffSchema = z.object({
  email: z
    .string()
    .email({ message: 'errors.invalidEmail' }),
  full_name: z
    .string()
    .min(2, { message: 'errors.minLength' })
    .max(100),
  role: z.enum(['TENANT_ADMIN', 'STAFF']),
})

// ─── TIPI INFERITI ───────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type OnboardingInput = z.infer<typeof onboardingSchema>
export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type CreateServiceInput = z.infer<typeof createServiceSchema>
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>
export type CreateProgressEntryInput = z.infer<typeof createProgressEntrySchema>
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>
