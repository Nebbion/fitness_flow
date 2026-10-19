import { NextRequest, NextResponse } from 'next/server'
import { exerciseLibraryInputSchema } from '@/lib/training/schemas'
import { getTrainingProfessional } from '@/lib/training/professional-access'
import { ownsExerciseMediaPath, withSignedImages } from '@/lib/training/media'

export async function GET() {
  const ctx = await getTrainingProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data, error } = await ctx.admin.from('training_exercise_library').select('*')
    .eq('tenant_id', ctx.profile.tenant_id).eq('professional_id', ctx.user.id).order('name')
  if (error) return NextResponse.json({ error: 'Libreria esercizi non disponibile' }, { status: 503 })

  const exercises = await Promise.all((data ?? []).map(async (exercise: any) => ({
    ...exercise,
    images: await withSignedImages(ctx.admin, exercise.images ?? []),
  })))
  return NextResponse.json({ exercises })
}

export async function POST(request: NextRequest) {
  const ctx = await getTrainingProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const parsed = exerciseLibraryInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Esercizio non valido' }, { status: 422 })
  if (parsed.data.images.some(image => !ownsExerciseMediaPath(image.path, ctx.profile.tenant_id, ctx.user.id))) {
    return NextResponse.json({ error: 'Immagine esercizio non valida' }, { status: 422 })
  }

  const { data, error } = await ctx.admin.from('training_exercise_library').insert({
    tenant_id: ctx.profile.tenant_id,
    professional_id: ctx.user.id,
    name: parsed.data.name,
    default_sets: parsed.data.defaultSets,
    default_reps: parsed.data.defaultReps,
    default_weight_kg: parsed.data.defaultWeightKg,
    notes: parsed.data.notes,
    images: parsed.data.images,
  }).select().single()
  if (error) return NextResponse.json({ error: 'Impossibile creare l’esercizio' }, { status: 500 })
  return NextResponse.json({ exercise: data }, { status: 201 })
}
