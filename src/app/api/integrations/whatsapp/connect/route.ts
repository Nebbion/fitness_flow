import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { encryptWhatsAppToken } from '@/lib/whatsapp/credentials'

const connectSchema = z.object({
  code: z.string().min(1),
  phoneNumberId: z.string().min(1),
  whatsappBusinessAccountId: z.string().min(1),
})

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

export async function POST(request: NextRequest) {
  const profile = await getTenantAdmin()
  if (!profile) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID
  const metaAppSecret = process.env.META_APP_SECRET
  if (!metaAppId || !metaAppSecret || !process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'Integrazione Meta non configurata dall’amministratore di FitnessFlow' }, { status: 503 })
  }

  const parsed = connectSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Dati di collegamento non validi' }, { status: 422 })

  try {
    const graphVersion = process.env.META_GRAPH_API_VERSION ?? 'v21.0'
    const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', metaAppId)
    tokenUrl.searchParams.set('client_secret', metaAppSecret)
    tokenUrl.searchParams.set('code', parsed.data.code)

    const tokenResponse = await fetch(tokenUrl)
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message ?? 'Meta non ha restituito un token di accesso')
    }

    const numberResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${parsed.data.phoneNumberId}?fields=id,display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    )
    const numberData = await numberResponse.json()
    if (!numberResponse.ok) {
      throw new Error(numberData.error?.message ?? 'Impossibile verificare il numero WhatsApp')
    }

    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null

    const admin = createAdminClient() as any
    const { error } = await admin
      .from('whatsapp_connections')
      .upsert({
        tenant_id: profile.tenant_id,
        professional_id: profile.id,
        whatsapp_business_account_id: parsed.data.whatsappBusinessAccountId,
        phone_number_id: parsed.data.phoneNumberId,
        display_phone_number: numberData.display_phone_number ?? null,
        verified_name: numberData.verified_name ?? null,
        access_token_encrypted: encryptWhatsAppToken(tokenData.access_token),
        token_expires_at: tokenExpiresAt,
        status: 'active',
        last_error: null,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'professional_id' })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('WhatsApp connection error:', error)
    return NextResponse.json({ error: error.message ?? 'Collegamento WhatsApp non riuscito' }, { status: 500 })
  }
}
