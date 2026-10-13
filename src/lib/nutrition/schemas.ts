import { z } from 'zod'

const optionalNutrient = z.number().min(0).max(10_000).nullable().default(null)

export const nutritionFoodSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  quantity: z.string().trim().max(80).default(''),
  calories: optionalNutrient,
  proteinG: optionalNutrient,
  carbsG: optionalNutrient,
  fatG: optionalNutrient,
  notes: z.string().trim().max(500).default(''),
})

export const nutritionMealSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  time: z.string().trim().max(20).default(''),
  notes: z.string().trim().max(2_000).default(''),
  alternatives: z.string().trim().max(3_000).default(''),
  foods: z.array(nutritionFoodSchema).max(30),
})

export const nutritionDaySchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(100),
  meals: z.array(nutritionMealSchema).min(1).max(12),
})

export const nutritionPlanSchema = z.object({
  title: z.string().trim().min(1).max(160),
  objective: z.string().trim().max(2_000).default(''),
  guidelines: z.string().trim().max(8_000).default(''),
  targetCalories: z.number().int().min(0).max(10_000).nullable(),
  days: z.array(nutritionDaySchema).min(1).max(14),
})

export type NutritionFood = z.infer<typeof nutritionFoodSchema>
export type NutritionMeal = z.infer<typeof nutritionMealSchema>
export type NutritionDay = z.infer<typeof nutritionDaySchema>
export type NutritionPlanInput = z.infer<typeof nutritionPlanSchema>
