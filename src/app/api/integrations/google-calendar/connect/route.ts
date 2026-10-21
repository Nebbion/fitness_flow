import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildGoogleAuthorizationUrl,
  getGoogleRedirectUri,
  googleCalendarSetupReady,
} from '@/lib/google-calendar/client'
import { getGoogleCalendarProfessional } from '@/lib/google-calendar/session'

export const runtime = 'nodejs'

function base64UrlSha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('base64url')
}

export async function GET(request: NextRequest) {
  const professional = await getGoogleCalendarProfessional()
  if (!professional) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }
  if (!googleCalendarSetupReady()) {
    return NextResponse.json({ error: 'Integrazione Google Calendar non configurata' }, { status: 503 })
  }

  const localeValue = request.nextUrl.searchParams.get('locale')
  const locale = localeValue === 'en' ? 'en' : 'it'
  const state = crypto.randomBytes(32).toString('base64url')
  const codeVerifier = crypto.randomBytes(64).toString('base64url')
  const authorizationUrl = buildGoogleAuthorizationUrl({
    state,
    codeChallenge: base64UrlSha256(codeVerifier),
    redirectUri: getGoogleRedirectUri(),
  })

  const response = NextResponse.redirect(authorizationUrl)
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/integrations/google-calendar',
    maxAge: 10 * 60,
  }
  response.cookies.set('google_calendar_oauth_state', state, cookieOptions)
  response.cookies.set('google_calendar_code_verifier', codeVerifier, cookieOptions)
  response.cookies.set('google_calendar_locale', locale, cookieOptions)
  return response
}

