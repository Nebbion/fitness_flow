import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBillingPortalSession, isStripeConfigured } from '@/lib/stripe/client'

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.redirect(new URL('/dashboard/billing', request.url))
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/auth/login', request.url))

    const formData = await request.formData()
    const locale = formData.get('locale') ?? 'it'

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id').eq('id', user.id).single()

    const { data: tenant } = await supabase
      .from('tenants').select('stripe_customer_id').eq('id', profile?.tenant_id).single()

    if (!tenant?.stripe_customer_id) {
      return NextResponse.redirect(
        new URL(`/${locale}/dashboard/billing`, request.url)
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!
    const url = await createBillingPortalSession(
      tenant.stripe_customer_id,
      `${appUrl}/${locale}/dashboard/billing`
    )

    return NextResponse.redirect(url)
  } catch (err: any) {
    console.error('Portal error:', err)
    return NextResponse.redirect(new URL('/dashboard/billing', request.url))
  }
}
