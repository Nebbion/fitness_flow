const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOCATION_URL = 'https://oauth2.googleapis.com/revoke'
const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3'

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
]

export interface GoogleCalendarListItem {
  id: string
  summary: string
  primary: boolean
  timeZone: string | null
  accessRole: string
}

interface TokenResponse {
  access_token: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
}

export interface GoogleCalendarEventInput {
  id?: string
  summary: string
  description?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  attendees?: Array<{
    email: string
    displayName?: string
    responseStatus?: GoogleCalendarAttendeeStatus
  }>
  extendedProperties?: {
    private?: Record<string, string>
  }
}

export type GoogleCalendarAttendeeStatus = 'needsAction' | 'accepted' | 'declined' | 'tentative'

export interface GoogleCalendarEventSnapshot {
  id: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  attendees?: Array<{
    email?: string
    responseStatus?: GoogleCalendarAttendeeStatus
  }>
}

export class GoogleCalendarApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GoogleCalendarApiError'
    this.status = status
  }
}

function configuredClient() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Credenziali Google Calendar non configurate')
  }
  return { clientId, clientSecret }
}

export function getGoogleRedirectUri() {
  const explicit = process.env.GOOGLE_CALENDAR_REDIRECT_URI
  if (explicit) return explicit

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL non configurata')
  return `${appUrl.replace(/\/$/, '')}/api/integrations/google-calendar/callback`
}

export function googleCalendarSetupReady() {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY &&
    (process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL)
  )
}

export function buildGoogleAuthorizationUrl(input: {
  state: string
  codeChallenge: string
  redirectUri: string
}) {
  const { clientId } = configuredClient()
  const url = new URL(AUTHORIZATION_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('scope', GOOGLE_CALENDAR_SCOPES.join(' '))
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', input.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url
}

async function readGoogleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.error_description ?? data.error?.message ?? data.error ?? `Google API error (${response.status})`
    throw new GoogleCalendarApiError(
      typeof message === 'string' ? message : 'Errore Google Calendar',
      response.status
    )
  }
  return data as T
}

export async function exchangeGoogleAuthorizationCode(input: {
  code: string
  codeVerifier: string
  redirectUri: string
}) {
  const { clientId, clientSecret } = configuredClient()
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    }),
    cache: 'no-store',
  })
  return readGoogleResponse<TokenResponse>(response)
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = configuredClient()
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  return readGoogleResponse<TokenResponse>(response)
}

export async function revokeGoogleToken(token: string) {
  const response = await fetch(REVOCATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
    cache: 'no-store',
  })
  return response.ok
}

export function isWritableGoogleCalendar(accessRole: string) {
  return accessRole === 'writer' || accessRole === 'owner'
}

export async function listWritableGoogleCalendars(accessToken: string) {
  const url = new URL(`${CALENDAR_API_URL}/users/me/calendarList`)
  url.searchParams.set('minAccessRole', 'writer')
  url.searchParams.set('showHidden', 'false')
  url.searchParams.set('maxResults', '250')

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const data = await readGoogleResponse<{ items?: Array<Record<string, unknown>> }>(response)

  return (data.items ?? [])
    .filter(item => typeof item.id === 'string' && isWritableGoogleCalendar(String(item.accessRole)))
    .map(item => ({
      id: String(item.id),
      summary: typeof item.summary === 'string' ? item.summary : String(item.id),
      primary: item.primary === true,
      timeZone: typeof item.timeZone === 'string' ? item.timeZone : null,
      accessRole: String(item.accessRole),
    } satisfies GoogleCalendarListItem))
}

function googleCalendarEventUrl(calendarId: string, eventId?: string) {
  const base = `${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events`
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base
}

function withSendUpdates(url: string) {
  const result = new URL(url)
  result.searchParams.set('sendUpdates', 'all')
  return result
}

export function googleEventIdForAppointment(appointmentId: string) {
  return `ff${appointmentId.replaceAll('-', '').toLowerCase()}`
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEventInput
) {
  const response = await fetch(withSendUpdates(googleCalendarEventUrl(calendarId)), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
    cache: 'no-store',
  })
  return readGoogleResponse<{ id: string }>(response)
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: GoogleCalendarEventInput
) {
  const update = { ...event }
  delete update.id
  const response = await fetch(withSendUpdates(googleCalendarEventUrl(calendarId, eventId)), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(update),
    cache: 'no-store',
  })
  return readGoogleResponse<{ id: string }>(response)
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
) {
  const response = await fetch(withSendUpdates(googleCalendarEventUrl(calendarId, eventId)), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  // La cancellazione e idempotente: un evento gia rimosso non richiede altre azioni.
  if (response.status === 404 || response.status === 410) return
  await readGoogleResponse<Record<string, never>>(response)
}

export async function listGoogleCalendarEvents(input: {
  accessToken: string
  calendarId: string
  timeMin: string
  timeMax: string
}) {
  const events: GoogleCalendarEventSnapshot[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(googleCalendarEventUrl(input.calendarId))
    url.searchParams.set('timeMin', input.timeMin)
    url.searchParams.set('timeMax', input.timeMax)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('showDeleted', 'true')
    url.searchParams.set('maxResults', '2500')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
      cache: 'no-store',
    })
    const data = await readGoogleResponse<{
      items?: GoogleCalendarEventSnapshot[]
      nextPageToken?: string
    }>(response)
    events.push(...(data.items ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return events
}
