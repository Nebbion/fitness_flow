import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { decryptGoogleToken } from '@/lib/google-calendar/credentials'
import { listWritableGoogleCalendars, refreshGoogleAccessToken } from '@/lib/google-calendar/client'
import { getGoogleCalendarProfessional } from '@/lib/google-calendar/session'

const schema = z.object({ calendarId: z.string().min(1).max(1024) })

export async function PATCH(request: NextRequest) {
  const professional = await getGoogleCalendarProfessional()
  if (!professional) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Calendario non valido' }, { status: 422 })

  const admin = createAdminClient() as any
  const { data: connection } = await admin
    .from('google_calendar_connections')
    .select('id, refresh_token_encrypted')
    .eq('tenant_id', professional.tenantId)
    .eq('professional_id', professional.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!connection) return NextResponse.json({ error: 'Google Calendar non collegato' }, { status: 404 })

  try {
    const token = await refreshGoogleAccessToken(decryptGoogleToken(connection.refresh_token_encrypted))
    const calendars = await listWritableGoogleCalendars(token.access_token)
    const calendar = calendars.find(item => item.id === parsed.data.calendarId)
    if (!calendar) return NextResponse.json({ error: 'Il calendario non è scrivibile' }, { status: 422 })

    const { error } = await admin.from('google_calendar_connections').update({
      calendar_id: calendar.id,
      calendar_name: calendar.summary,
      calendar_timezone: calendar.timeZone,
      last_error: null,
    }).eq('id', connection.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    await admin.from('google_calendar_connections')
      .update({ last_error: error.message ?? 'Errore Google Calendar' })
      .eq('id', connection.id)
    return NextResponse.json({ error: error.message ?? 'Errore Google Calendar' }, { status: 502 })
  }
}

