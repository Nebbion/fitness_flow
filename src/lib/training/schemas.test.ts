import test from 'node:test'
import assert from 'node:assert/strict'
import { exerciseLibraryInputSchema, sessionActionSchema, sessionEntriesSchema, trainingPlanSchema } from './schemas.ts'

test('session start preserves the selected plan identifier and rejects malformed ids', () => {
  const planId = crypto.randomUUID()
  assert.equal(sessionActionSchema.parse({ action: 'start', planId }).action, 'start')
  assert.deepEqual(sessionActionSchema.parse({ action: 'start', planId }), { action: 'start', planId })
  assert.equal(sessionActionSchema.safeParse({ action: 'start', planId: 'foreign-or-invalid' }).success, false)
})

test('isometry is optional for existing plans and retained when assigned', () => {
  const exercise = { id: crypto.randomUUID(), name: 'Plank', targetSets: 3, targetReps: '1' }
  assert.equal(trainingPlanSchema.parse({ title: 'Scheda', exercises: [exercise] }).exercises[0].isometrySeconds, null)
  assert.equal(trainingPlanSchema.parse({ title: 'Scheda', exercises: [{ ...exercise, isometrySeconds: 30 }] }).exercises[0].isometrySeconds, 30)
  assert.equal(exerciseLibraryInputSchema.parse({ name: 'Plank', defaultIsometrySeconds: 30 }).defaultIsometrySeconds, 30)
  for (const invalid of [0, -1, 1.5, 3601]) {
    assert.equal(exerciseLibraryInputSchema.safeParse({ name: 'Plank', defaultIsometrySeconds: invalid }).success, false)
    assert.equal(trainingPlanSchema.safeParse({ title: 'Scheda', exercises: [{ ...exercise, isometrySeconds: invalid }] }).success, false)
  }
})

test('recommended weights preserve zero and decimals and reject invalid loads', () => {
  for (const weight of [null, 0, 20, 30.5]) {
    assert.equal(exerciseLibraryInputSchema.parse({ name: 'Squat', defaultWeightKg: weight }).defaultWeightKg, weight)
  }
  for (const weight of [-1, 2001]) {
    assert.equal(exerciseLibraryInputSchema.safeParse({ name: 'Squat', defaultWeightKg: weight }).success, false)
  }
})

test('duplicate exercise entries cannot produce ambiguous weight history', () => {
  const entry = { exerciseId: crypto.randomUUID(), sets: [{ reps: 8, weightKg: 20 }] }
  assert.equal(sessionEntriesSchema.safeParse([entry, entry]).success, false)
})

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

test('exercise library accepts image metadata and limits each gallery to six items', () => {
  const image = { path: `${crypto.randomUUID()}/exercise/image.webp`, alt: 'Posizione iniziale' }
  assert.equal(exerciseLibraryInputSchema.safeParse({
    name: 'Squat', defaultSets: 3, defaultReps: '8-12', notes: '', images: [image],
  }).success, true)
  assert.equal(exerciseLibraryInputSchema.safeParse({
    name: 'Squat', defaultSets: 3, defaultReps: '8-12', notes: '', images: Array(7).fill(image),
  }).success, false)
})
