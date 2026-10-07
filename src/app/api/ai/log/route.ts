import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id').eq('id', user.id).single()

    if (!profile?.tenant_id) return NextResponse.json({ ok: false }, { status: 403 })

    const body = await request.json()

    await supabase.from('ai_usage_logs').insert({
      tenant_id: profile.tenant_id,
      user_id: user.id,
      feature: body.feature,
      model: 'gpt-4o',
      prompt_tokens: body.prompt_tokens ?? 0,
      completion_tokens: body.completion_tokens ?? 0,
      cost_usd: body.cost_usd ?? 0,
      duration_ms: body.duration_ms ?? null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
