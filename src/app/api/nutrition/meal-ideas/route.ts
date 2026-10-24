import { NextRequest, NextResponse } from 'next/server'
import { getNutritionProfessional } from '@/lib/training/professional-access'
import {
  mealIdeaInputSchema,
  withSignedMealIdeaImages,
} from '@/lib/nutrition/meal-ideas'

export async function GET() {
  const ctx = await getNutritionProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data, error } = await ctx.admin.from('meal_ideas').select('*')
    .eq('tenant_id', ctx.profile.tenant_id)
    .eq('professional_id', ctx.user.id)
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Idee Pasti non disponibili' }, { status: 503 })

  const ideas = await Promise.all((data ?? []).map(async (idea: any) => ({
    ...idea,
    images: await withSignedMealIdeaImages(ctx.admin, idea.images ?? []),
  })))
  return NextResponse.json({ ideas }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const ctx = await getNutritionProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const parsed = mealIdeaInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Idea pasto non valida' }, { status: 422 })
  }
  if (parsed.data.images.length > 0) {
    return NextResponse.json({ error: 'Crea prima l’idea, poi carica le immagini' }, { status: 422 })
  }

  const { data, error } = await ctx.admin.from('meal_ideas').insert({
    tenant_id: ctx.profile.tenant_id,
    professional_id: ctx.user.id,
    title: parsed.data.title,
    category: parsed.data.category,
    description: parsed.data.description,
    ingredients: parsed.data.ingredients,
    instructions: parsed.data.instructions,
    source_url: parsed.data.sourceUrl || null,
    images: parsed.data.images,
  }).select().single()
  if (error) return NextResponse.json({ error: 'Impossibile creare l’idea pasto' }, { status: 500 })
  return NextResponse.json({ idea: data }, { status: 201 })
}
