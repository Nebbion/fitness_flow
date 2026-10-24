import { NextRequest, NextResponse } from 'next/server'
import { getNutritionProfessional } from '@/lib/training/professional-access'
import {
  MEAL_IDEA_MEDIA_BUCKET,
  mealIdeaInputSchema,
  ownsMealIdeaMediaPathForIdea,
} from '@/lib/nutrition/meal-ideas'

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getNutritionProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const parsed = mealIdeaInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Idea pasto non valida' }, { status: 422 })
  }
  if (parsed.data.images.some(image =>
    !ownsMealIdeaMediaPathForIdea(image.path, ctx.profile.tenant_id, ctx.user.id, id)
  )) {
    return NextResponse.json({ error: 'Immagine non valida' }, { status: 422 })
  }

  const { data: existing } = await ctx.admin.from('meal_ideas').select('images')
    .eq('id', id).eq('tenant_id', ctx.profile.tenant_id).eq('professional_id', ctx.user.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Idea pasto non trovata' }, { status: 404 })

  const { data, error } = await ctx.admin.from('meal_ideas').update({
    title: parsed.data.title,
    category: parsed.data.category,
    description: parsed.data.description,
    ingredients: parsed.data.ingredients,
    instructions: parsed.data.instructions,
    source_url: parsed.data.sourceUrl || null,
    images: parsed.data.images,
  }).eq('id', id).eq('tenant_id', ctx.profile.tenant_id).eq('professional_id', ctx.user.id).select().maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Idea pasto non trovata' }, { status: 404 })

  const keptPaths = new Set(parsed.data.images.map(image => image.path))
  const removedPaths = (existing.images ?? [])
    .map((image: any) => image?.path)
    .filter((path: unknown): path is string => typeof path === 'string' && !keptPaths.has(path))
  if (removedPaths.length) await ctx.admin.storage.from(MEAL_IDEA_MEDIA_BUCKET).remove(removedPaths)

  return NextResponse.json({ idea: data })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getNutritionProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data, error } = await ctx.admin.from('meal_ideas').delete()
    .eq('id', id).eq('tenant_id', ctx.profile.tenant_id).eq('professional_id', ctx.user.id)
    .select('id, images').maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Idea pasto non trovata' }, { status: 404 })

  const paths = (data.images ?? [])
    .map((image: any) => image?.path)
    .filter((path: unknown): path is string => typeof path === 'string')
  if (paths.length) await ctx.admin.storage.from(MEAL_IDEA_MEDIA_BUCKET).remove(paths)
  return NextResponse.json({ ok: true })
}
