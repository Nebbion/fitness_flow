import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateAppointmentSchema } from '@/schemas'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *, clients(*), services(*),
        profiles!appointments_staff_id_fkey(id, full_name)
      `)
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Non trovato' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

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
    const parsed = updateAppointmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi' }, { status: 422 })
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(parsed.data)
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .select()
      .single()

    if (error) {
      if (error.code === '23P01') {
        return NextResponse.json(
          { error: 'Conflitto orario con un altro appuntamento' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
