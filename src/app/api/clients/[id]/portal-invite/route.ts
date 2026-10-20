import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface Params {
  params: Promise<{ id: string }>
}

type TenantProfile = {
  tenant_id: string
  role: string
  full_name: string | null
}

type PortalClient = {
  id: string
  full_name: string
  email: string
  preferred_language: string | null
}

type ExistingProfile = {
  tenant_id: string | null
  role: string
}

// POST /api/clients/[id]/portal-invite
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient() as any
    const admin = createAdminClient() as any

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profileData } = await supabase
      .from('profiles')
      .select('tenant_id, role, full_name')
      .eq('id', user.id)
      .single()

    const profile = profileData as TenantProfile | null

    if (profile?.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, brand_primary, brand_accent')
      .eq('id', profile.tenant_id)
      .single()

    if (!tenant) return NextResponse.json({ error: 'Studio non trovato' }, { status: 404 })

    // Recupera il cliente
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, full_name, email, preferred_language')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single()

    const client = clientData as PortalClient | null

    if (!client?.email) {
      return NextResponse.json(
        { error: 'Il cliente non ha un indirizzo email' },
        { status: 400 }
      )
    }

    const locale = client.preferred_language ?? 'it'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const portalRedirectTo = `${appUrl}/${locale}/portal`
    const passwordSetupRedirectTo = `${appUrl}/${locale}/auth/reset-password?mode=invite`
    const emailMetadata = {
      full_name: client.full_name,
      preferred_language: locale,
      tenant_name: tenant.name,
      professional_name: profile.full_name ?? tenant.name,
      brand_primary: tenant.brand_primary ?? '#2563EB',
      brand_accent: tenant.brand_accent ?? '#06B6D4',
    }

    // Crea o recupera l'utente auth per il cliente
    const { data: existingUser } = await admin.auth.admin.listUsers()
    const existingAuthUser = existingUser.users.find((u: { id: string; email?: string }) =>
      u.email === client.email
    )

    let clientUserId: string

    if (existingAuthUser) {
      clientUserId = existingAuthUser.id
      // Accounts created before this flow have no marker, so guide them through
      // password creation once instead of silently sending them to the portal.
      const needsPasswordSetup = existingAuthUser.user_metadata?.portal_password_set !== true
      const { error: metadataError } = await admin.auth.admin.updateUserById(clientUserId, {
        user_metadata: { ...existingAuthUser.user_metadata, ...emailMetadata },
      })
      if (metadataError) throw new Error('Errore aggiornamento invito: ' + metadataError.message)
      const { data: existingProfileData } = await admin
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', clientUserId)
        .maybeSingle()

      const existingProfile = existingProfileData as ExistingProfile | null

      if (existingProfile && existingProfile.role !== 'CLIENT') {
        return NextResponse.json(
          { error: 'Questa email e gia associata a un account staff o amministratore.' },
          { status: 409 }
        )
      }

      if (existingProfile?.tenant_id && existingProfile.tenant_id !== profile.tenant_id) {
        return NextResponse.json(
          { error: 'Questa email e gia associata a un altro portale cliente.' },
          { status: 409 }
        )
      }

      await admin.from('profiles').upsert({
        id: clientUserId,
        tenant_id: profile.tenant_id,
        role: 'CLIENT',
        full_name: client.full_name,
        preferred_language: locale,
        active: true,
      })

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: client.email,
        options: {
          emailRedirectTo: needsPasswordSetup ? passwordSetupRedirectTo : portalRedirectTo,
          shouldCreateUser: false,
        },
      })

      if (otpError) throw new Error('Errore invio email: ' + otpError.message)
    } else {
      // Crea un nuovo utente auth e invia l'email di invito Supabase
      const { data: newUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        client.email,
        {
          data: {
            portal_password_set: false,
            ...emailMetadata,
          },
          redirectTo: passwordSetupRedirectTo,
        }
      )

      if (inviteError || !newUser.user) {
        throw new Error('Errore invio invito: ' + inviteError?.message)
      }

      clientUserId = newUser.user.id

      // Crea o aggiorna il profilo con ruolo CLIENT
      await admin.from('profiles').upsert({
        id: clientUserId,
        tenant_id: profile.tenant_id,
        role: 'CLIENT',
        full_name: client.full_name,
        preferred_language: locale,
        active: true,
      })
    }

    // Collega il profilo al record cliente
    await admin
      .from('clients')
      .update({ profile_id: clientUserId })
      .eq('id', id)

    return NextResponse.json({ success: true, email: client.email })
  } catch (err: any) {
    console.error('Portal invite error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
