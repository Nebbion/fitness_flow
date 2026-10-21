import assert from 'node:assert/strict'
import test from 'node:test'
import { isWritableGoogleCalendar } from './client.ts'

test('solo owner e writer possono essere calendari di destinazione', () => {
  assert.equal(isWritableGoogleCalendar('owner'), true)
  assert.equal(isWritableGoogleCalendar('writer'), true)
  assert.equal(isWritableGoogleCalendar('reader'), false)
  assert.equal(isWritableGoogleCalendar('freeBusyReader'), false)
})
