import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyWebhook, parseInboundMessage } from '@/lib/whatsapp/client'

// GET — verifica webhook Meta
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode      = searchParams.get('hub.mode') ?? ''
  const token     = searchParams.get('hub.verify_token') ?? ''
  const challenge = searchParams.get('hub.challenge') ?? ''

  const result = verifyWebhook(mode, token, challenge)
  if (result) {
    return new Response(result, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// POST — ricevi messaggi e status update
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const admin = createAdminClient()

    // Gestione status update (consegna, lettura)
    const statusUpdate = body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]
    if (statusUpdate) {
      await admin
        .from('whatsapp_messages')
        .update({
          status: statusUpdate.status,
          ...(statusUpdate.status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
          ...(statusUpdate.status === 'read' ? { read_at: new Date().toISOString() } : {}),
        })
        .eq('wa_message_id', statusUpdate.id)

      return NextResponse.json({ ok: true })
    }

    // Messaggio in arrivo
    const msg = parseInboundMessage(body)
    if (!msg) return NextResponse.json({ ok: true })

    // Trova il cliente dal numero di telefono
    const phoneClean = msg.from.replace(/^\+/, '')
    const { data: client } = await admin
      .from('clients')
      .select('id, tenant_id, full_name')
      .or(`phone.eq.+${phoneClean},phone.eq.${phoneClean}`)
      .limit(1)
      .single()

    // Salva il messaggio in arrivo
    await admin.from('whatsapp_messages').insert({
      tenant_id: client?.tenant_id ?? null,
      client_id: client?.id ?? null,
      direction: 'inbound',
      body: msg.text,
      wa_message_id: msg.messageId,
      status: 'read',
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('WhatsApp webhook error:', err)
    // Ritorna sempre 200 a Meta (altrimenti riprova)
    return NextResponse.json({ ok: true })
  }
}
