import { createAdminClient } from '@/lib/supabase/server'
import { decryptWhatsAppToken } from './credentials'
import { sendWhatsAppTemplate } from './client'

function templateValue(value: string) {
  return { type: 'text', text: value }
}

export async function sendAppointmentConfirmation(appointmentId: string) {
  const admin = createAdminClient() as any
  const { data: appointment } = await admin
    .from('appointments')
    .select(`
      id, tenant_id, staff_id, start_at,
      clients (id, full_name, phone, preferred_language),
      services (name),
      tenants (name, timezone)
    `)
    .eq('id', appointmentId)
    .single()

  if (!appointment) return

  const { data: rule } = await admin
    .from('notification_rules')
    .select('template_key')
    .eq('tenant_id', appointment.tenant_id)
    .eq('event_trigger', 'appointment_created')
    .eq('channel', 'whatsapp')
    .eq('delay_minutes', 0)
    .eq('active', true)
    .maybeSingle()

  const client = appointment.clients as any
  const service = appointment.services as any
  const tenant = appointment.tenants as any
  if (!rule || !client?.phone) return

  const { data: existingMessage } = await admin
    .from('whatsapp_messages')
    .select('id')
    .eq('tenant_id', appointment.tenant_id)
    .eq('appointment_id', appointment.id)
    .eq('trigger_event', 'appointment_created')
    .maybeSingle()
  if (existingMessage) return

  const { data: connection } = await admin
    .from('whatsapp_connections')
    .select('phone_number_id, access_token_encrypted')
    .eq('tenant_id', appointment.tenant_id)
    .eq('professional_id', appointment.staff_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!connection) return

  const locale = client.preferred_language === 'en' ? 'en-GB' : 'it-IT'
  const timeZone = tenant?.timezone ?? 'Europe/Rome'
  const startsAt = new Date(appointment.start_at)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone }).format(startsAt)
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone }).format(startsAt)

  let result: { messageId?: string; error?: string }
  try {
    result = await sendWhatsAppTemplate(
      {
        to: client.phone,
        templateName: process.env.WHATSAPP_APPOINTMENT_CONFIRMATION_TEMPLATE ?? rule.template_key,
        language: client.preferred_language === 'en' ? 'en' : 'it',
        components: [{
          type: 'body',
          parameters: [
            templateValue(client.full_name),
            templateValue(tenant?.name ?? 'FitnessFlow'),
            templateValue(date),
            templateValue(time),
            templateValue(service?.name ?? 'appuntamento'),
          ],
        }],
      },
      {
        phoneNumberId: connection.phone_number_id,
        accessToken: decryptWhatsAppToken(connection.access_token_encrypted),
      }
    )
  } catch (error: any) {
    result = { error: error.message ?? 'Errore durante l’invio WhatsApp' }
  }

  await admin.from('whatsapp_messages').insert({
    tenant_id: appointment.tenant_id,
    client_id: client.id,
    appointment_id: appointment.id,
    direction: 'outbound',
    body: `Conferma appuntamento: ${date} ${time}`,
    wa_message_id: result.messageId ?? null,
    status: result.error ? 'failed' : 'sent',
    trigger_event: 'appointment_created',
    error_message: result.error ?? null,
    sent_at: result.error ? null : new Date().toISOString(),
  })
}
