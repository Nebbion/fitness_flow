import assert from 'node:assert/strict'
import test from 'node:test'
import { getSessionIdleRemaining, SESSION_IDLE_TIMEOUT_MS } from './session-timeout.ts'

test('la sessione inattiva scade esattamente dopo 10 minuti', () => {
  const startedAt = 1_000_000

  assert.equal(getSessionIdleRemaining(startedAt, startedAt), SESSION_IDLE_TIMEOUT_MS)
  assert.equal(getSessionIdleRemaining(startedAt, startedAt + SESSION_IDLE_TIMEOUT_MS - 1), 1)
  assert.equal(getSessionIdleRemaining(startedAt, startedAt + SESSION_IDLE_TIMEOUT_MS), 0)
})

test('timestamp non validi sono considerati scaduti', () => {
  assert.equal(getSessionIdleRemaining(0), 0)
  assert.equal(getSessionIdleRemaining(Number.NaN), 0)
})
