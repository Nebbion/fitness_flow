import type { NutritionDay, NutritionFood, NutritionMeal } from './schemas'

export interface NutritionTotals {
  calories: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
}

const nutrientKeys = ['calories', 'proteinG', 'carbsG', 'fatG'] as const

export function sumNutritionFoods(foods: NutritionFood[]): NutritionTotals {
  const cumulativeFoods = foods.filter(food => food.mode !== 'alternative')
  return Object.fromEntries(nutrientKeys.map(key => {
    const values = cumulativeFoods.map(food => food[key])
    const complete = values.length > 0 && values.every((value): value is number => typeof value === 'number')
    return [key, complete ? values.reduce((sum, value) => sum + value, 0) : null]
  })) as unknown as NutritionTotals
}

export function sumNutritionMeals(meals: NutritionMeal[]): NutritionTotals {
  const totals = meals.map(meal => sumNutritionFoods(meal.foods))
  return Object.fromEntries(nutrientKeys.map(key => {
    const values = totals.map(total => total[key])
    const complete = values.length > 0 && values.every((value): value is number => typeof value === 'number')
    return [key, complete ? values.reduce((sum, value) => sum + value, 0) : null]
  })) as unknown as NutritionTotals
}

export function calculatePlanAverage(days: NutritionDay[]): NutritionTotals {
  const totals = days.map(day => sumNutritionMeals(day.meals))
  return Object.fromEntries(nutrientKeys.map(key => {
    const values = totals.map(total => total[key])
    const complete = values.length > 0 && values.every((value): value is number => typeof value === 'number')
    return [key, complete ? values.reduce((sum, value) => sum + value, 0) / values.length : null]
  })) as unknown as NutritionTotals
}
