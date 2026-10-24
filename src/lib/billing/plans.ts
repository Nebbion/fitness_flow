export const TRIAL_DURATION_DAYS = 30
export const UNLIMITED_CLIENTS = 999_999

export type PlanKey = 'trial' | 'starter' | 'professional' | 'business'

export interface PlanDefinition {
  key: PlanKey
  name: string
  priceMonthly: number
  maxClients: number
  storageGb: number
  aiMonthlyRequests: number
  aiMaxOutputTokens: number
  features: string[]
  popular?: boolean
}

/**
 * Catalogo commerciale e limiti applicativi.
 *
 * I limiti AI sono intenzionalmente espressi in generazioni, non in token:
 * sono comprensibili per il cliente, mentre aiMaxOutputTokens protegge il costo
 * massimo della singola richiesta.
 */
export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  trial: {
    key: 'trial',
    name: 'Trial',
    priceMonthly: 0,
    maxClients: 10,
    storageGb: 1,
    aiMonthlyRequests: 10,
    aiMaxOutputTokens: 800,
    features: ['10 clienti', 'Appuntamenti illimitati', '10 generazioni AI/mese'],
  },
  starter: {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 29,
    maxClients: 50,
    storageGb: 5,
    aiMonthlyRequests: 100,
    aiMaxOutputTokens: 1_200,
    features: [
      '50 clienti',
      'Appuntamenti illimitati',
      'Messaggi WhatsApp',
      'Storage 5GB',
      '100 generazioni AI/mese',
    ],
  },
  professional: {
    key: 'professional',
    name: 'Professional',
    priceMonthly: 59,
    maxClients: 250,
    storageGb: 20,
    aiMonthlyRequests: 500,
    aiMaxOutputTokens: 2_000,
    features: [
      '250 clienti',
      'Appuntamenti illimitati',
      'Messaggi WhatsApp illimitati',
      'Storage 20GB',
      '500 generazioni AI/mese',
      'Google Calendar sync',
    ],
    popular: true,
  },
  business: {
    key: 'business',
    name: 'Business',
    priceMonthly: 99,
    maxClients: UNLIMITED_CLIENTS,
    storageGb: 100,
    aiMonthlyRequests: 2_000,
    aiMaxOutputTokens: 2_500,
    features: [
      'Clienti illimitati',
      'Appuntamenti illimitati',
      'WhatsApp illimitato',
      'Storage 100GB',
      '2.000 generazioni AI/mese',
      'Staff illimitato',
      'Supporto prioritario',
    ],
  },
}

export const PAID_PLAN_KEYS = ['starter', 'professional', 'business'] as const
export type PaidPlanKey = (typeof PAID_PLAN_KEYS)[number]

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === 'string' && value in PLAN_CATALOG
}

export function isPaidPlanKey(value: unknown): value is PaidPlanKey {
  return typeof value === 'string' && PAID_PLAN_KEYS.includes(value as PaidPlanKey)
}

export function getPlanDefinition(plan: unknown): PlanDefinition {
  return PLAN_CATALOG[isPlanKey(plan) ? plan : 'trial']
}

export function getTrialEndDate(startedAt = new Date()): Date {
  const end = new Date(startedAt)
  end.setUTCDate(end.getUTCDate() + TRIAL_DURATION_DAYS)
  return end
}

export function getCurrentUtcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export function isTrialExpired(
  tenant: { plan: string; trial_ends_at?: string | null },
  now = new Date()
): boolean {
  if (tenant.plan !== 'trial') return false
  if (!tenant.trial_ends_at) return true
  return new Date(tenant.trial_ends_at).getTime() <= now.getTime()
}

export function hasSubscriptionAccess(
  tenant: { status: string; plan: string; trial_ends_at?: string | null },
  now = new Date()
): boolean {
  return tenant.status === 'active' && !isTrialExpired(tenant, now)
}
