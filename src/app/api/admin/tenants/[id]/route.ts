import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireSuperAdminApi } from '@/lib/admin/auth'

interface Params {
  params: Promise<{ id: string }>
}

const tenantUpdateSchema = z.object({
  plan: z.enum(['trial', 'starter', 'professional', 'business']).optional(),
  status: z.enum(['active', 'inactive', 'suspended', 'cancelled']).optional(),
  logo_url: z.union([z.string().trim().url(), z.literal(''), z.null()]).optional(),
  max_clients: z.number().int().min(0).max(999999).optional(),
  trial_ends_at: z.string().datetime({ offset: true }).nullable().optional(),
})

const DEFAULT_PLAN_LIMITS = {
  trial: 10,
  starter: 50,
  professional: 250,
  business: 999999,
} as const

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireSuperAdminApi()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params
    const parsed = tenantUpdateSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 })
    }

    const update: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.plan && parsed.data.max_clients === undefined) {
      update.max_clients = DEFAULT_PLAN_LIMITS[parsed.data.plan]
    }
    if ('logo_url' in update) {
      const logoUrl = update.logo_url
      update.logo_url = typeof logoUrl === 'string' ? logoUrl.trim() || null : null
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nessuna modifica richiesta' }, { status: 400 })
    }

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('tenants')
      .update(update)
      .eq('id', id)
      .select('id')
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Admin tenant update error:', err)
    return NextResponse.json({ error: err.message ?? 'Errore interno' }, { status: 500 })
  }
}
