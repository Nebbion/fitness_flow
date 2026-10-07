import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

async function getTenantAdmin() {
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id || !['TENANT_ADMIN', 'STAFF'].includes(profile.role)) return null
  return { ...profile, id: user.id }
}

export async function GET() {
  const profile = await getTenantAdmin()
  if (!profile) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('whatsapp_connections')
    .select('id, display_phone_number, verified_name, status, last_error, connected_at, updated_at, reminder_enabled, reminder_minutes, reminder_template, reminder_language, reminder_timezone')
    .eq('tenant_id', profile.tenant_id)
    .eq('professional_id', profile.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    connection: data,
    setupReady: Boolean(
      process.env.NEXT_PUBLIC_META_APP_ID &&
      process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID &&
      process.env.META_APP_SECRET &&
      process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY
    ),
  })
}
