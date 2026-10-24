import Stripe from 'stripe'
import { PAID_PLAN_KEYS, PLAN_CATALOG, type PaidPlanKey } from '@/lib/billing/plans'

let stripeClient: Stripe | null = null

export function isStripeConfigured(plan?: PaidPlanKey) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return false
  return plan ? Boolean(getStripePriceId(plan)) : true
}

// Crea il client soltanto quando viene effettuata una richiesta Stripe.
// In questo modo le pagine dell'app restano utilizzabili finche Stripe non e configurato.
export function getStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY

  if (!apiKey) {
    throw new Error('Stripe non e configurato. Aggiungi STRIPE_SECRET_KEY alle variabili di ambiente.')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(apiKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    })
  }

  return stripeClient
}

// Piani e relativi Price ID
const PRICE_ENV_KEYS: Record<PaidPlanKey, keyof NodeJS.ProcessEnv> = {
  starter: 'STRIPE_PRICE_STARTER',
  professional: 'STRIPE_PRICE_PROFESSIONAL',
  business: 'STRIPE_PRICE_BUSINESS',
}

export function getStripePriceId(plan: PaidPlanKey): string | null {
  return process.env[PRICE_ENV_KEYS[plan]]?.trim() || null
}

export const STRIPE_PLANS = Object.fromEntries(
  PAID_PLAN_KEYS.map(key => [key, {
    priceId: getStripePriceId(key),
    name: PLAN_CATALOG[key].name,
    max_clients: PLAN_CATALOG[key].maxClients,
    price_monthly: PLAN_CATALOG[key].priceMonthly,
  }])
) as Record<PaidPlanKey, {
  priceId: string | null
  name: string
  max_clients: number
  price_monthly: number
}>

export type StripePlanKey = PaidPlanKey

// Ottieni il piano da un price ID
export function getPlanFromPriceId(priceId: string): StripePlanKey | null {
  for (const [key, plan] of Object.entries(STRIPE_PLANS)) {
    if (plan.priceId === priceId) return key as StripePlanKey
  }
  return null
}

// Crea o recupera il customer Stripe per un tenant
export async function getOrCreateStripeCustomer(
  tenantId: string,
  tenantName: string,
  email: string,
  existingCustomerId?: string | null
): Promise<string> {
  if (existingCustomerId) {
    return existingCustomerId
  }

  const customer = await getStripeClient().customers.create({
    name: tenantName,
    email,
    metadata: { tenant_id: tenantId },
  }, {
    idempotencyKey: `fitnessflow-customer-${tenantId}`,
  })

  return customer.id
}

// Crea URL checkout per abbonamento
export async function createCheckoutSession({
  customerId,
  priceId,
  tenantId,
  successUrl,
  cancelUrl,
}: {
  customerId: string
  priceId: string
  tenantId: string
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const session = await getStripeClient().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: tenantId,
    metadata: { tenant_id: tenantId },
    subscription_data: {
      metadata: { tenant_id: tenantId },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  })

  return session.url!
}

// Crea URL per il portale di gestione abbonamento Stripe
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
  return session.url
}
