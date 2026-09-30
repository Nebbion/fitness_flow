import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/index'
import { formatDateTime } from '@/lib/utils'

interface PageProps {
  params: Promise<{ locale: string }>
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
  completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  no_show:   'bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400',
}

export default async function PortalAppointmentsPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()
  const t = await getTranslations({ locale, namespace: 'portal.appointments' })
  const tStatus = await getTranslations({ locale, namespace: 'appointments.status' })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: client } = await supabase
    .from('clients').select('id').eq('profile_id', user.id).single()
  if (!client) redirect(`/${locale}/auth/login`)

  const now = new Date().toISOString()

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    supabase.from('appointments')
      .select(`id, start_at, end_at, status, notes,
        services (name, color),
        profiles!appointments_staff_id_fkey (full_name)`)
      .eq('client_id', client.id)
      .gte('start_at', now)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true })
      .limit(20),
    supabase.from('appointments')
      .select(`id, start_at, end_at, status, notes,
        services (name, color),
        profiles!appointments_staff_id_fkey (full_name)`)
      .eq('client_id', client.id)
      .lt('start_at', now)
      .order('start_at', { ascending: false })
      .limit(20),
  ])

  function AppointmentCard({ appt }: { appt: any }) {
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border">
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
          {tStatus(appt.status as any)}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      {/* Prossimi */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('upcoming')}</h2>
        {!upcoming?.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nessun appuntamento in programma</p>
          </div>
        ) : (
          upcoming.map(appt => <AppointmentCard key={appt.id} appt={appt} />)
        )}
      </div>

      {/* Passati */}
      {!!past?.length && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('past')}</h2>
          {past.map(appt => <AppointmentCard key={appt.id} appt={appt} />)}
        </div>
      )}
    </div>
  )
}
