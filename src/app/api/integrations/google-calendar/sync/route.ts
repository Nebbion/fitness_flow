import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { syncGoogleCalendarResponses } from '@/lib/google-calendar/appointments'
import { getGoogleCalendarProfessional } from '@/lib/google-calendar/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const schema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
}).superRefine((value, context) => {
  const from = new Date(value.from)
  const to = new Date(value.to)
  if (to <= from) {
    context.addIssue({ code: 'custom', message: 'Intervallo non valido' })
  }
  if (to.getTime() - from.getTime() > 400 * 24 * 60 * 60 * 1000) {
    context.addIssue({ code: 'custom', message: 'Intervallo troppo ampio' })
  }
})

export async function POST(request: NextRequest) {
  const professional = await getGoogleCalendarProfessional()
  if (!professional) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Intervallo non valido' }, { status: 422 })
  }

  const result = await syncGoogleCalendarResponses({
    tenantId: professional.tenantId,
    ...(professional.role === 'STAFF' ? { professionalId: professional.id } : {}),
    timeMin: parsed.data.from,
    timeMax: parsed.data.to,
  })

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
