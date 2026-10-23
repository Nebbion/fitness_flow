import { createAdminClient } from '@/lib/supabase/server'
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  ensureGoogleCalendarEventLabel,
  GoogleCalendarApiError,
  googleEventIdForAppointment,
  listGoogleCalendarEvents,
  refreshGoogleAccessToken,
  updateGoogleCalendarEventLabel,
  updateGoogleCalendarEvent,
  type GoogleCalendarAttendeeStatus,
  type GoogleCalendarEventInput,
} from './client'
import { decryptGoogleToken } from './credentials'

export interface GoogleCalendarAppointmentSyncResult {
  status: 'synced' | 'skipped' | 'failed'
  action?: 'created' | 'updated' | 'deleted'
  eventId?: string
  invitedClient?: boolean
  labelApplied?: boolean
  message?: string
}

function calendarEventFromAppointment(
  appointment: any,
  timeZone?: string,
  eventLabelId?: string
): GoogleCalendarEventInput {
  const client = appointment.clients as { full_name?: string; email?: string | null } | null
  const service = appointment.services as { name?: string } | null
  const tenant = appointment.tenants as { name?: string } | null
  const clientName = client?.full_name?.trim() || 'Cliente'
  const clientEmail = client?.email?.trim()

  return {
    id: googleEventIdForAppointment(appointment.id),
    summary: `${service?.name?.trim() || 'Appuntamento'} · ${clientName}`,
    description: `Appuntamento con ${tenant?.name?.trim() || 'FitnessFlow'}`,
    ...(eventLabelId ? { eventLabelId } : {}),
    start: {
      dateTime: appointment.start_at,
      ...(timeZone ? { timeZone } : {}),
    },
    end: {
      dateTime: appointment.end_at,
      ...(timeZone ? { timeZone } : {}),
    },
    ...(clientEmail ? {
      attendees: [{
        email: clientEmail,
        displayName: clientName,
        ...(appointment.google_attendee_status
          ? { responseStatus: appointment.google_attendee_status as GoogleCalendarAttendeeStatus }
          : {}),
      }],
    } : {}),
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
      google_attendee_status,
      clients (full_name, email),
      services (id, name, color),
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
    const service = appointment.services as {
      id?: string
      name?: string
      color?: string | null
    } | null
    let eventLabelId: string | undefined

    if (service?.id) {
      try {
        const labelReady = await ensureGoogleCalendarEventLabel({
          accessToken: token.access_token,
          calendarId: connection.calendar_id,
          label: {
            id: service.id,
            name: service.name?.trim() || 'Servizio',
            backgroundColor: service.color || '#2563EB',
          },
        })
        if (labelReady) eventLabelId = service.id
      } catch (labelError) {
        // Un calendario condiviso puo essere scrivibile senza consentire la
        // gestione delle etichette. L'evento continua a sincronizzarsi.
        console.warn('Google Calendar label sync skipped:', labelError)
      }
    }

    const event = calendarEventFromAppointment(
      appointment,
      connection.calendar_timezone ?? tenant?.timezone ?? undefined,
      eventLabelId
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
      .update({
        google_event_id: eventId,
        ...(invitedClient && !appointment.google_attendee_status
          ? {
              google_attendee_status: 'needsAction',
              google_attendee_status_updated_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq('id', appointment.id)
    await admin.from('google_calendar_connections')
      .update({ last_error: null })
      .eq('id', connection.id)

    return {
      status: 'synced',
      action,
      eventId,
      invitedClient,
      ...(service?.id ? { labelApplied: Boolean(eventLabelId) } : {}),
    }
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

export interface GoogleCalendarResponseSyncResult {
  checked: number
  changed: number
  errors: string[]
}

const GOOGLE_ATTENDEE_STATUSES = new Set<GoogleCalendarAttendeeStatus>([
  'needsAction',
  'accepted',
  'declined',
  'tentative',
])

/**
 * Importa da Google soltanto gli stati che Google controlla direttamente:
 * risposta dell'invitato e cancellazione dell'evento da parte dell'organizzatore.
 * Un rifiuto dell'invitato non annulla mai l'appuntamento FitnessFlow.
 */
export async function syncGoogleCalendarResponses(input: {
  tenantId: string
  professionalId?: string
  timeMin: string
  timeMax: string
}): Promise<GoogleCalendarResponseSyncResult> {
  const admin = createAdminClient() as any
  let connectionsQuery = admin
    .from('google_calendar_connections')
    .select('id, professional_id, calendar_id, refresh_token_encrypted')
    .eq('tenant_id', input.tenantId)
    .eq('status', 'active')

  if (input.professionalId) {
    connectionsQuery = connectionsQuery.eq('professional_id', input.professionalId)
  }

  const { data: connections, error: connectionsError } = await connectionsQuery
  if (connectionsError) {
    return { checked: 0, changed: 0, errors: [connectionsError.message] }
  }

  const result: GoogleCalendarResponseSyncResult = { checked: 0, changed: 0, errors: [] }

  for (const connection of connections ?? []) {
    try {
      const token = await refreshGoogleAccessToken(
        decryptGoogleToken(connection.refresh_token_encrypted)
      )
      const googleEvents = await listGoogleCalendarEvents({
        accessToken: token.access_token,
        calendarId: connection.calendar_id,
        timeMin: input.timeMin,
        timeMax: input.timeMax,
      })
      const eventsById = new Map(
        googleEvents
          .filter(event => event.id.startsWith('ff'))
          .map(event => [event.id, event])
      )

      const { data: appointments, error: appointmentsError } = await admin
        .from('appointments')
        .select(`
          id, status, google_event_id, google_attendee_status, service_id,
          clients (email),
          services (id, name, color)
        `)
        .eq('tenant_id', input.tenantId)
        .eq('staff_id', connection.professional_id)
        .gte('start_at', input.timeMin)
        .lt('start_at', input.timeMax)
        .not('google_event_id', 'is', null)

      if (appointmentsError) throw appointmentsError

      const labelsReady = new Set<string>()
      const servicesNeedingLabels = new Map<string, { id: string; name: string; color: string }>()
      for (const appointment of appointments ?? []) {
        const googleEvent = eventsById.get(appointment.google_event_id)
        const service = appointment.services as {
          id?: string
          name?: string
          color?: string | null
        } | null
        if (
          googleEvent?.status !== 'cancelled' &&
          service?.id &&
          googleEvent?.eventLabelId !== service.id
        ) {
          servicesNeedingLabels.set(service.id, {
            id: service.id,
            name: service.name?.trim() || 'Servizio',
            color: service.color || '#2563EB',
          })
        }
      }

      for (const service of servicesNeedingLabels.values()) {
        try {
          const ready = await ensureGoogleCalendarEventLabel({
            accessToken: token.access_token,
            calendarId: connection.calendar_id,
            label: {
              id: service.id,
              name: service.name,
              backgroundColor: service.color,
            },
          })
          if (ready) labelsReady.add(service.id)
        } catch (labelError) {
          console.warn('Google Calendar existing label sync skipped:', labelError)
        }
      }

      for (const appointment of appointments ?? []) {
        result.checked += 1
        const googleEvent = eventsById.get(appointment.google_event_id)
        if (!googleEvent) continue

        if (googleEvent.status === 'cancelled') {
          if (appointment.status !== 'cancelled') {
            const { error } = await admin
              .from('appointments')
              .update({ status: 'cancelled' })
              .eq('id', appointment.id)
              .eq('tenant_id', input.tenantId)
            if (error) throw error
            result.changed += 1
          }
          continue
        }

        const service = appointment.services as { id?: string } | null
        if (
          service?.id &&
          labelsReady.has(service.id) &&
          googleEvent.eventLabelId !== service.id
        ) {
          try {
            await updateGoogleCalendarEventLabel(
              token.access_token,
              connection.calendar_id,
              googleEvent.id,
              service.id
            )
          } catch (labelError) {
            console.warn('Google Calendar existing event label sync skipped:', labelError)
          }
        }

        const client = appointment.clients as { email?: string | null } | null
        const clientEmail = client?.email?.trim().toLowerCase()
        if (!clientEmail) continue

        const attendee = googleEvent.attendees?.find(
          item => item.email?.trim().toLowerCase() === clientEmail
        )
        const responseStatus = attendee?.responseStatus
        if (!responseStatus || !GOOGLE_ATTENDEE_STATUSES.has(responseStatus)) continue
        if (responseStatus === appointment.google_attendee_status) continue

        const { error } = await admin
          .from('appointments')
          .update({
            google_attendee_status: responseStatus,
            google_attendee_status_updated_at: new Date().toISOString(),
          })
          .eq('id', appointment.id)
          .eq('tenant_id', input.tenantId)
        if (error) throw error
        result.changed += 1
      }

      await admin
        .from('google_calendar_connections')
        .update({ last_error: null })
        .eq('id', connection.id)
    } catch (error: any) {
      const message = error?.message ?? 'Sincronizzazione delle risposte Google non riuscita'
      result.errors.push(message)
      await admin
        .from('google_calendar_connections')
        .update({
          last_error: message,
          ...(message.includes('invalid_grant') ? { status: 'error' } : {}),
        })
        .eq('id', connection.id)
      console.error('Google Calendar response sync error:', error)
    }
  }

  return result
}
