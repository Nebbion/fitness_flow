import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const validTokenTypes = new Set(['invite', 'magiclink'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type') ?? ''

  if (!tokenHash || !validTokenTypes.has(type)) {
    return NextResponse.redirect(new URL(`/${locale}/auth/login?error=invalid_invite_link`, request.url))
  }

  const supabase = await createClient() as any
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

  if (error) {
    console.error('Invite confirmation error:', error.message)
    return NextResponse.redirect(new URL(`/${locale}/auth/login?error=invalid_invite_link`, request.url))
  }

  const needsPasswordSetup = type === 'invite' || data.user?.user_metadata?.portal_password_set !== true
  const destination = needsPasswordSetup
    ? `/${locale}/auth/reset-password?mode=invite`
    : `/${locale}/portal`

  return NextResponse.redirect(new URL(destination, request.url))
}
