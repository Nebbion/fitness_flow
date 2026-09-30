import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params
  const { searchParams, origin } = request.nextUrl

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? `/${locale}`
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Gestione errori da Supabase Auth
  if (error) {
    console.error('Auth callback error:', error, errorDescription)
    return NextResponse.redirect(
      `${origin}/${locale}/auth/login?error=${encodeURIComponent(errorDescription ?? error)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError)
      const callbackError = exchangeError.message.includes('PKCE code verifier')
        ? 'confirmation_same_browser'
        : exchangeError.message

      return NextResponse.redirect(
        `${origin}/${locale}/auth/login?error=${encodeURIComponent(callbackError)}`
      )
    }

    // Controlla se il profilo ha un tenant (se no, manda all'onboarding)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single()

      // Nuovo utente senza tenant → onboarding
      if (!profile?.tenant_id && profile?.role !== 'SUPER_ADMIN') {
        return NextResponse.redirect(`${origin}/${locale}/auth/onboarding`)
      }
    }

    // URL sicuro per redirect
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'

    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`)
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`)
    } else {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/auth/login?error=no_code`)
}
