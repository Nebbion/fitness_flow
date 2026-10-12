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
  const [{ data: plan }, { data: sessions }, { data: access }] = await Promise.all([
    ctx.admin.from('training_plans').select('*').eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).maybeSingle(),
    ctx.admin.from('training_sessions').select('*').eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).order('started_at', { ascending: false }).limit(100),
    ctx.admin.from('training_access').select('expires_at, revoked_at').eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).maybeSingle(),
  ])
  return NextResponse.json({
    plan: await withSignedExerciseImages(ctx.admin, plan),
    sessions: sessions ?? [],
    access,
  })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessionalContext(id)
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const parsed = trainingPlanSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Scheda non valida', details: parsed.error.flatten() }, { status: 422 })
  const invalidImagePath = parsed.data.exercises.some(exercise =>
    exercise.images.some(image => !ownsExerciseMediaPath(image.path, ctx.profile.tenant_id))
  )
  if (invalidImagePath) return NextResponse.json({ error: 'Immagine esercizio non valida' }, { status: 422 })
  const { data: current } = await ctx.admin.from('training_plans').select('version').eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).maybeSingle()
  const { data, error } = await ctx.admin.from('training_plans').upsert({
    tenant_id: ctx.profile.tenant_id,
    client_id: id,
    professional_id: ctx.client.assigned_staff_id ?? ctx.user.id,
    title: parsed.data.title,
    exercises: parsed.data.exercises,
    version: (current?.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessionalContext(id)
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const { data: plan } = await ctx.admin.from('training_plans').select('id').eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).maybeSingle()
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
