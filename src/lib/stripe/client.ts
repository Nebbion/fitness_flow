import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
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
export const STRIPE_PLANS = {
  starter: {
    priceId: process.env.STRIPE_PRICE_STARTER!,
    name: 'Starter',
    max_clients: 50,
    price_monthly: 29,
  },
  professional: {
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL!,
    name: 'Professional',
    max_clients: 250,
    price_monthly: 59,
  },
  business: {
    priceId: process.env.STRIPE_PRICE_BUSINESS!,
    name: 'Business',
    max_clients: 999999,
    price_monthly: 99,
  },
} as const

export type StripePlanKey = keyof typeof STRIPE_PLANS

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
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenant_id: tenantId },
    subscription_data: {
      metadata: { tenant_id: tenantId },
      trial_period_days: 0,
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
