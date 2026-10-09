import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProgressAIInput, calculateTrainingProgress } from './progress.ts'

const NOW = new Date('2026-10-09T12:00:00.000Z')
const SQUAT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_SQUAT_ID = '22222222-2222-4222-8222-222222222222'

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    version: 2,
    started_at: '2026-09-01T08:00:00.000Z',
    completed_at: '2026-09-01T09:00:00.000Z',
    notes: 'nota privata della sessione',
    plan_snapshot: {
      title: 'Scheda storica',
      exercises: [{ id: SQUAT_ID, name: 'Squat', targetSets: 3, targetReps: '8', notes: '' }],
    },
    entries: [{
      exerciseId: SQUAT_ID,
      notes: 'nota privata esercizio',
      sets: [
        { reps: 8, weightKg: 50, notes: '' },
        { reps: 8, weightKg: 55, notes: 'ultima serie' },
        { reps: null, weightKg: null, notes: 'saltata' },
      ],
    }],
    ...overrides,
  }
}

test('calculates volume, recorded sets and load trend from completed values only', () => {
  const second = session({
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    completed_at: '2026-10-01T09:00:00.000Z',
    entries: [{
      exerciseId: SQUAT_ID,
      notes: '',
      sets: [
        { reps: 6, weightKg: 60, notes: '' },
        { reps: 6, weightKg: null, notes: '' },
      ],
    }],
  })
  const stats = calculateTrainingProgress([second, session()], 3, NOW)

  assert.equal(stats.completedSessions, 2)
  assert.equal(stats.totalSets, 5)
  assert.equal(stats.totalReps, 28)
  assert.equal(stats.totalVolumeKgReps, 1200)
  assert.equal(stats.sessionsWithVolume, 2)
  assert.equal(stats.exercises[0].firstLoadKg, 55)
  assert.equal(stats.exercises[0].latestLoadKg, 60)
  assert.equal(stats.exercises[0].changePercent, 9.1)
})

test('keeps exercises with different stable IDs separate even when names match', () => {
  const renamed = session({
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    completed_at: '2026-10-02T09:00:00.000Z',
    plan_snapshot: {
      title: 'Nuova scheda',
      exercises: [{ id: OTHER_SQUAT_ID, name: 'Squat', targetSets: 1, targetReps: '5', notes: '' }],
    },
    entries: [{ exerciseId: OTHER_SQUAT_ID, notes: '', sets: [{ reps: 5, weightKg: 80, notes: '' }] }],
  })
  const stats = calculateTrainingProgress([session(), renamed], 3, NOW)

  assert.equal(stats.exercises.length, 2)
  assert.deepEqual(new Set(stats.exercises.map(item => item.exerciseId)), new Set([SQUAT_ID, OTHER_SQUAT_ID]))
})

test('excludes malformed and out-of-range sessions instead of inventing values', () => {
  const old = session({ completed_at: '2025-01-01T09:00:00.000Z' })
  const stats = calculateTrainingProgress([{ incomplete: true }, old], 1, NOW)

  assert.equal(stats.completedSessions, 0)
  assert.equal(stats.invalidSessions, 1)
  assert.equal(stats.totalVolumeKgReps, 0)
  assert.equal(stats.insufficientHistory, true)
})

test('AI input contains aggregates but no session IDs or private notes', () => {
  const stats = calculateTrainingProgress([session()], 3, NOW)
  const serialized = JSON.stringify(buildProgressAIInput(stats))

  assert.match(serialized, /Squat/)
  assert.match(serialized, /volumeKgReps/)
  assert.doesNotMatch(serialized, /aaaaaaaa-aaaa/)
  assert.doesNotMatch(serialized, /nota privata/)
})
