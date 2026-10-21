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
    throw new Error(typeof message === 'string' ? message : 'Errore Google Calendar')
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
