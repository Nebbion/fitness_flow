import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const locale = request.nextUrl.searchParams.get('locale') ?? 'it'
  return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url))
}
