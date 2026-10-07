import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceSchema } from '@/schemas'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id').eq('id', user.id).single()

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: 'Tenant non trovato' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('active', true)
      .order('name')

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id, role').eq('id', user.id).single()

    if (profile?.role !== 'TENANT_ADMIN' || !profile.tenant_id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createServiceSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Dati non validi' }, { status: 422 })

    const { data, error } = await supabase
      .from('services')
      .insert({ ...parsed.data, tenant_id: profile.tenant_id })
      .select().single()

    if (error) throw error
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
