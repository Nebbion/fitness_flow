import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceSchema } from '@/schemas'

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
