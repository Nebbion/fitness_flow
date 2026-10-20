import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const validTokenTypes = new Set(['invite', 'magiclink'])

function validRedirect(target: string | null, type: string, request: NextRequest) {
  if (!target || !validTokenTypes.has(type)) return null

  try {
    const url = new URL(target)
    if (url.origin !== request.nextUrl.origin) return null

    const locale = url.pathname.match(/^\/(it|en)\//)?.[1]
    if (!locale) return null

    const isPasswordSetup = (type === 'invite' || type === 'magiclink')
      && url.pathname === `/${locale}/auth/reset-password`
      && url.searchParams.get('mode') === 'invite'
    const isMagicLinkPortal = type === 'magiclink' && url.pathname === `/${locale}/portal`

    return isPasswordSetup || isMagicLinkPortal ? url : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type') ?? ''
  const redirectUrl = validRedirect(request.nextUrl.searchParams.get('redirect_to'), type, request)
  const locale = redirectUrl?.pathname.match(/^\/(it|en)\//)?.[1] ?? 'it'

  if (!tokenHash || !redirectUrl) {
    return NextResponse.redirect(new URL(`/${locale}/auth/login?error=invalid_invite_link`, request.url))
  }

  const supabase = await createClient() as any
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

  if (error) {
    console.error('Invite confirmation error:', error.message)
    return NextResponse.redirect(new URL(`/${locale}/auth/login?error=invalid_invite_link`, request.url))
  }

  return NextResponse.redirect(redirectUrl)
}
