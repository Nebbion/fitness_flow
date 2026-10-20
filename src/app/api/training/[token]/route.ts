import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sessionActionSchema } from '@/lib/training/schemas'
import { hashTrainingToken, resolveTrainingAccess, scopeToTrainingAccess } from '@/lib/training/access'
import { withSignedExerciseImages } from '@/lib/training/media'

interface Params { params: Promise<{ token: string }> }
const responseHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params
  const admin = createAdminClient() as any
  const access = await resolveTrainingAccess(admin, token)
  if (!access) return NextResponse.json({ error: 'Link scaduto o revocato' }, { status: 404, headers: responseHeaders })
  const [clientResult, tenantResult, planResult, openResult, historyResult, appointmentsResult] = await Promise.all([
    admin.from('clients').select('full_name, active').eq('id', access.client_id).eq('tenant_id', access.tenant_id).single(),
    admin.from('tenants').select('name, logo_url, brand_primary, brand_accent, status').eq('id', access.tenant_id).single(),
    scopeToTrainingAccess(admin.from('training_plans').select('*'), access).order('updated_at', { ascending: false }),
    scopeToTrainingAccess(admin.from('training_sessions').select('*'), access).is('completed_at', null).maybeSingle(),
    scopeToTrainingAccess(admin.from('training_sessions').select('*'), access).not('completed_at', 'is', null)
      .order('completed_at', { ascending: false }).limit(20),
    scopeToTrainingAccess(admin.from('appointments').select(`id, start_at, end_at, status,
      services (name, color), profiles!appointments_staff_id_fkey (full_name)`), access)
      .order('start_at', { ascending: false }).limit(40),
  ])
  const error = [clientResult, tenantResult, planResult, openResult, historyResult, appointmentsResult].find(result => result.error)?.error
  if (error) return NextResponse.json({ error: 'Impossibile caricare l’area allenamento' }, { status: 500, headers: responseHeaders })
  const client = clientResult.data
  const tenant = tenantResult.data
  if (!client?.active || tenant?.status !== 'active') return NextResponse.json({ error: 'Accesso non disponibile' }, { status: 404, headers: responseHeaders })
  const [plans, openPlanSnapshot] = await Promise.all([
    Promise.all((planResult.data ?? []).map((item: any) => withSignedExerciseImages(admin, item))),
    withSignedExerciseImages(admin, openResult.data?.plan_snapshot),
  ])
  return NextResponse.json({
    client,
    tenant,
    plans, plan: plans[0] ?? null,
    openSession: openResult.data
      ? { ...openResult.data, plan_snapshot: openPlanSnapshot }
      : null,
    history: historyResult.data ?? [],
    appointments: appointmentsResult.data ?? [],
  }, { headers: responseHeaders })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params
  const parsed = sessionActionSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Dati sessione non validi' }, { status: 422, headers: responseHeaders })
  const admin = createAdminClient() as any
  const values = parsed.data.action === 'start'
    ? { p_hash: hashTrainingToken(token), p_action: 'start', p_plan_id: parsed.data.planId ?? null }
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
  const session = data?.plan_snapshot
    ? { ...data, plan_snapshot: await withSignedExerciseImages(admin, data.plan_snapshot) }
    : data
  return NextResponse.json({ session }, { headers: responseHeaders })
}
