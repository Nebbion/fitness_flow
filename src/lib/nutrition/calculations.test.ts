import assert from 'node:assert/strict'
import test from 'node:test'
import { calculatePlanAverage, sumNutritionFoods, sumNutritionMeals } from './calculations.ts'
import type { NutritionDay, NutritionFood, NutritionMeal } from './schemas.ts'

const food = (patch: Partial<NutritionFood>): NutritionFood => ({
  id: crypto.randomUUID(), name: 'Alimento', quantity: '', calories: null,
  proteinG: null, carbsG: null, fatG: null, notes: '', ...patch,
})

const meal = (foods: NutritionFood[]): NutritionMeal => ({
  id: crypto.randomUUID(), name: 'Pasto', time: '', notes: '', alternatives: '', foods,
})

test('somma un nutriente soltanto quando tutti i valori necessari sono inseriti', () => {
  const totals = sumNutritionFoods([
    food({ calories: 300, proteinG: 20 }),
    food({ calories: 120, proteinG: null }),
  ])
  assert.deepEqual(totals, { calories: 420, proteinG: null, carbsG: null, fatG: null })
})

test('calcola totali giornalieri e media senza inventare dati mancanti', () => {
  const first = meal([food({ calories: 400, carbsG: 50 })])
  const second = meal([food({ calories: 600, carbsG: 70 })])
  assert.equal(sumNutritionMeals([first, second]).calories, 1000)

  const days: NutritionDay[] = [
    { id: crypto.randomUUID(), label: 'Lunedi', meals: [first, second] },
    { id: crypto.randomUUID(), label: 'Martedi', meals: [meal([food({ calories: 1400 })])] },
  ]
  assert.equal(calculatePlanAverage(days).calories, 1200)
  assert.equal(calculatePlanAverage(days).proteinG, null)
})
