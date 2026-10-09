import assert from 'node:assert/strict'
import test from 'node:test'
import { hashTrainingToken, isValidTrainingToken, resolveTrainingAccess } from './access.ts'

test('accepts only URL-safe training tokens with the expected entropy', () => {
  assert.equal(isValidTrainingToken('a'.repeat(40)), true)
  assert.equal(isValidTrainingToken('Abc_123-'.repeat(6)), true)
  assert.equal(isValidTrainingToken('short'), false)
  assert.equal(isValidTrainingToken(`${'a'.repeat(39)}!`), false)
  assert.equal(isValidTrainingToken('a'.repeat(101)), false)
})

test('hashes a token deterministically without retaining the original value', () => {
  const token = 'A'.repeat(43)
  const hash = hashTrainingToken(token)
  assert.equal(hash, hashTrainingToken(token))
  assert.equal(hash.length, 64)
  assert.equal(hash.includes(token), false)
})

test('does not query storage for an invalid token', async () => {
  let queried = false
  const admin = { from() { queried = true } }
  assert.equal(await resolveTrainingAccess(admin, 'invalid'), null)
  assert.equal(queried, false)
})

test('resolves only a non-revoked, non-expired hashed token', async () => {
  const calls: Array<[string, ...unknown[]]> = []
  const access = {
    client_id: '11111111-1111-4111-8111-111111111111',
    tenant_id: '22222222-2222-4222-8222-222222222222',
  }
  const query: any = {
    select(...args: unknown[]) { calls.push(['select', ...args]); return query },
    eq(...args: unknown[]) { calls.push(['eq', ...args]); return query },
    is(...args: unknown[]) { calls.push(['is', ...args]); return query },
    gt(...args: unknown[]) { calls.push(['gt', ...args]); return query },
    async maybeSingle() { return { data: access, error: null } },
  }
  const admin = { from(table: string) { calls.push(['from', table]); return query } }
  const token = 'a'.repeat(43)

  assert.deepEqual(await resolveTrainingAccess(admin, token), access)
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'token_hash' && call[2] === hashTrainingToken(token)))
  assert.ok(calls.some(call => call[0] === 'is' && call[1] === 'revoked_at' && call[2] === null))
  assert.ok(calls.some(call => call[0] === 'gt' && call[1] === 'expires_at'))
})
