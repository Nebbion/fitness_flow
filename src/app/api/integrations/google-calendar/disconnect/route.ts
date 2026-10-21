import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { decryptGoogleToken } from '@/lib/google-calendar/credentials'
import { revokeGoogleToken } from '@/lib/google-calendar/client'
import { getGoogleCalendarProfessional } from '@/lib/google-calendar/session'

export async function DELETE() {
  const professional = await getGoogleCalendarProfessional()
  if (!professional) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const admin = createAdminClient() as any
  const { data: connection } = await admin
    .from('google_calendar_connections')
    .select('refresh_token_encrypted')
    .eq('tenant_id', professional.tenantId)
    .eq('professional_id', professional.id)
    .maybeSingle()

  if (connection?.refresh_token_encrypted) {
    try {
      await revokeGoogleToken(decryptGoogleToken(connection.refresh_token_encrypted))
    } catch (error) {
      console.error('Google token revocation failed:', error)
    }
  }

  const { error } = await admin
    .from('google_calendar_connections')
    .delete()
    .eq('tenant_id', professional.tenantId)
    .eq('professional_id', professional.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
