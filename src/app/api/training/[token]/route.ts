import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sessionActionSchema } from '@/lib/training/schemas'

interface Params { params: Promise<{ token: string }> }
const responseHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

async function getAccess(admin: any, token: string) {
  return admin.from('training_access').select('client_id, tenant_id, expires_at, revoked_at')
    .eq('token_hash', hash(token)).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params
  if (token.length < 40 || token.length > 100) return NextResponse.json({ error: 'Link non valido' }, { status: 404, headers: responseHeaders })
  const admin = createAdminClient() as any
  const { data: access } = await getAccess(admin, token)
  if (!access) return NextResponse.json({ error: 'Link scaduto o revocato' }, { status: 404, headers: responseHeaders })
  const [{ data: client }, { data: tenant }, { data: plan }, { data: openSession }, { data: history }] = await Promise.all([
    admin.from('clients').select('full_name, active').eq('id', access.client_id).eq('tenant_id', access.tenant_id).single(),
    admin.from('tenants').select('name, logo_url, brand_primary, brand_accent, status').eq('id', access.tenant_id).single(),
    admin.from('training_plans').select('*').eq('client_id', access.client_id).maybeSingle(),
    admin.from('training_sessions').select('*').eq('client_id', access.client_id).is('completed_at', null).maybeSingle(),
    admin.from('training_sessions').select('*').eq('client_id', access.client_id).not('completed_at', 'is', null)
      .order('completed_at', { ascending: false }).limit(20),
  ])
  if (!client?.active || tenant?.status !== 'active') return NextResponse.json({ error: 'Accesso non disponibile' }, { status: 404, headers: responseHeaders })
  return NextResponse.json({ client, tenant, plan, openSession, history: history ?? [] }, { headers: responseHeaders })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params
  const parsed = sessionActionSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Dati sessione non validi' }, { status: 422, headers: responseHeaders })
  const admin = createAdminClient() as any
  const values = parsed.data.action === 'start'
    ? { p_hash: hash(token), p_action: 'start' }
    : {
        p_hash: hash(token), p_action: parsed.data.action, p_id: parsed.data.sessionId,
        p_version: parsed.data.version, p_entries: parsed.data.entries, p_mutation: parsed.data.mutationId,
      }
  const { data, error } = await admin.rpc('training_session_write', values)
  if (error) {
    const conflict = error.message?.includes('version_conflict')
    const denied = error.message?.includes('access_denied')
    return NextResponse.json({ error: conflict ? 'La sessione è stata modificata altrove. Ricarica la pagina.' : denied ? 'Link scaduto o revocato' : error.message },
      { status: conflict ? 409 : denied ? 403 : 422, headers: responseHeaders })
  }
  return NextResponse.json({ session: data }, { headers: responseHeaders })
}
