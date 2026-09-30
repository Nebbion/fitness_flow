import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient, getPlanFromPriceId, isStripeConfigured, STRIPE_PLANS } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

// Stripe richiede il body raw per la verifica firma
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe non configurato' }, { status: 503 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!
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

  // Log evento
  try {
    await admin.from('subscription_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event.data as any,
      tenant_id: (event.data.object as any)?.metadata?.tenant_id ?? null,
    })
  } catch {}

  try {
    switch (event.type) {

      // ── Checkout completato → attiva abbonamento ──────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const tenantId = session.metadata?.tenant_id
        if (!tenantId || session.mode !== 'subscription') break

        const subscriptionId = session.subscription as string
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id
        const planKey = getPlanFromPriceId(priceId)

        if (planKey) {
          const planConfig = STRIPE_PLANS[planKey]
          await admin.from('tenants').update({
            plan: planKey,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: session.customer as string,
            max_clients: planConfig.max_clients,
            status: 'active',
          }).eq('id', tenantId)
        }
        break
      }

      // ── Abbonamento aggiornato (upgrade/downgrade) ───────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata?.tenant_id
        if (!tenantId) break

        const priceId = sub.items.data[0]?.price.id
        const planKey = getPlanFromPriceId(priceId)

        if (planKey) {
          const planConfig = STRIPE_PLANS[planKey]
          await admin.from('tenants').update({
            plan: planKey,
            max_clients: planConfig.max_clients,
            status: sub.status === 'active' ? 'active' : 'inactive',
            stripe_subscription_id: sub.id,
          }).eq('id', tenantId)
        }
        break
      }

      // ── Abbonamento cancellato ────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata?.tenant_id
        if (!tenantId) break

        await admin.from('tenants').update({
          plan: 'trial',
          stripe_subscription_id: null,
          max_clients: 10,
          status: 'inactive',
        }).eq('id', tenantId)
        break
      }

      // ── Pagamento fallito → sospendi dopo periodo di grazia ──
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const tenantId = (invoice as any).subscription_details?.metadata?.tenant_id
          ?? (invoice as any).metadata?.tenant_id
        if (!tenantId) break

        // Dopo 3 tentativi falliti Stripe cancella → gestito dall'evento deleted
        // Qui logghiamo solo per ora
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
