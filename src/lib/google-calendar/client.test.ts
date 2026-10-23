import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  ensureGoogleCalendarEventLabel,
  GOOGLE_CALENDAR_LABELS_SCOPE,
  GOOGLE_CALENDAR_SCOPES,
  googleEventIdForAppointment,
  isWritableGoogleCalendar,
  listGoogleCalendarEvents,
  updateGoogleCalendarEvent,
  updateGoogleCalendarEventLabel,
} from './client.ts'

test('solo owner e writer possono essere calendari di destinazione', () => {
  assert.equal(isWritableGoogleCalendar('owner'), true)
  assert.equal(isWritableGoogleCalendar('writer'), true)
  assert.equal(isWritableGoogleCalendar('reader'), false)
  assert.equal(isWritableGoogleCalendar('freeBusyReader'), false)
})

test('richiede lo scope per gestire le etichette del calendario', () => {
  assert.equal(GOOGLE_CALENDAR_SCOPES.includes(GOOGLE_CALENDAR_LABELS_SCOPE), true)
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
      eventLabelId: '550e8400-e29b-41d4-a716-446655440000',
      start: { dateTime: '2026-10-24T08:00:00.000Z' },
      end: { dateTime: '2026-10-24T09:00:00.000Z' },
      attendees: [{ email: 'client@gmail.com' }],
    })

    assert.equal(result.id, 'google-event')
    assert.equal(request?.init?.method, 'POST')
    const requestUrl = new URL(request?.url ?? '')
    assert.match(requestUrl.pathname, /trainer%40gmail\.com\/events$/)
    assert.equal(requestUrl.searchParams.get('sendUpdates'), 'all')
    assert.equal(requestUrl.searchParams.get('eventLabelVersion'), '1')
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

test('legge eventi e risposte invitati da tutte le pagine Google', async () => {
  const previous = globalThis.fetch
  const requests: string[] = []
  globalThis.fetch = async (input) => {
    const url = String(input)
    requests.push(url)
    const nextPage = new URL(url).searchParams.get('pageToken')
    return new Response(JSON.stringify(nextPage ? {
      items: [{ id: 'ff2', status: 'cancelled' }],
    } : {
      items: [{
        id: 'ff1',
        status: 'confirmed',
        attendees: [{ email: 'client@gmail.com', responseStatus: 'declined' }],
      }],
      nextPageToken: 'page-2',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const events = await listGoogleCalendarEvents({
      accessToken: 'token',
      calendarId: 'primary',
      timeMin: '2026-10-01T00:00:00.000Z',
      timeMax: '2026-11-01T00:00:00.000Z',
    })

    assert.equal(events.length, 2)
    assert.equal(events[0].attendees?.[0].responseStatus, 'declined')
    assert.equal(events[1].status, 'cancelled')
    assert.equal(requests.length, 2)
    const firstRequest = new URL(requests[0])
    assert.equal(firstRequest.searchParams.get('singleEvents'), 'true')
    assert.equal(firstRequest.searchParams.get('showDeleted'), 'true')
    assert.equal(firstRequest.searchParams.get('eventLabelVersion'), '1')
    assert.equal(firstRequest.searchParams.get('timeMin'), '2026-10-01T00:00:00.000Z')
    assert.equal(new URL(requests[1]).searchParams.get('pageToken'), 'page-2')
  } finally {
    globalThis.fetch = previous
  }
})

test('aggiorna solo l etichetta senza notificare nuovamente gli invitati', async () => {
  const previous = globalThis.fetch
  let request: { url: string; init?: RequestInit } | undefined
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), init }
    return new Response(JSON.stringify({ id: 'ff12345' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await updateGoogleCalendarEventLabel(
      'token',
      'primary',
      'ff12345',
      '22222222-2222-4222-8222-222222222222'
    )
    const requestUrl = new URL(request?.url ?? '')
    assert.equal(request?.init?.method, 'PATCH')
    assert.equal(requestUrl.searchParams.get('eventLabelVersion'), '1')
    assert.equal(requestUrl.searchParams.get('sendUpdates'), 'none')
    assert.deepEqual(JSON.parse(String(request?.init?.body)), {
      eventLabelId: '22222222-2222-4222-8222-222222222222',
    })
  } finally {
    globalThis.fetch = previous
  }
})

test('aggiunge una etichetta servizio preservando quelle esistenti', async () => {
  const previous = globalThis.fetch
  const requests: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init })
    if (!init?.method) {
      return new Response(JSON.stringify({
        etag: 'calendar-etag',
        summary: 'Agenda professionale',
        labelProperties: {
          eventLabels: [{
            id: '11111111-1111-4111-8111-111111111111',
            backgroundColor: '#111111',
            name: 'Esistente',
          }],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ summary: 'Agenda professionale' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const ready = await ensureGoogleCalendarEventLabel({
      accessToken: 'token',
      calendarId: 'primary',
      label: {
        id: '22222222-2222-4222-8222-222222222222',
        backgroundColor: '#2563EB',
        name: 'Prima visita',
      },
    })

    assert.equal(ready, true)
    assert.equal(requests.length, 2)
    assert.equal(requests[1].init?.method, 'PUT')
    assert.equal(new Headers(requests[1].init?.headers).get('If-Match'), 'calendar-etag')
    const body = JSON.parse(String(requests[1].init?.body))
    assert.equal(body.labelProperties.eventLabels.length, 2)
    assert.deepEqual(body.labelProperties.eventLabels[1], {
      id: '22222222-2222-4222-8222-222222222222',
      backgroundColor: '#2563eb',
      name: 'Prima visita',
    })
  } finally {
    globalThis.fetch = previous
  }
})
