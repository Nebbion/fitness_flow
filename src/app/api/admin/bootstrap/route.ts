import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'

const bootstrapSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const bootstrapToken = process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN
    if (!bootstrapToken) {
      return NextResponse.json(
        { error: 'Bootstrap super admin non configurato.' },
        { status: 503 }
      )
    }

    const parsed = bootstrapSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 })
    }

    if (parsed.data.token !== bootstrapToken) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 403 })
    }

    const admin = createAdminClient() as any
    const { count: existingSuperAdmins, error: countError } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'SUPER_ADMIN')

    if (countError) throw countError
    if ((existingSuperAdmins ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Esiste gia un super admin. Bootstrap disabilitato.' },
        { status: 409 }
      )
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase()
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (usersError) throw usersError

    const targetUser = users.users.find((user: { email?: string | null }) =>
      user.email?.toLowerCase() === normalizedEmail
    )
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Utente non trovato. Registrati prima con questa email.' },
        { status: 404 }
      )
    }

    const fullName = typeof targetUser.user_metadata?.full_name === 'string'
      ? targetUser.user_metadata.full_name
      : normalizedEmail

    const { error: upsertError } = await admin
      .from('profiles')
      .upsert({
        id: targetUser.id,
        tenant_id: null,
        role: 'SUPER_ADMIN',
        full_name: fullName,
        avatar_url: null,
        phone: null,
        preferred_language: 'it',
        active: true,
      })

    if (upsertError) throw upsertError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Super admin bootstrap error:', err)
    return NextResponse.json({ error: err.message ?? 'Errore interno' }, { status: 500 })
  }
}
