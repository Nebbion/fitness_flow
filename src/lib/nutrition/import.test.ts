import test from 'node:test'
import assert from 'node:assert/strict'
import {
  matchesNutritionImportSignature,
  ownsNutritionImportPath,
  prepareNutritionPlanDraft,
} from './import.ts'

test('i file temporanei nutrizione non possono uscire dal tenant/professionista', () => {
  assert.equal(ownsNutritionImportPath('tenant/pro/file.pdf', 'tenant', 'pro'), true)
  assert.equal(ownsNutritionImportPath('tenant/altro/file.pdf', 'tenant', 'pro'), false)
  assert.equal(ownsNutritionImportPath('tenant/pro/../altro.pdf', 'tenant', 'pro'), false)
})

test('la firma PDF deve corrispondere al MIME dichiarato', () => {
  const pdf = new TextEncoder().encode('%PDF-1.7')
  assert.equal(matchesNutritionImportSignature(pdf, 'application/pdf'), true)
  assert.equal(matchesNutritionImportSignature(pdf, 'image/png'), false)
})

test('la bozza importata riceve identificativi nuovi senza inventare nutrienti', () => {
  const draft = prepareNutritionPlanDraft({
    title: 'Piano importato', objective: '', guidelines: '', targetCalories: null, warnings: [],
    days: [{ label: 'Giorno tipo', meals: [{
      name: 'Colazione', time: '', notes: '', alternatives: '', foods: [{
        name: 'Avena', quantity: '80 g', calories: null, proteinG: null, carbsG: null, fatG: null, notes: '',
      }],
    }] }],
  })
  assert.match(draft.days[0].id, /^[0-9a-f-]{36}$/)
  assert.match(draft.days[0].meals[0].foods[0].id, /^[0-9a-f-]{36}$/)
  assert.equal(draft.days[0].meals[0].foods[0].calories, null)
})
