import { NextRequest, NextResponse } from 'next/server'
import { nutritionPlanSchema } from '@/lib/nutrition/schemas'
import { getTrainingProfessionalContext } from '@/lib/training/professional-access'

interface Params { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessionalContext(id)
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data: tenant } = await ctx.admin.from('tenants').select('profession').eq('id', ctx.profile.tenant_id).single()
  if (tenant?.profession !== 'nutritionist') {
    return NextResponse.json({ error: 'Funzione disponibile per i nutrizionisti' }, { status: 403 })
  }

  const { data: plans, error } = await ctx.admin.from('nutrition_plans').select('*')
    .eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plans, plan: plans?.[0] ?? null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessionalContext(id)
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data: tenant } = await ctx.admin.from('tenants').select('profession').eq('id', ctx.profile.tenant_id).single()
  if (tenant?.profession !== 'nutritionist') {
    return NextResponse.json({ error: 'Funzione disponibile per i nutrizionisti' }, { status: 403 })
  }

  const parsed = nutritionPlanSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Piano alimentare non valido', details: parsed.error.flatten() }, { status: 422 })
  }

  if (parsed.data.id && !parsed.data.version) return NextResponse.json({ error: 'Versione mancante' }, { status: 422 })
  const values = {
    tenant_id: ctx.profile.tenant_id,
    client_id: id,
    professional_id: ctx.user.id,
    title: parsed.data.title,
    objective: parsed.data.objective,
    guidelines: parsed.data.guidelines,
    target_calories: parsed.data.targetCalories,
    days: parsed.data.days,
    starts_on: parsed.data.startsOn,
    ends_on: parsed.data.endsOn,
    initial_measurements: parsed.data.initialMeasurements,
    final_measurements: parsed.data.finalMeasurements,
    version: (parsed.data.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }
  const query = parsed.data.id
    ? ctx.admin.from('nutrition_plans').update(values).eq('id', parsed.data.id).eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).eq('version', parsed.data.version)
    : ctx.admin.from('nutrition_plans').insert(values)
  const { data, error } = await query.select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Piano modificato altrove o non disponibile. Ricarica.' }, { status: 409 })
  return NextResponse.json({ plan: data })
}
