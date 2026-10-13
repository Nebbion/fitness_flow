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

  const { data: plan, error } = await ctx.admin.from('nutrition_plans').select('*')
    .eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessionalContext(id)
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data: tenant } = await ctx.admin.from('tenants').select('profession').eq('id', ctx.profile.tenant_id).single()
  if (tenant?.profession !== 'nutritionist') {
    return NextResponse.json({ error: 'Funzione disponibile per i nutrizionisti' }, { status: 403 })
  }

  const parsed = nutritionPlanSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Piano alimentare non valido', details: parsed.error.flatten() }, { status: 422 })
  }

  const { data: current } = await ctx.admin.from('nutrition_plans').select('version')
    .eq('client_id', id).eq('tenant_id', ctx.profile.tenant_id).maybeSingle()
  const { data, error } = await ctx.admin.from('nutrition_plans').upsert({
    tenant_id: ctx.profile.tenant_id,
    client_id: id,
    professional_id: ctx.user.id,
    title: parsed.data.title,
    objective: parsed.data.objective,
    guidelines: parsed.data.guidelines,
    target_calories: parsed.data.targetCalories,
    days: parsed.data.days,
    version: (current?.version ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}
