import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { updateClientSchema } from '@/schemas'
import type { Json } from '@/types/supabase'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/clients/[id]
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data, error } = await supabase
      .from('clients')
      .select('*, profiles!clients_assigned_staff_id_fkey(id, full_name)')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/clients/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 })

    const body = await request.json()

    // Gestione toggle active (azione speciale)
    if ('active' in body && Object.keys(body).length === 1) {
      const { data, error } = await supabase
        .from('clients')
        .update({ active: body.active })
        .eq('id', id)
        .eq('tenant_id', profile.tenant_id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ data })
    }

    // Aggiornamento campi cliente
    const parsed = updateClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { data, error } = await supabase
      .from('clients')
      .update({
        ...parsed.data,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        assigned_staff_id: parsed.data.assigned_staff_id || null,
        custom_fields: parsed.data.custom_fields as Json | undefined,
      })
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data, id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/clients/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 })
    if (profile.role !== 'TENANT_ADMIN') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

    // Elimina documenti dallo storage prima
    const { data: docs } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('client_id', id)

    if (docs && docs.length > 0) {
      await supabase.storage
        .from('client-documents')
        .remove(docs.map(d => d.storage_path))
    }

    // Elimina il cliente (cascade elimina documenti, appuntamenti, progress)
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
