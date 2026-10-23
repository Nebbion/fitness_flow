'use client'

import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Trash2, X, Search } from 'lucide-react'
import { createAppointmentSchema, type CreateAppointmentInput } from '@/schemas'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/index'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface AppointmentModalProps {
  open: boolean
  onClose: () => void
  locale: string
  tenantId: string
  userId: string
  role: UserRole
  staffList: { id: string; full_name: string | null }[]
  services: any[]
  appointment?: any   // se presente → modifica
  defaultClient?: { id: string; full_name: string; email: string | null; phone: string | null } | null
  defaultSlot?: { start: Date; end: Date } | null
  onSaved: () => void
}

function toDatetimeLocal(date: Date | string): string {
  const d = new Date(date)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'))

function roundToFiveMinutes(date: Date | string) {
  const rounded = new Date(date)
  rounded.setSeconds(0, 0)
  rounded.setMinutes(Math.round(rounded.getMinutes() / 5) * 5)
  return rounded.toISOString()
}

function localDateTimeParts(value?: string) {
  if (!value) return { date: '', hour: '09', minute: '00' }
  const local = toDatetimeLocal(value)
  return {
    date: local.slice(0, 10),
    hour: local.slice(11, 13),
    minute: local.slice(14, 16),
  }
}

function AppointmentDateTimeInput({
  value,
  onChange,
  onBlur,
  inputRef,
  labels,
}: {
  value?: string
  onChange: (value: string) => void
  onBlur: () => void
  inputRef: (element: HTMLInputElement | null) => void
  labels: { date: string; hour: string; minute: string }
}) {
  const parts = localDateTimeParts(value)

  function update(partial: Partial<typeof parts>) {
    const next = { ...parts, ...partial }
    if (!next.date) return
    onChange(new Date(`${next.date}T${next.hour}:${next.minute}:00`).toISOString())
  }

  const selectClassName = 'h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_68px_auto_68px] items-center gap-2">
      <Input
        ref={inputRef}
        type="date"
        aria-label={labels.date}
        value={parts.date}
        onBlur={onBlur}
        onChange={event => update({ date: event.target.value })}
      />
      <select
        aria-label={labels.hour}
        title={labels.hour}
        className={selectClassName}
        value={parts.hour}
        onChange={event => update({ hour: event.target.value })}
      >
        {HOURS.map(hour => <option key={hour} value={hour}>{hour}</option>)}
      </select>
      <span className="text-sm font-semibold text-muted-foreground">:</span>
      <select
        aria-label={labels.minute}
        title={labels.minute}
        className={selectClassName}
        value={parts.minute}
        onChange={event => update({ minute: event.target.value })}
      >
        {MINUTES.map(minute => <option key={minute} value={minute}>{minute}</option>)}
      </select>
    </div>
  )
}

export function AppointmentModal({
  open, onClose, locale, tenantId, userId, role,
  staffList, services, appointment, defaultClient, defaultSlot, onSaved,
}: AppointmentModalProps) {
  const t = useTranslations('appointments')
  const supabase = createSupabaseClient()

  const isEditing = !!appointment
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const {
    control,
    getValues,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      client_id: '',
      staff_id: role === 'STAFF' ? userId : (staffList[0]?.id ?? ''),
      service_id: '',
      start_at: '',
      end_at: '',
      notes: '',
    },
  })

  // Inizializza il form quando cambia l'appuntamento o lo slot
  useEffect(() => {
    if (!open) return

    if (appointment) {
      setSelectedClient(appointment.clients)
      setValue('client_id', appointment.client_id)
      setValue('staff_id', appointment.staff_id)
      setValue('service_id', appointment.service_id ?? '')
      setValue('start_at', roundToFiveMinutes(appointment.start_at))
      setValue('end_at', roundToFiveMinutes(appointment.end_at))
      setValue('notes', appointment.notes ?? '')
    } else if (defaultSlot) {
      setSelectedClient(defaultClient ?? null)
      reset({
        staff_id: role === 'STAFF' ? userId : (staffList[0]?.id ?? ''),
        client_id: defaultClient?.id ?? '',
        service_id: '',
        start_at: roundToFiveMinutes(defaultSlot.start),
        end_at: roundToFiveMinutes(defaultSlot.end),
        notes: '',
      })
    }
  }, [open, appointment, defaultClient, defaultSlot, reset, role, staffList, userId, setValue])

  function updateEndFromService(startAt: string | undefined, serviceId: string | undefined) {
    if (!startAt || !serviceId) return

    const service = services.find(item => item.id === serviceId)
    const durationMinutes = Number(service?.duration_min)
    const start = new Date(startAt)
    if (!service || !Number.isFinite(durationMinutes) || durationMinutes < 5 || Number.isNaN(start.getTime())) {
      if (service && durationMinutes < 5) toast.warning(t('serviceDurationInvalid'))
      return
    }

    setValue(
      'end_at',
      new Date(start.getTime() + durationMinutes * 60_000).toISOString(),
      { shouldDirty: true, shouldValidate: true }
    )
  }

  // Ricerca clienti con debounce
  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return }
    const timeout = setTimeout(async () => {
      setSearchLoading(true)
      const { data } = await supabase
        .from('clients')
        .select('id, full_name, email, phone')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .ilike('full_name', `%${clientSearch}%`)
        .limit(8)
      setClientResults(data ?? [])
      setSearchLoading(false)
    }, 250)
    return () => clearTimeout(timeout)
  }, [clientSearch, tenantId])

  async function onSubmit(data: CreateAppointmentInput) {
    setLoading(true)
    try {
      const url = isEditing ? `/api/appointments/${appointment.id}` : '/api/appointments'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json()
      if (!res.ok) {
        if (result.error?.includes('overlap') || result.error?.includes('conflict')) {
          toast.error(t('conflict'))
        } else {
          toast.error(result.error ?? 'Errore')
        }
        return
      }

      toast.success(isEditing ? t('updateSuccess') : t('createSuccess'))
      if (result.googleCalendar?.status === 'failed') {
        toast.warning(t('googleSyncWarning'))
      } else if (
        !isEditing &&
        result.googleCalendar?.status === 'synced' &&
        result.googleCalendar?.invitedClient
      ) {
        toast.success(t('googleInviteSent'))
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(t('cancelConfirm'))) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!res.ok) throw new Error()
      const result = await res.json()
      toast.success(t('cancelSuccess'))
      if (result.googleCalendar?.status === 'failed') {
        toast.warning(t('googleSyncWarning'))
      }
      onSaved()
    } catch {
      toast.error('Errore durante l\'annullamento')
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Modifica appuntamento' : t('newAppointment')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {isEditing && appointment?.google_attendee_status === 'declined' && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
              {t('clientDeclinedGoogle')}
            </div>
          )}

          {/* Cliente */}
          <div className="space-y-2">
            <Label>{t('form.client')} *</Label>
            {selectedClient ? (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{selectedClient.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedClient.email ?? selectedClient.phone}</p>
                </div>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => { setSelectedClient(null); setValue('client_id', ''); setClientSearch('') }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('form.clientPlaceholder')}
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="pl-9"
                />
                {(clientResults.length > 0 || searchLoading) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                    {searchLoading && (
                      <div className="p-3 text-sm text-muted-foreground text-center">Ricerca...</div>
                    )}
                    {clientResults.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors"
                        onClick={() => {
                          setSelectedClient(c)
                          setValue('client_id', c.id)
                          setClientSearch('')
                          setClientResults([])
                        }}
                      >
                        <p className="text-sm font-medium">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground">{c.email ?? c.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.client_id && (
              <p className="text-xs text-destructive">Seleziona un cliente</p>
            )}
          </div>

          {/* Servizio */}
          <div className="space-y-2">
            <Label>{t('form.service')}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('service_id', {
                onChange: event => updateEndFromService(getValues('start_at'), event.target.value),
              })}
            >
              <option value="">{t('form.servicePlaceholder')}</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_min} min{s.price ? ` · €${s.price}` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Staff */}
          {role === 'TENANT_ADMIN' && staffList.length > 1 && (
            <div className="space-y-2">
              <Label>{t('form.staff')}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('staff_id')}
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Data e orari */}
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>{t('form.startTime')}</Label>
              <Controller
                control={control}
                name="start_at"
                render={({ field }) => (
                  <AppointmentDateTimeInput
                    inputRef={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    labels={{
                      date: t('form.date'),
                      hour: t('form.hour'),
                      minute: t('form.minute'),
                    }}
                    onChange={value => {
                      field.onChange(value)
                      updateEndFromService(value, getValues('service_id'))
                    }}
                  />
                )}
              />
              {errors.start_at && <p className="text-xs text-destructive">Obbligatorio</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('form.endTime')}</Label>
              <Controller
                control={control}
                name="end_at"
                render={({ field }) => (
                  <AppointmentDateTimeInput
                    inputRef={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    labels={{
                      date: t('form.date'),
                      hour: t('form.hour'),
                      minute: t('form.minute'),
                    }}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.end_at && <p className="text-xs text-destructive">Obbligatorio</p>}
            </div>
          </div>

          {/* Stato (solo modifica) */}
          {isEditing && (
            <div className="space-y-2">
              <Label>{t('form.status')}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue={appointment?.status}
                {...register('status' as any)}
              >
                {['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'].map(s => (
                  <option key={s} value={s}>{t(`status.${s}`)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div className="space-y-2">
            <Label>{t('form.notes')}</Label>
            <textarea
              placeholder={t('form.notesPlaceholder')}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              {...register('notes')}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2 border-t border-border">
            {isEditing && appointment?.status !== 'cancelled' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                Annulla appuntamento
              </Button>
            )}
            <div className={`flex gap-2 ${isEditing ? '' : 'ml-auto'}`}>
              <Button type="button" variant="outline" onClick={onClose}>Chiudi</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {isEditing ? 'Salva' : 'Crea'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
