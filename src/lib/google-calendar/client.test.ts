import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  googleEventIdForAppointment,
  isWritableGoogleCalendar,
  updateGoogleCalendarEvent,
} from './client.ts'

test('solo owner e writer possono essere calendari di destinazione', () => {
  assert.equal(isWritableGoogleCalendar('owner'), true)
  assert.equal(isWritableGoogleCalendar('writer'), true)
  assert.equal(isWritableGoogleCalendar('reader'), false)
  assert.equal(isWritableGoogleCalendar('freeBusyReader'), false)
})

test('genera un ID Google stabile e compatibile a partire dall appuntamento', () => {
  assert.equal(
    googleEventIdForAppointment('550e8400-e29b-41d4-a716-446655440000'),
    'ff550e8400e29b41d4a716446655440000'
  )
})

test('crea un evento e invia gli aggiornamenti agli invitati', async () => {
  const previous = globalThis.fetch
  let request: { url: string; init?: RequestInit } | undefined
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init }
    return new Response(JSON.stringify({ id: 'google-event' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const result = await createGoogleCalendarEvent('token', 'trainer@gmail.com', {
      id: 'ff12345',
      summary: 'Allenamento · Mario Rossi',
      start: { dateTime: '2026-10-24T08:00:00.000Z' },
      end: { dateTime: '2026-10-24T09:00:00.000Z' },
      attendees: [{ email: 'client@gmail.com' }],
    })

    assert.equal(result.id, 'google-event')
    assert.equal(request?.init?.method, 'POST')
    assert.match(request?.url ?? '', /trainer%40gmail\.com\/events\?sendUpdates=all$/)
    const body = JSON.parse(String(request?.init?.body))
    assert.equal(body.attendees[0].email, 'client@gmail.com')
  } finally {
    globalThis.fetch = previous
  }
})

test('aggiorna senza provare a modificare l ID immutabile di Google', async () => {
  const previous = globalThis.fetch
  let body: Record<string, unknown> | undefined
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ id: 'ff12345' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await updateGoogleCalendarEvent('token', 'primary', 'ff12345', {
      id: 'ff12345',
      summary: 'Appuntamento aggiornato',
      start: { dateTime: '2026-10-24T10:00:00.000Z' },
      end: { dateTime: '2026-10-24T11:00:00.000Z' },
    })
    assert.equal(body?.id, undefined)
    assert.equal(body?.summary, 'Appuntamento aggiornato')
  } finally {
    globalThis.fetch = previous
  }
})

test('la cancellazione e idempotente quando Google non trova piu l evento', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response('{}', { status: 404 })
  try {
    await assert.doesNotReject(
      deleteGoogleCalendarEvent('token', 'primary', 'ff12345')
    )
  } finally {
    globalThis.fetch = previous
  }
})
