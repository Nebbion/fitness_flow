import test from 'node:test'
import assert from 'node:assert/strict'
import { forgotPasswordSchema, resetPasswordSchema } from './index.ts'

test('password recovery validates email without exposing account state', () => {
  assert.equal(forgotPasswordSchema.safeParse({ email: 'utente@example.com' }).success, true)
  assert.equal(forgotPasswordSchema.safeParse({ email: 'non-valida' }).success, false)
})

test('new password must meet length and confirmation requirements', () => {
  assert.equal(resetPasswordSchema.safeParse({ password: 'nuova-password', password_confirm: 'nuova-password' }).success, true)
  assert.equal(resetPasswordSchema.safeParse({ password: 'corta', password_confirm: 'corta' }).success, false)
  assert.equal(resetPasswordSchema.safeParse({ password: 'nuova-password', password_confirm: 'diversa-password' }).success, false)
})
