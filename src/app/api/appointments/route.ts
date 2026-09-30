import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAppointmentSchema } from '@/schemas'

// GET /api/appointments
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
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const clientId = searchParams.get('client_id')

    let query = supabase
      .from('appointments')
      .select(`
        id, start_at, end_at, status, notes,
        clients (id, full_name, phone, email),
        services (id, name, color, duration_min),
        profiles!appointments_staff_id_fkey (id, full_name)
      `)
      .eq('tenant_id', profile.tenant_id)
      .order('start_at', { ascending: true })

    if (profile.role === 'STAFF') query = query.eq('staff_id', user.id)
    if (from) query = query.gte('start_at', from)
    if (to) query = query.lte('start_at', to)
    if (clientId) query = query.eq('client_id', clientId)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/appointments
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

    const body = await request.json()
    const parsed = createAppointmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dati non validi', details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        tenant_id: profile.tenant_id,
        client_id: parsed.data.client_id,
        staff_id: parsed.data.staff_id,
        service_id: parsed.data.service_id || null,
        start_at: parsed.data.start_at,
        end_at: parsed.data.end_at,
        notes: parsed.data.notes || null,
        status: 'scheduled',
      })
      .select()
      .single()

    if (error) {
      // Errore di overlap (exclude constraint)
      if (error.code === '23P01') {
        return NextResponse.json(
          { error: 'Conflitto: lo staff ha già un appuntamento in questo orario' },
          { status: 409 }
        )
      }
      throw error
    }

    // Trigger notifica n8n (fire and forget)
    triggerN8nWebhook('appointment_created', {
      appointment_id: data.id,
      tenant_id: profile.tenant_id,
    }).catch(() => {})

    return NextResponse.json({ data, id: data.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Helper: trigger webhook n8n
async function triggerN8nWebhook(event: string, payload: object) {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL
  const apiKey = process.env.N8N_API_KEY
  if (!baseUrl) return

  await fetch(`${baseUrl}/${event}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(payload),
  })
}
