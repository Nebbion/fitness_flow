import { z } from 'zod'

export const EXERCISE_IMPORT_BUCKET = 'training-imports'
export const EXERCISE_IMPORT_MAX_FILES = 6
export const EXERCISE_IMPORT_MAX_FILE_BYTES = 8 * 1024 * 1024
export const EXERCISE_IMPORT_MAX_TOTAL_BYTES = 20 * 1024 * 1024

export const exerciseImportMimeTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
} as const

export type ExerciseImportMimeType = keyof typeof exerciseImportMimeTypes

export const exerciseImportFileSchema = z.object({
  path: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(180),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  size: z.number().int().positive().max(EXERCISE_IMPORT_MAX_FILE_BYTES),
})

export const extractedExerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  defaultSets: z.number().int().min(1).max(20).nullable(),
  defaultReps: z.string().trim().min(1).max(30).nullable(),
  defaultWeightKg: z.number().min(0).max(2000).nullable(),
  defaultIsometrySeconds: z.number().int().min(1).max(3600).nullable(),
  notes: z.string().max(500),
  confidence: z.enum(['high', 'medium', 'low']),
})

export const exerciseSheetExtractionSchema = z.object({
  title: z.string().trim().max(120),
  exercises: z.array(extractedExerciseSchema).min(1).max(60),
  warnings: z.array(z.string().trim().min(1).max(300)).max(20),
})

export const importedExerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  defaultSets: z.number().int().min(1).max(20),
  defaultReps: z.string().trim().min(1).max(30),
  defaultWeightKg: z.number().min(0).max(2000).nullable(),
  defaultIsometrySeconds: z.number().int().min(1).max(3600).nullable(),
  notes: z.string().max(500),
})

export const confirmExerciseImportSchema = z.object({
  exercises: z.array(importedExerciseSchema).min(1).max(60),
})

export type ExerciseSheetExtraction = z.infer<typeof exerciseSheetExtractionSchema>
export type ImportedExercise = z.infer<typeof importedExerciseSchema>

export function normalizeExerciseName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it')
}

export function ownsExerciseImportPath(path: string, tenantId: string, professionalId: string) {
  const prefix = `${tenantId}/${professionalId}/`
  return path.startsWith(prefix) && !path.includes('..') && !path.includes('\\')
}

export function matchesExerciseImportSignature(bytes: Uint8Array, mimeType: ExerciseImportMimeType) {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === 'image/png') {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  }
  return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-'
}

export function prepareExtractedExercises(extraction: ExerciseSheetExtraction) {
  return extraction.exercises.map(exercise => ({
    name: exercise.name.trim(),
    defaultSets: exercise.defaultSets ?? 3,
    defaultReps: exercise.defaultReps ?? '8-12',
    defaultWeightKg: exercise.defaultWeightKg,
    defaultIsometrySeconds: exercise.defaultIsometrySeconds,
    notes: exercise.notes,
    confidence: exercise.confidence,
    needsReview: exercise.confidence !== 'high' || exercise.defaultSets == null || exercise.defaultReps == null,
    usedFallbackSets: exercise.defaultSets == null,
    usedFallbackReps: exercise.defaultReps == null,
  }))
}
