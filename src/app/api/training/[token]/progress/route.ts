import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveTrainingAccess } from '@/lib/training/access'
import {
  buildProgressAIInput,
  calculateTrainingProgress,
  progressRangeSchema,
  progressRangeStart,
} from '@/lib/training/progress'
import {
  analyzeTrainingProgress,
  getProgressAIConfig,
  progressAIDailyLimit,
} from '@/lib/training/progress-ai'

interface Params { params: Promise<{ token: string }> }
const responseHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
const sessionColumns = 'id, version, started_at, completed_at, notes, plan_snapshot, entries'

async function loadProgress(admin: any, token: string, months: number) {
  const access = await resolveTrainingAccess(admin, token)
  if (!access) return { error: 'Link scaduto o revocato', status: 404 as const }

  const start = progressRangeStart(months)
  const { data, error } = await admin
    .from('training_sessions')
    .select(sessionColumns)
    .eq('client_id', access.client_id)
    .eq('tenant_id', access.tenant_id)
    .not('completed_at', 'is', null)
    .gte('completed_at', start.toISOString())
    .order('completed_at', { ascending: true })
    .limit(501)

  if (error) return { error: 'I progressi non sono ancora disponibili', status: 503 as const }
  const rows = data ?? []
  const truncated = rows.length > 500
  const sessions = truncated ? rows.slice(0, 500) : rows
  const stats = calculateTrainingProgress(sessions, months, new Date(), truncated)
  const sourceHash = crypto.createHash('sha256').update(JSON.stringify({
    months,
    sessions: sessions.map((session: any) => [session.id, session.version, session.completed_at]),
  })).digest('hex')

  return { access, stats, sourceHash }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params
  const parsedRange = progressRangeSchema.safeParse(request.nextUrl.searchParams.get('months') ?? 3)
  if (!parsedRange.success) return NextResponse.json({ error: 'Intervallo non valido' }, { status: 422, headers: responseHeaders })

  const result = await loadProgress(createAdminClient() as any, token, parsedRange.data)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: responseHeaders })
  return NextResponse.json({ stats: result.stats, aiEnabled: !!getProgressAIConfig() }, { headers: responseHeaders })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params
  const body = await request.json().catch(() => ({}))
  const parsedRange = progressRangeSchema.safeParse(body.months ?? 3)
  if (!parsedRange.success) return NextResponse.json({ error: 'Intervallo non valido' }, { status: 422, headers: responseHeaders })

  const config = getProgressAIConfig()
  if (!config) return NextResponse.json({ error: 'Analisi AI non attiva' }, { status: 503, headers: responseHeaders })

  const admin = createAdminClient() as any
  const result = await loadProgress(admin, token, parsedRange.data)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: responseHeaders })

  const cacheKey = {
    client_id: result.access.client_id,
    range_months: parsedRange.data,
    source_hash: result.sourceHash,
    provider: config.provider,
    model: config.model,
  }
  const { data: cached, error: cacheError } = await admin.from('training_progress_ai_cache').select('*')
    .match({ tenant_id: result.access.tenant_id, ...cacheKey }).maybeSingle()
  if (cacheError) {
    return NextResponse.json({ error: 'Servizio di analisi non disponibile' }, { status: 503, headers: responseHeaders })
  }
  if (cached?.status === 'completed' && cached.analysis) {
    return NextResponse.json({ analysis: cached.analysis, cached: true, createdAt: cached.completed_at }, { headers: responseHeaders })
  }
  if (cached?.status === 'pending' && new Date(cached.created_at).getTime() > Date.now() - 10 * 60_000) {
    return NextResponse.json({ error: 'Analisi già in elaborazione' }, { status: 409, headers: responseHeaders })
  }
  if (cached?.status === 'pending') {
    await admin.from('training_progress_ai_cache').update({ status: 'failed', error: 'Elaborazione interrotta' })
      .eq('id', cached.id).eq('status', 'pending')
    cached.status = 'failed'
  }

  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const { count, error: rateError } = await admin.from('training_progress_ai_cache').select('id', { count: 'exact', head: true })
    .eq('client_id', result.access.client_id).eq('tenant_id', result.access.tenant_id).gte('created_at', since)
  if (rateError) {
    return NextResponse.json({ error: 'Servizio di analisi non disponibile' }, { status: 503, headers: responseHeaders })
  }
  if ((count ?? 0) >= progressAIDailyLimit()) {
    return NextResponse.json({ error: 'Limite giornaliero raggiunto. Riprova più tardi.' }, { status: 429, headers: responseHeaders })
  }

  let cacheId = cached?.id
  if (cacheId) {
    const { data: claimed } = await admin.from('training_progress_ai_cache').update({
      status: 'pending', error: null, analysis: null, created_at: new Date().toISOString(), completed_at: null,
      statistics: buildProgressAIInput(result.stats),
    }).eq('id', cacheId).eq('status', 'failed').select('id').maybeSingle()
    if (!claimed) return NextResponse.json({ error: 'Analisi già in elaborazione' }, { status: 409, headers: responseHeaders })
  } else {
    const { data: created, error } = await admin.from('training_progress_ai_cache').insert({
      tenant_id: result.access.tenant_id,
      ...cacheKey,
      statistics: buildProgressAIInput(result.stats),
    }).select('id').single()
    if (error?.code === '23505') return NextResponse.json({ error: 'Analisi già in elaborazione' }, { status: 409, headers: responseHeaders })
    if (error || !created) return NextResponse.json({ error: 'Impossibile avviare l’analisi' }, { status: 500, headers: responseHeaders })
    cacheId = created.id
  }

  try {
    const analysis = await analyzeTrainingProgress(result.stats, config)
    const completedAt = new Date().toISOString()
    await admin.from('training_progress_ai_cache').update({
      status: 'completed', analysis, completed_at: completedAt, error: null,
    }).eq('id', cacheId).eq('status', 'pending')
    return NextResponse.json({ analysis, cached: false, createdAt: completedAt }, { headers: responseHeaders })
  } catch (error: any) {
    await admin.from('training_progress_ai_cache').update({
      status: 'failed', error: String(error?.message ?? 'Provider non disponibile').slice(0, 500),
    }).eq('id', cacheId).eq('status', 'pending')
    return NextResponse.json({ error: 'Analisi temporaneamente non disponibile' }, { status: 502, headers: responseHeaders })
  }
}
