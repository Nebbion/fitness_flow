import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { inviteStaffSchema } from '@/schemas'

// POST /api/staff/invite
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id, role').eq('id', user.id).single()

    if (profile?.role !== 'TENANT_ADMIN') {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = inviteStaffSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 422 })

    const { email, full_name, role } = parsed.data
    const locale = body.locale ?? 'it'

    // Controlla se l'utente esiste già
    const { data: existingUsers } = await admin.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(u => u.email === email)

    let staffUserId: string

    if (existingUser) {
      staffUserId = existingUser.id
      // Aggiorna il profilo se esiste già
      await admin.from('profiles').upsert({
        id: staffUserId,
        tenant_id: profile.tenant_id,
        role,
        full_name,
        active: true,
      })
    } else {
      // Crea nuovo utente e invia email di invito
      const { data: newUser, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name, preferred_language: locale },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/auth/callback`,
      })

      if (error || !newUser.user) throw new Error(error?.message ?? 'Errore creazione utente')

      staffUserId = newUser.user.id

      await admin.from('profiles').insert({
        id: staffUserId,
        tenant_id: profile.tenant_id,
        role,
        full_name,
        active: true,
      })
    }

    return NextResponse.json({ success: true, userId: staffUserId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
