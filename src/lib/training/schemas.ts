import { z } from 'zod'

export const exerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  targetSets: z.number().int().min(1).max(20),
  targetReps: z.string().trim().min(1).max(30),
  notes: z.string().max(500).default(''),
})

export const trainingPlanSchema = z.object({
  title: z.string().trim().min(2).max(120),
  exercises: z.array(exerciseSchema).min(1).max(60),
})

const setEntrySchema = z.object({
  reps: z.number().int().min(0).max(1000).nullable(),
  weightKg: z.number().min(0).max(2000).nullable(),
  notes: z.string().max(300).default(''),
})

export const sessionEntriesSchema = z.array(z.object({
  exerciseId: z.string().uuid(),
  sets: z.array(setEntrySchema).min(1).max(30),
  notes: z.string().max(1000).default(''),
})).max(60)

export const sessionActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({
    action: z.enum(['save', 'complete']),
    sessionId: z.string().uuid(),
    version: z.number().int().positive(),
    mutationId: z.string().uuid(),
    entries: sessionEntriesSchema,
    notes: z.string().max(2000).default(''),
  }),
])

export type TrainingPlanInput = z.infer<typeof trainingPlanSchema>
export type SessionEntries = z.infer<typeof sessionEntriesSchema>
