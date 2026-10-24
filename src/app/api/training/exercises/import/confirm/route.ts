import { NextRequest, NextResponse } from 'next/server'
import { getTrainingProfessional } from '@/lib/training/professional-access'
import {
  confirmExerciseImportSchema,
  normalizeExerciseName,
} from '@/lib/training/exercise-import'

export async function POST(request: NextRequest) {
  const ctx = await getTrainingProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const parsed = confirmExerciseImportSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Correggi gli esercizi evidenziati prima di importarli' }, { status: 422 })
  }

  const { data: existing, error: existingError } = await ctx.admin
    .from('training_exercise_library')
    .select('id, name')
    .eq('tenant_id', ctx.profile.tenant_id)
    .eq('professional_id', ctx.user.id)
  if (existingError) {
    return NextResponse.json({ error: 'Libreria esercizi non disponibile' }, { status: 503 })
  }

  const knownNames = new Set((existing ?? []).map((item: any) => normalizeExerciseName(item.name)))
  const skipped: string[] = []
  const rows: Array<Record<string, unknown>> = []

  for (const exercise of parsed.data.exercises) {
    const normalizedName = normalizeExerciseName(exercise.name)
    if (knownNames.has(normalizedName)) {
      skipped.push(exercise.name)
      continue
    }
    knownNames.add(normalizedName)
    rows.push({
      tenant_id: ctx.profile.tenant_id,
      professional_id: ctx.user.id,
      name: exercise.name.trim().replace(/\s+/g, ' '),
      default_sets: exercise.defaultSets,
      default_reps: exercise.defaultReps,
      default_weight_kg: exercise.defaultWeightKg,
      default_isometry_seconds: exercise.defaultIsometrySeconds,
      notes: exercise.notes,
      images: [],
    })
  }

  if (!rows.length) {
    return NextResponse.json({ created: [], skipped })
  }

  const { data: created, error } = await ctx.admin
    .from('training_exercise_library')
    .insert(rows)
    .select()
  if (error) {
    console.error('Exercise sheet import save error:', error)
    return NextResponse.json({ error: 'Impossibile salvare gli esercizi importati' }, { status: 500 })
  }

  return NextResponse.json({ created: created ?? [], skipped }, { status: 201 })
}

