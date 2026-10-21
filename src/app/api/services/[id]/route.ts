import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceSchema } from '@/schemas'
import { getEnabledModules, modulesForServiceName } from '@/lib/practice-modules'

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id, role').eq('id', user.id).single()

    if (profile?.role !== 'TENANT_ADMIN' || !profile.tenant_id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createServiceSchema.partial().safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 422 })

    const { data, error } = await supabase
      .from('services')
      .update(parsed.data)
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .select().single()

    if (error) throw error
    if (data?.active !== false) {
      const modules = modulesForServiceName(data.name)
      if (modules.length) {
        const { data: tenant } = await (supabase as any).from('tenants').select('profession, enabled_modules').eq('id', profile.tenant_id).single()
        await (supabase as any).from('tenants').update({ enabled_modules: [...new Set([...getEnabledModules(tenant), ...modules])] }).eq('id', profile.tenant_id)
      }
    }
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id, role').eq('id', user.id).single()

    if (profile?.role !== 'TENANT_ADMIN' || !profile.tenant_id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const { error } = await supabase
      .from('services')
      .update({ active: false })  // soft delete
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
