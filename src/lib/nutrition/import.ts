import { z } from 'zod'

export const NUTRITION_IMPORT_BUCKET = 'nutrition-imports'
export const NUTRITION_IMPORT_MAX_FILES = 6
export const NUTRITION_IMPORT_MAX_FILE_BYTES = 12 * 1024 * 1024
export const NUTRITION_IMPORT_MAX_TOTAL_BYTES = 25 * 1024 * 1024

export const nutritionImportMimeTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
} as const

export type NutritionImportMimeType = keyof typeof nutritionImportMimeTypes

export const nutritionImportFileSchema = z.object({
  path: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(180),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  size: z.number().int().positive().max(NUTRITION_IMPORT_MAX_FILE_BYTES),
})

const nullableNutrient = z.number().min(0).max(10_000).nullable()

export const nutritionPlanExtractionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  objective: z.string().trim().max(2000),
  guidelines: z.string().trim().max(8000),
  targetCalories: z.number().int().min(0).max(10_000).nullable(),
  days: z.array(z.object({
    label: z.string().trim().min(1).max(100),
    meals: z.array(z.object({
      name: z.string().trim().min(1).max(120),
      time: z.string().trim().max(20),
      notes: z.string().trim().max(2000),
      alternatives: z.string().trim().max(3000),
      foods: z.array(z.object({
        name: z.string().trim().min(1).max(160),
        quantity: z.string().trim().max(80),
        calories: nullableNutrient,
        proteinG: nullableNutrient,
        carbsG: nullableNutrient,
        fatG: nullableNutrient,
        notes: z.string().trim().max(500),
      })).max(30),
    })).min(1).max(12),
  })).min(1).max(14),
  warnings: z.array(z.string().trim().min(1).max(300)).max(30),
})

export type NutritionPlanExtraction = z.infer<typeof nutritionPlanExtractionSchema>

export function ownsNutritionImportPath(path: string, tenantId: string, professionalId: string) {
  const prefix = `${tenantId}/${professionalId}/`
  return path.startsWith(prefix) && !path.includes('..') && !path.includes('\\')
}

export function matchesNutritionImportSignature(bytes: Uint8Array, mimeType: NutritionImportMimeType) {
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

export function prepareNutritionPlanDraft(extraction: NutritionPlanExtraction) {
  return {
    title: extraction.title,
    objective: extraction.objective,
    guidelines: extraction.guidelines,
    targetCalories: extraction.targetCalories,
    startsOn: null,
    endsOn: null,
    days: extraction.days.map(day => ({
      id: crypto.randomUUID(),
      label: day.label,
      meals: day.meals.map(meal => ({
        id: crypto.randomUUID(),
        name: meal.name,
        time: meal.time,
        notes: meal.notes,
        alternatives: meal.alternatives,
        foods: meal.foods.map(food => ({ id: crypto.randomUUID(), ...food })),
      })),
    })),
    warnings: extraction.warnings,
  }
}
