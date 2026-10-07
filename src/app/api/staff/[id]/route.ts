import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

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
    const update: Database['public']['Tables']['profiles']['Update'] = {}
    if (body.role === 'TENANT_ADMIN' || body.role === 'STAFF') update.role = body.role
    if (typeof body.active === 'boolean') update.active = body.active
    if (!Object.keys(update).length) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 422 })
    }

    const { error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)

    if (error) throw error
    return NextResponse.json({ success: true })
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

    // Non eliminare, solo disattiva e rimuovi dal tenant
    const { error } = await supabase
      .from('profiles')
      .update({ active: false, tenant_id: null })
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .neq('id', user.id) // non puoi rimuovere te stesso

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
