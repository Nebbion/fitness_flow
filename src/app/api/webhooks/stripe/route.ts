import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient, getPlanFromPriceId, isStripeConfigured, STRIPE_PLANS } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

// Stripe richiede il body raw per la verifica firma
export const runtime = 'nodejs'

function tenantStatusFromSubscription(status: Stripe.Subscription.Status) {
  if (status === 'active' || status === 'trialing' || status === 'past_due') return 'active'
  if (status === 'unpaid' || status === 'paused') return 'suspended'
  if (status === 'canceled') return 'cancelled'
  return 'inactive'
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe non configurato' }, { status: 503 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Firma Stripe assente' }, { status: 400 })
  const stripe = getStripeClient()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Inserimento idempotente: Stripe può consegnare lo stesso evento più volte.
  const { error: eventLogError } = await admin.from('subscription_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data as any,
    tenant_id: (event.data.object as any)?.metadata?.tenant_id ?? null,
  })
  if (eventLogError?.code === '23505') {
    const { data: existingEvent } = await admin
      .from('subscription_events')
      .select('processed')
      .eq('stripe_event_id', event.id)
      .single()
    if (existingEvent?.processed) {
      return NextResponse.json({ received: true, duplicate: true })
    }
  }
  if (eventLogError && eventLogError.code !== '23505') {
    console.error('Stripe event log error:', eventLogError)
    return NextResponse.json({ error: 'Impossibile registrare evento Stripe' }, { status: 500 })
  }

  async function resolveTenantId(object: { metadata?: Stripe.Metadata | null; customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null }) {
    const metadataTenantId = object.metadata?.tenant_id
    if (metadataTenantId) return metadataTenantId
    const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id
    if (!customerId) return null
    const { data } = await admin
      .from('tenants')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    return data?.id ?? null
  }

  async function syncSubscription(subscription: Stripe.Subscription, explicitTenantId?: string | null) {
    const tenantId = explicitTenantId ?? await resolveTenantId(subscription)
    if (!tenantId) throw new Error(`Tenant non trovato per subscription ${subscription.id}`)

    const priceId = subscription.items.data[0]?.price.id
    const planKey = priceId ? getPlanFromPriceId(priceId) : null
    if (!planKey) throw new Error(`Price Stripe non riconosciuto: ${priceId ?? 'assente'}`)

    const planConfig = STRIPE_PLANS[planKey]
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

    const { error } = await admin.from('tenants').update({
      plan: planKey,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      stripe_price_id: priceId,
      max_clients: planConfig.max_clients,
      status: tenantStatusFromSubscription(subscription.status),
    }).eq('id', tenantId)

    if (error) throw error
    return tenantId
  }

  try {
    switch (event.type) {

      // ── Checkout completato → attiva abbonamento ──────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const tenantId = session.metadata?.tenant_id ?? session.client_reference_id
        if (!tenantId || session.mode !== 'subscription') break

        const subscriptionId = session.subscription as string
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await syncSubscription(subscription, tenantId)
        break
      }

      // ── Abbonamento aggiornato (upgrade/downgrade) ───────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await syncSubscription(sub)
        break
      }

      // ── Abbonamento cancellato ────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = await resolveTenantId(sub)
        if (!tenantId) throw new Error(`Tenant non trovato per subscription cancellata ${sub.id}`)

        await admin.from('tenants').update({
          stripe_subscription_id: null,
          stripe_price_id: null,
          status: 'cancelled',
        }).eq('id', tenantId)
        break
      }

      // ── Pagamento fallito → sospendi dopo periodo di grazia ──
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const tenantId = (invoice as any).subscription_details?.metadata?.tenant_id
          ?? (invoice as any).metadata?.tenant_id
          ?? await resolveTenantId(invoice)
        if (!tenantId) break

        console.warn(`Pagamento fallito per tenant ${tenantId}`)
        break
      }

      // ── Pagamento riuscito ────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Riattiva se era sospeso
        const { data: tenant } = await admin
          .from('tenants')
          .select('id, status')
          .eq('stripe_customer_id', customerId)
          .single()

        if (tenant?.status === 'suspended') {
          await admin.from('tenants').update({ status: 'active' }).eq('id', tenant.id)
        }
        break
      }
    }

    // Marca evento come processato
    await admin
      .from('subscription_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id)

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error(`Webhook handler error for ${event.type}:`, err)
    await admin
      .from('subscription_events')
      .update({ error_message: err.message })
      .eq('stripe_event_id', event.id)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
