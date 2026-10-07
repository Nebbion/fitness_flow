import test from 'node:test'
import assert from 'node:assert/strict'
import { isSchedulerAuthorized } from './authorization.ts'

test('accepts the configured scheduler bearer token', () => {
  assert.equal(isSchedulerAuthorized('Bearer expected-secret', 'expected-secret'), true)
})

test('rejects missing, malformed and incorrect authorization', () => {
  assert.equal(isSchedulerAuthorized(null, 'expected-secret'), false)
  assert.equal(isSchedulerAuthorized('expected-secret', 'expected-secret'), false)
  assert.equal(isSchedulerAuthorized('Bearer wrong-secret', 'expected-secret'), false)
})

test('fails closed when the server secret is missing', () => {
  assert.equal(isSchedulerAuthorized('Bearer expected-secret', ''), false)
})
