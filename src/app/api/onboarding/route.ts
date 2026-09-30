import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { OnboardingInput } from '@/schemas'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const body: OnboardingInput = await request.json()
    const { company_name, slug, profession, brand_primary, brand_accent, locale, timezone } = body

    // Verifica slug disponibile
    const { data: existingTenant } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingTenant) {
      return NextResponse.json({ error: 'URL già in uso. Scegli un altro.' }, { status: 409 })
    }

    // Crea tenant
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({
        name: company_name,
        slug,
        profession,
        brand_primary: brand_primary ?? '#2563EB',
        brand_accent: brand_accent ?? '#06B6D4',
        locale: locale ?? 'it',
        timezone: timezone ?? 'Europe/Rome',
        plan: 'trial',
        max_clients: 10,
      })
      .select()
      .single()

    if (tenantError || !tenant) {
      console.error('Tenant creation error:', tenantError)
      return NextResponse.json(
        { error: tenantError?.message ?? 'Errore nella creazione dello studio' },
        { status: 500 }
      )
    }

    // Aggiorna profilo utente con tenant_id e ruolo TENANT_ADMIN
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        tenant_id: tenant.id,
        role: 'TENANT_ADMIN',
      })
      .eq('id', user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
      // Rollback: elimina il tenant
      await admin.from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json(
        { error: profileError.message ?? 'Errore aggiornamento profilo' },
        { status: 500 }
      )
    }

    // Seed servizi e campi custom per la professione
    const { error: servicesError } = await admin.rpc('seed_default_services', {
      p_tenant_id: tenant.id,
      p_profession: profession,
    })
    if (servicesError) {
      console.error('Default services seed error:', servicesError)
      await admin
        .from('profiles')
        .update({ tenant_id: null, role: 'CLIENT' })
        .eq('id', user.id)
      await admin.from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json({ error: servicesError.message }, { status: 500 })
    }

    const { error: fieldsError } = await admin.rpc('seed_default_custom_fields', {
      p_tenant_id: tenant.id,
      p_profession: profession,
    })
    if (fieldsError) {
      console.error('Default custom fields seed error:', fieldsError)
      await admin
        .from('profiles')
        .update({ tenant_id: null, role: 'CLIENT' })
        .eq('id', user.id)
      await admin.from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json({ error: fieldsError.message }, { status: 500 })
    }

    // Forza refresh del JWT per includere i nuovi claims
    await supabase.auth.refreshSession()

    return NextResponse.json({ success: true, tenant_id: tenant.id })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore interno del server' },
      { status: 500 }
    )
  }
}
