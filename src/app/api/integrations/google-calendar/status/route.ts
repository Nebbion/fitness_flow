import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  GOOGLE_CALENDAR_LABELS_SCOPE,
  googleCalendarSetupReady,
  listWritableGoogleCalendars,
  refreshGoogleAccessToken,
} from '@/lib/google-calendar/client'
import { decryptGoogleToken } from '@/lib/google-calendar/credentials'
import { getGoogleCalendarProfessional } from '@/lib/google-calendar/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const professional = await getGoogleCalendarProfessional()
  if (!professional) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const admin = createAdminClient() as any
  const { data: connection, error } = await admin
    .from('google_calendar_connections')
    .select('id, google_account_email, calendar_id, calendar_name, calendar_timezone, status, last_error, connected_at, updated_at, granted_scopes, refresh_token_encrypted')
    .eq('tenant_id', professional.tenantId)
    .eq('professional_id', professional.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let calendars: unknown[] = []
  if (connection?.status === 'active') {
    try {
      const token = await refreshGoogleAccessToken(decryptGoogleToken(connection.refresh_token_encrypted))
      calendars = await listWritableGoogleCalendars(token.access_token)
      if (connection.last_error) {
        await admin.from('google_calendar_connections')
          .update({ last_error: null })
          .eq('id', connection.id)
      }
    } catch (caught: any) {
      const message = caught.message ?? 'Impossibile leggere i calendari Google'
      await admin.from('google_calendar_connections')
        .update({
          status: message.includes('invalid_grant') ? 'error' : 'active',
          last_error: message,
        })
        .eq('id', connection.id)
      if (message.includes('invalid_grant')) connection.status = 'error'
      connection.last_error = message
    }
  }

  if (connection) delete connection.refresh_token_encrypted
  return NextResponse.json(
    {
      connection,
      calendars,
      setupReady: googleCalendarSetupReady(),
      labelsReady: connection?.granted_scopes?.includes(GOOGLE_CALENDAR_LABELS_SCOPE) ?? false,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
