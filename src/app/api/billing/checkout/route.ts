import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isStripeConfigured, STRIPE_PLANS, getOrCreateStripeCustomer, createCheckoutSession,
} from '@/lib/stripe/client'

// POST /api/billing/checkout — crea sessione Stripe Checkout
export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'I pagamenti non sono ancora configurati.' },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id, role').eq('id', user.id).single()

    if (profile?.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const { data: tenant } = await supabase
      .from('tenants').select('*').eq('id', profile.tenant_id).single()

    if (!tenant) return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 })

    const body = await request.json()
    const { plan, locale } = body

    const planConfig = STRIPE_PLANS[plan as keyof typeof STRIPE_PLANS]
    if (!planConfig) return NextResponse.json({ error: 'Piano non valido' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    // Crea o recupera customer Stripe
    const customerId = await getOrCreateStripeCustomer(
      tenant.id,
      tenant.name,
      user.email!,
      tenant.stripe_customer_id
    )

    // Salva il customer ID se nuovo
    if (!tenant.stripe_customer_id) {
      await supabase
        .from('tenants')
        .update({ stripe_customer_id: customerId })
        .eq('id', tenant.id)
    }

    // Se ha già un abbonamento attivo → usa il Billing Portal
    if (tenant.stripe_subscription_id) {
      const { createBillingPortalSession } = await import('@/lib/stripe/client')
      const url = await createBillingPortalSession(
        customerId,
        `${appUrl}/${locale}/dashboard/billing`
      )
      return NextResponse.json({ url })
    }

    // Nuova sessione Checkout
    const url = await createCheckoutSession({
      customerId,
      priceId: planConfig.priceId,
      tenantId: tenant.id,
      successUrl: `${appUrl}/${locale}/dashboard/billing?success=true`,
      cancelUrl: `${appUrl}/${locale}/dashboard/billing`,
    })

    return NextResponse.json({ url })
  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
