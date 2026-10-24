import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeExerciseName,
  matchesExerciseImportSignature,
  ownsExerciseImportPath,
  prepareExtractedExercises,
} from './exercise-import.ts'

test('normalizza i nomi per evitare duplicati nella libreria', () => {
  assert.equal(normalizeExerciseName('  Bulgarian   Split Squat '), 'bulgarian split squat')
})

test('rifiuta file con contenuto diverso dal formato dichiarato', () => {
  assert.equal(matchesExerciseImportSignature(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg'), true)
  assert.equal(matchesExerciseImportSignature(new TextEncoder().encode('%PDF-1.7'), 'application/pdf'), true)
  assert.equal(matchesExerciseImportSignature(new TextEncoder().encode('<script>'), 'application/pdf'), false)
})

test('accetta soltanto file temporanei dello stesso professionista', () => {
  assert.equal(ownsExerciseImportPath('tenant/pro/file.jpg', 'tenant', 'pro'), true)
  assert.equal(ownsExerciseImportPath('tenant/other/file.jpg', 'tenant', 'pro'), false)
  assert.equal(ownsExerciseImportPath('tenant/pro/../other/file.jpg', 'tenant', 'pro'), false)
})

test('rende espliciti i valori predefiniti quando la scheda non e leggibile', () => {
  const [exercise] = prepareExtractedExercises({
    title: 'Scheda A',
    warnings: [],
    exercises: [{
      name: 'Squat',
      defaultSets: null,
      defaultReps: null,
      defaultWeightKg: null,
      defaultIsometrySeconds: null,
      notes: '',
      confidence: 'low',
    }],
  })

  assert.equal(exercise.defaultSets, 3)
  assert.equal(exercise.defaultReps, '8-12')
  assert.equal(exercise.needsReview, true)
  assert.equal(exercise.usedFallbackSets, true)
  assert.equal(exercise.usedFallbackReps, true)
})
