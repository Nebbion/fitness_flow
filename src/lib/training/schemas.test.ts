import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionEntriesSchema, trainingPlanSchema } from './schemas.ts'

test('training plan requires stable exercise ids and bounded sets', () => {
  assert.equal(trainingPlanSchema.safeParse({
    title: 'Forza A',
    exercises: [{ id: crypto.randomUUID(), name: 'Squat', targetSets: 3, targetReps: '8', notes: '' }],
  }).success, true)
  assert.equal(trainingPlanSchema.safeParse({
    title: 'Forza A',
    exercises: [{ id: 'not-an-id', name: 'Squat', targetSets: 40, targetReps: '8', notes: '' }],
  }).success, false)
})

test('session values reject unsafe ranges', () => {
  assert.equal(sessionEntriesSchema.safeParse([{
    exerciseId: crypto.randomUUID(),
    sets: [{ reps: 10, weightKg: 80.5, notes: '' }],
    notes: '',
  }]).success, true)
  assert.equal(sessionEntriesSchema.safeParse([{
    exerciseId: crypto.randomUUID(),
    sets: [{ reps: -1, weightKg: 80, notes: '' }],
    notes: '',
  }]).success, false)
})
