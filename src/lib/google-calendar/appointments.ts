import { createAdminClient } from '@/lib/supabase/server'
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  GoogleCalendarApiError,
  googleEventIdForAppointment,
  refreshGoogleAccessToken,
  updateGoogleCalendarEvent,
  type GoogleCalendarEventInput,
} from './client'
import { decryptGoogleToken } from './credentials'

export interface GoogleCalendarAppointmentSyncResult {
  status: 'synced' | 'skipped' | 'failed'
  action?: 'created' | 'updated' | 'deleted'
  eventId?: string
  invitedClient?: boolean
  message?: string
}

function calendarEventFromAppointment(appointment: any, timeZone?: string): GoogleCalendarEventInput {
  const client = appointment.clients as { full_name?: string; email?: string | null } | null
  const service = appointment.services as { name?: string } | null
  const tenant = appointment.tenants as { name?: string } | null
  const clientName = client?.full_name?.trim() || 'Cliente'
  const clientEmail = client?.email?.trim()

  return {
    id: googleEventIdForAppointment(appointment.id),
    summary: `${service?.name?.trim() || 'Appuntamento'} · ${clientName}`,
    description: `Appuntamento con ${tenant?.name?.trim() || 'FitnessFlow'}`,
    start: {
      dateTime: appointment.start_at,
      ...(timeZone ? { timeZone } : {}),
    },
    end: {
      dateTime: appointment.end_at,
      ...(timeZone ? { timeZone } : {}),
    },
    ...(clientEmail ? { attendees: [{ email: clientEmail, displayName: clientName }] } : {}),
    extendedProperties: {
      private: { fitnessflow_appointment_id: appointment.id },
    },
  }
}

export async function syncAppointmentToGoogleCalendar(
  appointmentId: string
): Promise<GoogleCalendarAppointmentSyncResult> {
  const admin = createAdminClient() as any
  const { data: appointment, error: appointmentError } = await admin
    .from('appointments')
    .select(`
      id, tenant_id, staff_id, start_at, end_at, status, google_event_id,
      clients (full_name, email),
      services (name),
      tenants (name, timezone)
    `)
    .eq('id', appointmentId)
    .single()

  if (appointmentError || !appointment) {
    return { status: 'failed', message: appointmentError?.message ?? 'Appuntamento non trovato' }
  }

  const { data: connection, error: connectionError } = await admin
    .from('google_calendar_connections')
    .select('id, calendar_id, calendar_timezone, refresh_token_encrypted, status')
    .eq('tenant_id', appointment.tenant_id)
    .eq('professional_id', appointment.staff_id)
    .eq('status', 'active')
    .maybeSingle()

  if (connectionError) {
    return { status: 'failed', message: connectionError.message }
  }
  if (!connection) {
    return { status: 'skipped', message: 'Il professionista non ha collegato Google Calendar' }
  }

  const eventId = appointment.google_event_id || googleEventIdForAppointment(appointment.id)
  const client = appointment.clients as { email?: string | null } | null
  const invitedClient = Boolean(client?.email?.trim())

  try {
    const token = await refreshGoogleAccessToken(
      decryptGoogleToken(connection.refresh_token_encrypted)
    )

    if (appointment.status === 'cancelled') {
      await deleteGoogleCalendarEvent(token.access_token, connection.calendar_id, eventId)
      await admin.from('appointments')
        .update({ google_event_id: null })
        .eq('id', appointment.id)
      await admin.from('google_calendar_connections')
        .update({ last_error: null })
        .eq('id', connection.id)
      return { status: 'synced', action: 'deleted', eventId, invitedClient }
    }

    const tenant = appointment.tenants as { timezone?: string | null } | null
    const event = calendarEventFromAppointment(
      appointment,
      connection.calendar_timezone ?? tenant?.timezone ?? undefined
    )
    let action: 'created' | 'updated'

    if (appointment.google_event_id) {
      try {
        await updateGoogleCalendarEvent(
          token.access_token,
          connection.calendar_id,
          eventId,
          event
        )
        action = 'updated'
      } catch (error) {
        // Se l'evento e stato rimosso manualmente da Google, lo ricreiamo con lo
        // stesso ID invece di lasciare l'appuntamento fuori sincronizzazione.
        if (!(error instanceof GoogleCalendarApiError) || error.status !== 404) throw error
        await createGoogleCalendarEvent(token.access_token, connection.calendar_id, event)
        action = 'created'
      }
    } else {
      try {
        await createGoogleCalendarEvent(token.access_token, connection.calendar_id, event)
        action = 'created'
      } catch (error) {
        // L'ID e deterministico: un retry dopo una risposta persa aggiorna l'evento
        // gia creato invece di generarne uno duplicato.
        if (!(error instanceof GoogleCalendarApiError) || error.status !== 409) throw error
        await updateGoogleCalendarEvent(
          token.access_token,
          connection.calendar_id,
          eventId,
          event
        )
        action = 'updated'
      }
    }

    await admin.from('appointments')
      .update({ google_event_id: eventId })
      .eq('id', appointment.id)
    await admin.from('google_calendar_connections')
      .update({ last_error: null })
      .eq('id', connection.id)

    return { status: 'synced', action, eventId, invitedClient }
  } catch (error: any) {
    const message = error?.message ?? 'Sincronizzazione Google Calendar non riuscita'
    await admin.from('google_calendar_connections')
      .update({
        last_error: message,
        ...(message.includes('invalid_grant') ? { status: 'error' } : {}),
      })
      .eq('id', connection.id)
    console.error('Google Calendar appointment sync error:', error)
    return { status: 'failed', message }
  }
}
