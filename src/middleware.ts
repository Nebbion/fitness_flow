import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// ─── Route protette per ruolo ─────────────────────────────────
const PROTECTED_ROUTES: Record<string, string[]> = {
  '/dashboard':  ['TENANT_ADMIN', 'STAFF'],
  '/portal':     ['CLIENT'],
  '/admin':      ['SUPER_ADMIN'],
  '/onboarding': ['TENANT_ADMIN'],
}

// Route pubbliche (non richiedono autenticazione)
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/callback',
  '/auth/error',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/superadmin/login',
  '/train',
  '/api/webhooks',  // webhook Stripe e WhatsApp non autenticati
]

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── 1. Ignora file statici e API interne ──────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?)$/)
  ) {
    return NextResponse.next()
  }

  // ─── 2. Gestione i18n (next-intl) ─────────────────────────
  // Estrai il locale dal path (/it/... o /en/...)
  const pathnameWithoutLocale = pathname.replace(/^\/(it|en)/, '') || '/'

  // ─── 3. API route — nessuna localizzazione o redirect ──────
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ─── 4. Supabase Auth — refresh sessione ──────────────────
  let supabaseResponse = intlMiddleware(request)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: non aggiungere logica tra createServerClient e getUser()
  const { data: { user } } = await supabase.auth.getUser()

  // ─── 5. Route pubbliche — nessun controllo ─────────────────
  const isPublicPath = PUBLIC_PATHS.some(p => pathnameWithoutLocale.startsWith(p))
  if (isPublicPath) {
    return supabaseResponse
  }

  // ─── 6. Utente non autenticato → redirect al login ─────────
  if (!user) {
    const locale = pathname.match(/^\/(it|en)/)?.[1] ?? 'it'
    const loginPath = pathnameWithoutLocale.startsWith('/admin')
      ? `/${locale}/superadmin/login`
      : `/${locale}/auth/login`
    const loginUrl = new URL(loginPath, request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ─── 7. Estrai ruolo dal JWT custom claims ─────────────────
  const { data: { session } } = await supabase.auth.getSession()
  const userRole = (user as any).user_role
    ?? parseJwtRole(session?.access_token ?? '')

  // ─── 8. Controllo accesso per rotta ────────────────────────
  const matchedRoute = Object.keys(PROTECTED_ROUTES).find(route =>
    pathnameWithoutLocale.startsWith(route)
  )

  if (matchedRoute && userRole) {
    const allowedRoles = PROTECTED_ROUTES[matchedRoute]
    if (!allowedRoles.includes(userRole)) {
      // Redirect alla rotta appropriata per il ruolo
      const locale = pathname.match(/^\/(it|en)/)?.[1] ?? 'it'
      const redirectPath = getRoleDefaultPath(userRole, locale)
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }
  }

  // ─── 9. Utente autenticato sulla homepage → redirect ───────
  if (pathnameWithoutLocale === '/' || pathnameWithoutLocale === '') {
    const locale = pathname.match(/^\/(it|en)/)?.[1] ?? 'it'
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id && profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL(`/${locale}/auth/onboarding`, request.url))
    }

    const defaultPath = getRoleDefaultPath(profile?.role ?? userRole ?? 'CLIENT', locale)
    return NextResponse.redirect(new URL(defaultPath, request.url))
  }

  return supabaseResponse
}

// ─── Helper: estrai ruolo dal JWT access token ────────────────
function parseJwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.user_role ?? null
  } catch {
    return null
  }
}

// ─── Helper: path di default per ruolo ───────────────────────
function getRoleDefaultPath(role: string, locale: string): string {
  const paths: Record<string, string> = {
    SUPER_ADMIN:   `/${locale}/admin`,
    TENANT_ADMIN:  `/${locale}/dashboard`,
    STAFF:         `/${locale}/dashboard`,
    CLIENT:        `/${locale}/portal`,
  }
  return paths[role] ?? `/${locale}/auth/login`
}

export const config = {
  matcher: [
    // Gestisci tutte le route tranne i file statici Next.js interni
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
