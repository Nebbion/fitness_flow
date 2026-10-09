import { z } from 'zod'
import { exerciseSchema, sessionEntriesSchema } from './schemas.ts'

export const progressRangeSchema = z.coerce.number().int().refine(
  value => [1, 3, 6, 12, 24].includes(value),
  { message: 'Intervallo non valido' }
)

const completedSessionSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  started_at: z.string().datetime({ offset: true }),
  completed_at: z.string().datetime({ offset: true }),
  notes: z.string().max(2000).default(''),
  plan_snapshot: z.object({
    title: z.string().default('Allenamento'),
    exercises: z.array(exerciseSchema),
  }),
  entries: sessionEntriesSchema,
})

export type CompletedTrainingSession = z.infer<typeof completedSessionSchema>

export interface ProgressPoint {
  sessionId: string
  completedAt: string
  maxLoadKg: number
  volumeKgReps: number
  reps: number
  sets: number
}

export interface ExerciseProgress {
  exerciseId: string
  name: string
  unit: 'kg'
  points: ProgressPoint[]
  bestLoadKg: number
  latestLoadKg: number
  firstLoadKg: number
  changePercent: number | null
}

export interface TrainingProgressStats {
  months: number
  periodStart: string
  periodEnd: string
  completedSessions: number
  totalSets: number
  totalReps: number
  totalVolumeKgReps: number
  sessionsWithVolume: number
  invalidSessions: number
  truncated: boolean
  insufficientHistory: boolean
  sessionSeries: Array<{
    sessionId: string
    completedAt: string
    volumeKgReps: number
    sets: number
    reps: number
  }>
  exercises: ExerciseProgress[]
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function progressRangeStart(months: number, now = new Date()) {
  const start = new Date(now)
  start.setUTCMonth(start.getUTCMonth() - months)
  return start
}

export function calculateTrainingProgress(
  rawSessions: unknown[],
  months: number,
  now = new Date(),
  truncated = false
): TrainingProgressStats {
  const periodStart = progressRangeStart(months, now)
  const sessions: CompletedTrainingSession[] = []
  let invalidSessions = 0

  for (const rawSession of rawSessions) {
    const parsed = completedSessionSchema.safeParse(rawSession)
    if (!parsed.success) {
      invalidSessions += 1
      continue
    }
    const completedAt = new Date(parsed.data.completed_at)
    if (completedAt >= periodStart && completedAt <= now) sessions.push(parsed.data)
  }
  sessions.sort((a, b) => a.completed_at.localeCompare(b.completed_at))

  const exerciseMap = new Map<string, ExerciseProgress>()
  const sessionSeries: TrainingProgressStats['sessionSeries'] = []
  let totalSets = 0
  let totalReps = 0
  let totalVolumeKgReps = 0
  let sessionsWithVolume = 0

  for (const session of sessions) {
    const exercises = new Map(session.plan_snapshot.exercises.map(exercise => [exercise.id, exercise]))
    let sessionSets = 0
    let sessionReps = 0
    let sessionVolume = 0

    for (const entry of session.entries) {
      const exercise = exercises.get(entry.exerciseId)
      if (!exercise) continue

      const recordedSets = entry.sets.filter(set =>
        set.reps !== null || set.weightKg !== null || set.notes.trim().length > 0
      )
      const loadedSets = recordedSets.filter(set =>
        set.reps !== null && set.reps > 0 && set.weightKg !== null && set.weightKg >= 0
      )
      sessionSets += recordedSets.length
      sessionReps += recordedSets.reduce((sum, set) => sum + (set.reps ?? 0), 0)

      if (!loadedSets.length) continue
      const point: ProgressPoint = {
        sessionId: session.id,
        completedAt: session.completed_at,
        maxLoadKg: round(Math.max(...loadedSets.map(set => set.weightKg ?? 0))),
        volumeKgReps: round(loadedSets.reduce(
          (sum, set) => sum + (set.reps ?? 0) * (set.weightKg ?? 0),
          0
        )),
        reps: loadedSets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
        sets: loadedSets.length,
      }
      sessionVolume += point.volumeKgReps

      const current = exerciseMap.get(exercise.id) ?? {
        exerciseId: exercise.id,
        name: exercise.name,
        unit: 'kg' as const,
        points: [],
        bestLoadKg: 0,
        latestLoadKg: 0,
        firstLoadKg: 0,
        changePercent: null,
      }
      current.name = exercise.name
      current.points.push(point)
      exerciseMap.set(exercise.id, current)
    }

    sessionVolume = round(sessionVolume)
    if (sessionVolume > 0) sessionsWithVolume += 1
    totalSets += sessionSets
    totalReps += sessionReps
    totalVolumeKgReps += sessionVolume
    sessionSeries.push({
      sessionId: session.id,
      completedAt: session.completed_at,
      volumeKgReps: sessionVolume,
      sets: sessionSets,
      reps: sessionReps,
    })
  }

  const exercises = [...exerciseMap.values()].map(exercise => {
    exercise.firstLoadKg = exercise.points[0]?.maxLoadKg ?? 0
    exercise.latestLoadKg = exercise.points.at(-1)?.maxLoadKg ?? 0
    exercise.bestLoadKg = Math.max(...exercise.points.map(point => point.maxLoadKg))
    exercise.changePercent = exercise.points.length >= 2 && exercise.firstLoadKg > 0
      ? round(((exercise.latestLoadKg - exercise.firstLoadKg) / exercise.firstLoadKg) * 100, 1)
      : null
    return exercise
  }).sort((a, b) => a.name.localeCompare(b.name, 'it'))

  return {
    months,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    completedSessions: sessions.length,
    totalSets,
    totalReps,
    totalVolumeKgReps: round(totalVolumeKgReps),
    sessionsWithVolume,
    invalidSessions,
    truncated,
    insufficientHistory: sessions.length < 2,
    sessionSeries,
    exercises,
  }
}

export function buildProgressAIInput(stats: TrainingProgressStats) {
  return {
    period: {
      months: stats.months,
      start: stats.periodStart,
      end: stats.periodEnd,
    },
    totals: {
      completedSessions: stats.completedSessions,
      recordedSets: stats.totalSets,
      recordedReps: stats.totalReps,
      volumeKgReps: stats.totalVolumeKgReps,
      sessionsWithVolume: stats.sessionsWithVolume,
    },
    dataQuality: {
      insufficientHistory: stats.insufficientHistory,
      invalidSessionsExcluded: stats.invalidSessions,
      truncated: stats.truncated,
    },
    exercises: stats.exercises.slice(0, 20).map(exercise => ({
      name: exercise.name,
      unit: exercise.unit,
      firstLoad: exercise.firstLoadKg,
      latestLoad: exercise.latestLoadKg,
      bestLoad: exercise.bestLoadKg,
      changePercent: exercise.changePercent,
      observations: exercise.points.map(point => ({
        date: point.completedAt,
        maxLoad: point.maxLoadKg,
        volumeKgReps: point.volumeKgReps,
      })),
    })),
  }
}
