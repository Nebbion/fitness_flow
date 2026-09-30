'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/index'
import { formatDateTime } from '@/lib/utils'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface ClientAppointmentsListProps {
  clientId: string
  locale: string
  role: UserRole
  tenantId: string
}

const STATUS_STYLES: Record<string, string> = {
  scheduled:  'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  confirmed:  'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
  completed:  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  cancelled:  'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  no_show:    'bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400',
}

export function ClientAppointmentsList({
  clientId, locale, role, tenantId,
}: ClientAppointmentsListProps) {
  const t = useTranslations('appointments')
  const supabase = createSupabaseClient()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('appointments')
        .select(`
          id, start_at, end_at, status, notes,
          services (name, color),
          profiles!appointments_staff_id_fkey (full_name)
        `)
        .eq('client_id', clientId)
        .order('start_at', { ascending: false })
        .limit(30)
      setAppointments(data ?? [])
      setLoading(false)
    }
    load()
  }, [clientId])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {appointments.length} appuntamenti totali
        </p>
        {role !== 'CLIENT' && (
          <Button size="sm" asChild>
            <a href={`/${locale}/dashboard/appointments/new?client=${clientId}`}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nuovo appuntamento
            </a>
          </Button>
        )}
      </div>

      {appointments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('noAppointments')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map(appt => (
            <a
              key={appt.id}
              href={`/${locale}/dashboard/appointments/${appt.id}`}
              className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-accent/30 transition-all"
            >
              <div
                className="w-1.5 h-12 rounded-full shrink-0"
                style={{ background: appt.services?.color ?? '#2563EB' }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{appt.services?.name ?? 'Appuntamento'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {appt.profiles?.full_name} · {formatDateTime(appt.start_at, locale === 'it' ? 'it-IT' : 'en-GB')}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_STYLES[appt.status] ?? ''}`}>
                {t(`status.${appt.status}`)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
