import assert from 'node:assert/strict'
import test from 'node:test'
import { isMutationConfirmed, reconcilePendingMutation } from './autosave.ts'

test('retries an interrupted write with the same mutation while the server version is unchanged', () => {
  const pending = { mutationId: '11111111-1111-4111-8111-111111111111', version: 4 }
  assert.equal(reconcilePendingMutation({ version: 4, last_mutation: null }, pending), 'retry')
})

test('treats the exact mutation id as confirmation after a lost response', () => {
  const mutationId = '11111111-1111-4111-8111-111111111111'
  const session = { version: 5, last_mutation: mutationId }
  assert.equal(reconcilePendingMutation(session, { mutationId, version: 4 }), 'confirmed')
  assert.equal(isMutationConfirmed(session, mutationId), true)
})

test('does not overwrite a newer server version with a stale local mutation', () => {
  const pending = { mutationId: '11111111-1111-4111-8111-111111111111', version: 4 }
  assert.equal(reconcilePendingMutation({ version: 5, last_mutation: '22222222-2222-4222-8222-222222222222' }, pending), 'conflict')
})
