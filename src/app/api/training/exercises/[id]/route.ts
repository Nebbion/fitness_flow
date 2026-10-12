import { NextRequest, NextResponse } from 'next/server'
import { exerciseLibraryInputSchema } from '@/lib/training/schemas'
import { getTrainingProfessional } from '@/lib/training/professional-access'
import { ownsExerciseMediaPath } from '@/lib/training/media'

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const parsed = exerciseLibraryInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Esercizio non valido' }, { status: 422 })
  if (parsed.data.images.some(image => !ownsExerciseMediaPath(image.path, ctx.profile.tenant_id, ctx.user.id))) {
    return NextResponse.json({ error: 'Immagine esercizio non valida' }, { status: 422 })
  }

  const { data, error } = await ctx.admin.from('training_exercise_library').update({
    name: parsed.data.name,
    default_sets: parsed.data.defaultSets,
    default_reps: parsed.data.defaultReps,
    notes: parsed.data.notes,
    images: parsed.data.images,
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('tenant_id', ctx.profile.tenant_id).eq('professional_id', ctx.user.id).select().maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Esercizio non trovato' }, { status: 404 })
  return NextResponse.json({ exercise: data })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const { data, error } = await ctx.admin.from('training_exercise_library').delete()
    .eq('id', id).eq('tenant_id', ctx.profile.tenant_id).eq('professional_id', ctx.user.id).select('id').maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Esercizio non trovato' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
