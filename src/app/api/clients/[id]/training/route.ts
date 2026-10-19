import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { trainingPlanSchema } from '@/lib/training/schemas'
import { getTrainingProfessionalContext } from '@/lib/training/professional-access'
import { ownsExerciseMediaPath, withSignedExerciseImages } from '@/lib/training/media'

interface Params { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessionalContext(id)
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const [plansResult, sessionsResult, accessResult] = await Promise.all([
    ctx.admin.from('training_plans').select('*').eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).order('updated_at', { ascending: false }),
    ctx.admin.from('training_sessions').select('*').eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).order('started_at', { ascending: false }).limit(100),
    ctx.admin.from('training_access').select('expires_at, revoked_at').eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).maybeSingle(),
  ])
  if ([plansResult, sessionsResult, accessResult].some(result => result.error)) return NextResponse.json({ error: 'Impossibile caricare le schede' }, { status: 500 })
  const plans = await Promise.all((plansResult.data ?? []).map((plan: any) => withSignedExerciseImages(ctx.admin, plan)))
  return NextResponse.json({
    plans, plan: plans[0] ?? null,
    sessions: sessionsResult.data ?? [],
    access: accessResult.data,
  })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessionalContext(id)
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const parsed = trainingPlanSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Scheda non valida', details: parsed.error.flatten() }, { status: 422 })
  const invalidImagePath = parsed.data.exercises.some(exercise =>
    exercise.images.some(image => !ownsExerciseMediaPath(image.path, ctx.profile.tenant_id))
  )
  if (invalidImagePath) return NextResponse.json({ error: 'Immagine esercizio non valida' }, { status: 422 })
  if (parsed.data.id && !parsed.data.version) return NextResponse.json({ error: 'Versione mancante' }, { status: 422 })
  const values = {
    tenant_id: ctx.profile.tenant_id,
    client_id: id,
    professional_id: ctx.client.assigned_staff_id ?? ctx.user.id,
    title: parsed.data.title,
    exercises: parsed.data.exercises,
    version: (parsed.data.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }
  const query = parsed.data.id
    ? ctx.admin.from('training_plans').update(values).eq('id', parsed.data.id).eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).eq('version', parsed.data.version)
    : ctx.admin.from('training_plans').insert(values)
  const { data, error } = await query.select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Scheda modificata altrove o non disponibile. Ricarica.' }, { status: 409 })
  return NextResponse.json({ plan: data })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessionalContext(id)
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const { data: plan } = await ctx.admin.from('training_plans').select('id').eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).limit(1).maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Salva prima una scheda di allenamento' }, { status: 409 })
  const body = await request.json().catch(() => ({}))
  const locale = body.locale === 'en' ? 'en' : 'it'
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60_000).toISOString()
  const { error } = await ctx.admin.from('training_access').upsert({
    client_id: id, tenant_id: ctx.profile.tenant_id, token_hash: tokenHash,
    expires_at: expiresAt, revoked_at: null,
  }, { onConflict: 'client_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: `${request.nextUrl.origin}/${locale}/train/${token}`, expiresAt })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessionalContext(id)
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  await ctx.admin.from('training_access').update({ revoked_at: new Date().toISOString() })
    .eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id)
  return NextResponse.json({ ok: true })
}
