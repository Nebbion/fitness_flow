import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { decryptWhatsAppToken } from '@/lib/whatsapp/credentials'
import { sendWhatsAppTemplate } from '@/lib/whatsapp/client'

function value(text: string) {
  return { type: 'text', text }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const admin = createAdminClient() as any
  const { data: claimed, error } = await admin.rpc('claim_appointment_reminders', { p_limit: 20 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = []
  for (const item of claimed ?? []) {
    const { data: context, error: beginError } = await admin.rpc('begin_reminder_send', {
      p_id: item.id,
      p_claim: item.claim_token,
    })
    if (beginError || !context) {
      results.push({ id: item.id, status: beginError ? 'failed_to_claim' : 'cancelled' })
      continue
    }

    const appointment = context.appointment
    const connection = context.connection
    const client = context.client
    const startsAt = new Date(appointment.start_at)
    const locale = connection.reminder_language.startsWith('en') ? 'en-GB' : 'it-IT'
    const date = new Intl.DateTimeFormat(locale, {
      dateStyle: 'long', timeZone: connection.reminder_timezone,
    }).format(startsAt)
    const time = new Intl.DateTimeFormat(locale, {
      timeStyle: 'short', timeZone: connection.reminder_timezone,
    }).format(startsAt)

    let result
    try {
      result = client.phone
        ? await sendWhatsAppTemplate({
          to: client.phone,
          templateName: connection.reminder_template,
          language: connection.reminder_language,
          components: [{
            type: 'body',
            parameters: [
              value(client.full_name),
              value(context.professional ?? 'il tuo professionista'),
              value(date),
              value(time),
              value(context.service ?? 'appuntamento'),
            ],
          }],
          }, {
            phoneNumberId: connection.phone_number_id,
            accessToken: decryptWhatsAppToken(connection.access_token_encrypted),
          })
        : { error: 'Numero cliente assente', retryable: false }
    } catch (caught: any) {
      result = { error: caught.message ?? 'Configurazione WhatsApp non valida', retryable: false }
    }

    let status = 'sent'
    let availableAt: string | null = null
    if (result.uncertain) status = 'unknown'
    else if (result.error && result.retryable && context.reminder.attempts + 1 < 3) {
      status = 'retry'
      availableAt = new Date(Date.now() + 5 * 60_000 * 2 ** context.reminder.attempts).toISOString()
    } else if (result.error) status = 'failed'

    await admin.from('appointment_reminders').update({
      status,
      wa_message_id: result.messageId ?? null,
      last_error: result.error ?? null,
      ...(availableAt ? { available_at: availableAt } : {}),
    }).eq('id', item.id).eq('status', 'sending')
    await admin.from('reminder_attempts').update({ outcome: status, error: result.error ?? null })
      .eq('reminder_id', item.id).eq('attempt', context.reminder.attempts + 1)
    await admin.from('whatsapp_messages').insert({
      tenant_id: appointment.tenant_id,
      client_id: appointment.client_id,
      appointment_id: appointment.id,
      direction: 'outbound',
      body: `Promemoria appuntamento: ${date} ${time}`,
      wa_message_id: result.messageId ?? null,
      status: result.messageId ? 'sent' : 'failed',
      trigger_event: 'appointment_reminder',
      error_message: result.error ?? null,
      sent_at: result.messageId ? new Date().toISOString() : null,
    })
    results.push({ id: item.id, status })
  }
  return NextResponse.json({ processed: results.length, results })
}
