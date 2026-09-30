import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { Calendar, FileText, TrendingUp, Clock } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function PortalHomePage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()
  const t = await getTranslations({ locale, namespace: 'portal' })
  const tAppts = await getTranslations({ locale, namespace: 'appointments' })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  // Recupera il record cliente
  const { data: client } = await supabase
    .from('clients')
    .select('id, full_name')
    .eq('profile_id', user.id)
    .single()

  if (!client) redirect(`/${locale}/auth/login`)

  // Prossimo appuntamento + statistiche
  const [
    { data: nextAppointment },
    { count: totalAppointments },
    { count: totalDocuments },
    { data: lastProgress },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, start_at, end_at, status, services(name), profiles!appointments_staff_id_fkey(full_name)')
      .eq('client_id', client.id)
      .gte('start_at', new Date().toISOString())
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true })
      .limit(1)
      .single(),

    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('status', 'completed'),

    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('visible_to_client', true),

    supabase
      .from('progress_entries')
      .select('weight_kg, body_fat_pct, recorded_at')
      .eq('client_id', client.id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const firstName = client.full_name?.split(' ')[0] ?? ''

  return (
    <div className="space-y-6">
      {/* Saluto */}
      <div>
        <h1 className="text-2xl font-semibold">{t('welcome', { name: firstName })}</h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-GB', {
            weekday: 'long', day: 'numeric', month: 'long'
          })}
        </p>
      </div>

      {/* Prossimo appuntamento */}
      <Card className={nextAppointment ? 'border-primary/30 bg-primary/5' : ''}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{t('nextAppointment')}</p>
              {nextAppointment ? (
                <>
                  <p className="text-lg font-semibold mt-1">
                    {formatDateTime(nextAppointment.start_at, locale === 'it' ? 'it-IT' : 'en-GB')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {(nextAppointment.services as any)?.name ?? 'Appuntamento'} •{' '}
                    {(nextAppointment.profiles as any)?.full_name}
                  </p>
                  <span className="inline-block mt-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {tAppts(`status.${nextAppointment.status}`)}
                  </span>
                </>
              ) : (
                <p className="text-muted-foreground mt-1">{t('noNextAppointment')}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats rapide */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold">{totalAppointments ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Sessioni completate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold">{totalDocuments ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Documenti</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold">
              {lastProgress?.weight_kg ? `${lastProgress.weight_kg}kg` : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Ultimo peso</div>
          </CardContent>
        </Card>
      </div>

      {/* Link rapidi */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: `/${locale}/portal/appointments`, icon: Calendar, label: t('appointments.title'), color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
          { href: `/${locale}/portal/documents`,    icon: FileText, label: t('documents.title'),    color: 'text-green-600 bg-green-50 dark:bg-green-950/20' },
          { href: `/${locale}/portal/progress`,     icon: TrendingUp, label: t('progress.title'),   color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/20' },
        ].map(item => {
          const Icon = item.icon
          return (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-accent/50 transition-all"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="font-medium text-sm">{item.label}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
