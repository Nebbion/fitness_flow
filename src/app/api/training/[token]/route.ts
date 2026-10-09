import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sessionActionSchema } from '@/lib/training/schemas'
import { hashTrainingToken, resolveTrainingAccess } from '@/lib/training/access'

interface Params { params: Promise<{ token: string }> }
const responseHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params
  const admin = createAdminClient() as any
  const access = await resolveTrainingAccess(admin, token)
  if (!access) return NextResponse.json({ error: 'Link scaduto o revocato' }, { status: 404, headers: responseHeaders })
  const [clientResult, tenantResult, planResult, openResult, historyResult] = await Promise.all([
    admin.from('clients').select('full_name, active').eq('id', access.client_id).eq('tenant_id', access.tenant_id).single(),
    admin.from('tenants').select('name, logo_url, brand_primary, brand_accent, status').eq('id', access.tenant_id).single(),
    admin.from('training_plans').select('*').eq('client_id', access.client_id).eq('tenant_id', access.tenant_id).maybeSingle(),
    admin.from('training_sessions').select('*').eq('client_id', access.client_id).eq('tenant_id', access.tenant_id).is('completed_at', null).maybeSingle(),
    admin.from('training_sessions').select('*').eq('client_id', access.client_id).eq('tenant_id', access.tenant_id).not('completed_at', 'is', null)
      .order('completed_at', { ascending: false }).limit(20),
  ])
  const error = [clientResult, tenantResult, planResult, openResult, historyResult].find(result => result.error)?.error
  if (error) return NextResponse.json({ error: 'Impossibile caricare l’area allenamento' }, { status: 500, headers: responseHeaders })
  const client = clientResult.data
  const tenant = tenantResult.data
  if (!client?.active || tenant?.status !== 'active') return NextResponse.json({ error: 'Accesso non disponibile' }, { status: 404, headers: responseHeaders })
  return NextResponse.json({
    client,
    tenant,
    plan: planResult.data,
    openSession: openResult.data,
    history: historyResult.data ?? [],
  }, { headers: responseHeaders })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params
  const parsed = sessionActionSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Dati sessione non validi' }, { status: 422, headers: responseHeaders })
  const admin = createAdminClient() as any
  const values = parsed.data.action === 'start'
    ? { p_hash: hashTrainingToken(token), p_action: 'start' }
    : {
        p_hash: hashTrainingToken(token), p_action: parsed.data.action, p_id: parsed.data.sessionId,
        p_version: parsed.data.version, p_entries: parsed.data.entries, p_mutation: parsed.data.mutationId,
        p_notes: parsed.data.notes,
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
