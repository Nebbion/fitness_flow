import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  reminder_enabled: z.boolean(),
  reminder_minutes: z.number().int().min(5).max(10080),
  reminder_template: z.string().regex(/^[a-z0-9_]{1,512}$/),
  reminder_language: z.string().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/),
  reminder_timezone: z.string().min(1).max(100),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single()
  if (!profile?.tenant_id || !['TENANT_ADMIN', 'STAFF'].includes(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Configurazione non valida' }, { status: 422 })
  try { new Intl.DateTimeFormat('it-IT', { timeZone: parsed.data.reminder_timezone }).format() }
  catch { return NextResponse.json({ error: 'Fuso orario non valido' }, { status: 422 }) }

  const { error } = await supabase.from('whatsapp_connections').update(parsed.data)
    .eq('tenant_id', profile.tenant_id).eq('professional_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
