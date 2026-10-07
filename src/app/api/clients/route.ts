import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientSchema } from '@/schemas'
import type { Json } from '@/types/supabase'

// GET /api/clients — lista clienti del tenant
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 })

    const { searchParams } = request.nextUrl
    const q = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') ?? '50')

    let query = supabase
      .from('clients')
      .select('id, full_name, email, phone, tags, active, preferred_language')
      .eq('tenant_id', profile.tenant_id)
      .eq('active', true)
      .order('full_name', { ascending: true })
      .limit(limit)

    if (profile.role === 'STAFF') {
      query = query.eq('assigned_staff_id', user.id)
    }

    if (q) {
      query = query.ilike('full_name', `%${q}%`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('Create client error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/clients — crea nuovo cliente
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 })
    if (profile.role === 'STAFF') return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

    // Verifica limite clienti
    const { data: tenant } = await supabase
      .from('tenants')
      .select('max_clients')
      .eq('id', profile.tenant_id)
      .single()

    const { count } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .eq('active', true)

    if (tenant && count !== null && count >= tenant.max_clients) {
      return NextResponse.json(
        { error: 'Limite clienti raggiunto. Aggiorna il piano.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = createClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...parsed.data,
        tenant_id: profile.tenant_id,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        assigned_staff_id: parsed.data.assigned_staff_id || null,
        custom_fields: parsed.data.custom_fields as Json,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Esiste già un cliente con questa email' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ data, id: data.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
