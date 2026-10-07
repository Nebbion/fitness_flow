import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const companySettingsSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  logo_url: z.union([z.string().trim().url(), z.literal(''), z.null()]).optional(),
  brand_primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  brand_accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  locale: z.enum(['it', 'en']).optional(),
})

function normalizeLogoUrl(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// PATCH /api/settings/company
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id, role').eq('id', user.id).single()

    if (profile?.role !== 'TENANT_ADMIN' || !profile.tenant_id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const parsed = companySettingsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 400 })
    }

    const update = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    )

    if ('logo_url' in update) {
      update.logo_url = normalizeLogoUrl(update.logo_url as string | null | undefined)
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nessuna modifica richiesta' }, { status: 400 })
    }

    const { error } = await supabase
      .from('tenants')
      .update(update)
      .eq('id', profile.tenant_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
