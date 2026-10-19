import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { sessionActionSchema } from '@/lib/training/schemas'
import { withSignedExerciseImages } from '@/lib/training/media'

const headers = { 'Cache-Control': 'no-store' }
async function context() {
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, active, tenant_id').eq('id', user.id).single()
  if (profile?.role !== 'CLIENT' || !profile.active) return null
  const admin = createAdminClient() as any
  const { data: client } = await admin.from('clients').select('id, tenant_id, full_name')
    .eq('profile_id', user.id).eq('tenant_id', profile.tenant_id).eq('active', true).single()
  if (!client) return null
  const { data: tenant } = await admin.from('tenants').select('name, logo_url, brand_primary, status')
    .eq('id', client.tenant_id).single()
  if (tenant?.status !== 'active') return null
  return { user, client, tenant, admin }
}

export async function GET() {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'Accesso non disponibile' }, { status: 403, headers })
  const { client, tenant, admin } = ctx
  const scoped = (table: string) => admin.from(table).select('*').eq('client_id', client.id).eq('tenant_id', client.tenant_id)
  const [plan, open, history] = await Promise.all([
    scoped('training_plans').order('updated_at', { ascending: false }), scoped('training_sessions').is('completed_at', null).maybeSingle(),
    scoped('training_sessions').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(100),
  ])
  if ([plan, open, history].some(result => result.error)) return NextResponse.json({ error: 'Impossibile caricare gli allenamenti' }, { status: 500, headers })
  const plans = await Promise.all((plan.data ?? []).map((item: any) => withSignedExerciseImages(admin, item)))
  return NextResponse.json({ client, tenant, plans, plan: plans[0] ?? null,
    openSession: open.data ? { ...open.data, plan_snapshot: await withSignedExerciseImages(admin, open.data.plan_snapshot) } : null,
    history: history.data ?? [],
  }, { headers })
}

export async function POST(request: NextRequest) {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'Accesso non disponibile' }, { status: 403, headers })
  const parsed = sessionActionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dati sessione non validi' }, { status: 422, headers })
  const action = parsed.data
  const { data, error } = await ctx.admin.rpc('portal_training_session_write', {
    p_user: ctx.user.id, p_action: action.action, p_plan_id: action.action === 'start' ? action.planId ?? null : null,
    ...(action.action === 'start' ? {} : { p_id: action.sessionId, p_version: action.version,
      p_entries: action.entries, p_mutation: action.mutationId, p_notes: action.notes }),
  })
  if (error) return NextResponse.json({ error: error.message.includes('version_conflict')
    ? 'La sessione è cambiata in un’altra scheda. Ricarica prima di continuare.' : 'Impossibile salvare la sessione' },
    { status: error.message.includes('version_conflict') ? 409 : 422, headers })
  return NextResponse.json({ session: { ...data, plan_snapshot: await withSignedExerciseImages(ctx.admin, data.plan_snapshot) } }, { headers })
}
