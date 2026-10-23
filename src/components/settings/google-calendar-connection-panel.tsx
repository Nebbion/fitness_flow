'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, CheckCircle2, Link2, Loader2, Save, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'

interface Connection {
  id: string
  google_account_email: string | null
  calendar_id: string
  calendar_name: string | null
  calendar_timezone: string | null
  status: 'active' | 'disconnected' | 'error'
  last_error: string | null
  connected_at: string
}

interface CalendarOption {
  id: string
  summary: string
  primary: boolean
  timeZone: string | null
  accessRole: string
}

export function GoogleCalendarConnectionPanel({ locale }: { locale: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connection, setConnection] = useState<Connection | null>(null)
  const [calendars, setCalendars] = useState<CalendarOption[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState('')
  const [setupReady, setSetupReady] = useState(false)
  const [labelsReady, setLabelsReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  async function refreshStatus() {
    setLoading(true)
    try {
      const response = await fetch('/api/integrations/google-calendar/status', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Impossibile leggere lo stato Google Calendar')
      setConnection(data.connection)
      setCalendars(data.calendars ?? [])
      setSelectedCalendarId(data.connection?.calendar_id ?? '')
      setSetupReady(data.setupReady)
      setLabelsReady(data.labelsReady === true)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  useEffect(() => {
    const result = searchParams.get('google_calendar')
    if (result === 'connected') toast.success('Google Calendar collegato')
    if (result === 'error') {
      const reason = searchParams.get('reason')
      toast.error(reason === 'access_denied'
        ? 'Autorizzazione Google annullata'
        : 'Collegamento Google Calendar non riuscito')
    }
    if (result) router.replace(`/${locale}/dashboard/settings?tab=calendar`, { scroll: false })
  }, [locale, router, searchParams])

  function connect() {
    window.location.assign(`/api/integrations/google-calendar/connect?locale=${encodeURIComponent(locale)}`)
  }

  async function saveCalendar() {
    if (!selectedCalendarId) return
    setSaving(true)
    try {
      const response = await fetch('/api/integrations/google-calendar/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: selectedCalendarId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Salvataggio non riuscito')
      toast.success('Calendario di destinazione aggiornato')
      await refreshStatus()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnettere Google Calendar? Gli appuntamenti già sincronizzati resteranno nel calendario.')) return
    setDisconnecting(true)
    try {
      const response = await fetch('/api/integrations/google-calendar/disconnect', { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Disconnessione non riuscita')
      toast.success('Google Calendar disconnesso')
      await refreshStatus()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) return <div className="h-40 rounded-lg bg-muted animate-pulse" />

  const connected = connection?.status === 'active'
  const selectedCalendar = calendars.find(calendar => calendar.id === selectedCalendarId)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google Calendar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {connected ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Account Google collegato</p>
                  <p className="text-sm text-muted-foreground">
                    {connection.google_account_email ?? connection.calendar_name ?? 'Google Calendar'}
                  </p>
                  {connection.calendar_timezone && (
                    <p className="mt-1 text-xs text-muted-foreground">Fuso: {connection.calendar_timezone}</p>
                  )}
                  {connection.last_error && (
                    <p className="mt-2 text-xs text-destructive">{connection.last_error}</p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={disconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="animate-spin" /> : <Unplug />}
                Disconnetti
              </Button>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              {!labelsReady && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Autorizza la gestione delle etichette per distinguere gli appuntamenti in base al servizio.
                  </p>
                  <Button variant="outline" size="sm" onClick={connect}>
                    <Link2 />
                    Abilita etichette
                  </Button>
                </div>
              )}
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Calendario per gli appuntamenti</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                  value={selectedCalendarId}
                  onChange={event => setSelectedCalendarId(event.target.value)}
                >
                  {calendars.map(calendar => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.summary}{calendar.primary ? ' (principale)' : ''}
                      {calendar.accessRole !== 'owner' ? ' (senza etichette)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted-foreground">
                FitnessFlow userà questo calendario come destinazione degli appuntamenti e assocerà automaticamente l’etichetta del servizio.
              </p>
              {selectedCalendar && selectedCalendar.accessRole !== 'owner' && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Puoi aggiungere eventi a questo calendario condiviso, ma soltanto il proprietario può crearvi le etichette.
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  onClick={saveCalendar}
                  disabled={saving || !selectedCalendarId || selectedCalendarId === connection.calendar_id}
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  Salva calendario
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Collega il tuo account e scegli il calendario nel quale pubblicare gli appuntamenti FitnessFlow.
              </p>
            </div>
            {!setupReady && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                L’amministratore deve prima configurare le credenziali OAuth Google.
              </p>
            )}
            {connection?.last_error && <p className="text-sm text-destructive">{connection.last_error}</p>}
            <Button onClick={connect} disabled={!setupReady}>
              <Link2 />
              {connection ? 'Ricollega Google Calendar' : 'Collega Google Calendar'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
