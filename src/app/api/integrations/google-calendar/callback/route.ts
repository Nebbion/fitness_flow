import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  exchangeGoogleAuthorizationCode,
  getGoogleRedirectUri,
  listWritableGoogleCalendars,
} from '@/lib/google-calendar/client'
import { encryptGoogleToken } from '@/lib/google-calendar/credentials'
import { getGoogleCalendarProfessional } from '@/lib/google-calendar/session'

export const runtime = 'nodejs'

function settingsUrl(request: NextRequest, locale: string, result: 'connected' | 'error', reason?: string) {
  const url = new URL(`/${locale}/dashboard/settings`, request.url)
  url.searchParams.set('tab', 'calendar')
  url.searchParams.set('google_calendar', result)
  if (reason) url.searchParams.set('reason', reason)
  return url
}

function clearOauthCookies(response: NextResponse) {
  const options = { path: '/api/integrations/google-calendar', maxAge: 0 }
  response.cookies.set('google_calendar_oauth_state', '', options)
  response.cookies.set('google_calendar_code_verifier', '', options)
  response.cookies.set('google_calendar_locale', '', options)
  return response
}

export async function GET(request: NextRequest) {
  const locale = request.cookies.get('google_calendar_locale')?.value === 'en' ? 'en' : 'it'
  const expectedState = request.cookies.get('google_calendar_oauth_state')?.value
  const codeVerifier = request.cookies.get('google_calendar_code_verifier')?.value
  const state = request.nextUrl.searchParams.get('state')
  const code = request.nextUrl.searchParams.get('code')
  const oauthError = request.nextUrl.searchParams.get('error')

  if (oauthError) {
    return clearOauthCookies(NextResponse.redirect(settingsUrl(request, locale, 'error', oauthError)))
  }
  if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
    return clearOauthCookies(NextResponse.redirect(settingsUrl(request, locale, 'error', 'invalid_state')))
  }

  const professional = await getGoogleCalendarProfessional()
  if (!professional) {
    return clearOauthCookies(NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url)))
  }

  try {
    const tokens = await exchangeGoogleAuthorizationCode({
      code,
      codeVerifier,
      redirectUri: getGoogleRedirectUri(),
    })
    if (!tokens.refresh_token) {
      throw new Error('Google non ha restituito un refresh token. Revoca l’accesso e riprova.')
    }

    const calendars = await listWritableGoogleCalendars(tokens.access_token)
    const primary = calendars.find(calendar => calendar.primary) ?? calendars[0]
    if (!primary) throw new Error('Nessun calendario Google scrivibile disponibile')

    const admin = createAdminClient() as any
    const { error } = await admin.from('google_calendar_connections').upsert({
      tenant_id: professional.tenantId,
      professional_id: professional.id,
      google_account_email: calendars.find(calendar => calendar.primary)?.id ?? null,
      calendar_id: primary.id,
      calendar_name: primary.summary,
      calendar_timezone: primary.timeZone,
      refresh_token_encrypted: encryptGoogleToken(tokens.refresh_token),
      granted_scopes: tokens.scope?.split(' ').filter(Boolean) ?? [],
      status: 'active',
      last_error: null,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'professional_id' })

    if (error) throw error
    return clearOauthCookies(NextResponse.redirect(settingsUrl(request, locale, 'connected')))
  } catch (error: any) {
    console.error('Google Calendar callback error:', error)
    return clearOauthCookies(NextResponse.redirect(settingsUrl(request, locale, 'error', 'connection_failed')))
  }
}

