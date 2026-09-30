import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/clients/[id]/portal-invite
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    // Recupera il cliente
    const { data: client } = await supabase
      .from('clients')
      .select('id, full_name, email, preferred_language')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single()

    if (!client?.email) {
      return NextResponse.json(
        { error: 'Il cliente non ha un indirizzo email' },
        { status: 400 }
      )
    }

    // Crea o recupera l'utente auth per il cliente
    const { data: existingUser } = await admin.auth.admin.listUsers()
    const existingAuthUser = existingUser.users.find(u => u.email === client.email)

    let clientUserId: string

    if (existingAuthUser) {
      clientUserId = existingAuthUser.id
    } else {
      // Crea un nuovo utente auth
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: client.email,
        email_confirm: true,
        user_metadata: {
          full_name: client.full_name,
          preferred_language: client.preferred_language ?? 'it',
        },
      })

      if (createError || !newUser.user) {
        throw new Error('Errore creazione utente: ' + createError?.message)
      }

      clientUserId = newUser.user.id

      // Crea il profilo con ruolo CLIENT
      await admin.from('profiles').insert({
        id: clientUserId,
        tenant_id: profile.tenant_id,
        role: 'CLIENT',
        full_name: client.full_name,
        preferred_language: client.preferred_language ?? 'it',
      })
    }

    // Collega il profilo al record cliente
    await admin
      .from('clients')
      .update({ profile_id: clientUserId })
      .eq('id', id)

    // Invia magic link
    const locale = client.preferred_language ?? 'it'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const { error: otpError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: client.email,
      options: {
        redirectTo: `${appUrl}/${locale}/auth/callback?next=/${locale}/portal`,
      },
    })

    if (otpError) throw otpError

    return NextResponse.json({ success: true, email: client.email })
  } catch (err: any) {
    console.error('Portal invite error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
