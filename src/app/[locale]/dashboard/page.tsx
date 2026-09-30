import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Calendar, TrendingUp, Euro } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  return { title: t('title') }
}

export default async function DashboardPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  const tAppts = await getTranslations({ locale, namespace: 'appointments' })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect(`/${locale}/auth/onboarding`)

  // Statistiche in parallelo
  const now = new Date()
  const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString()
  const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: totalClients },
    { count: todayAppointments },
    { data: upcomingAppointments },
    { data: recentClients },
  ] = await Promise.all([
    // Totale clienti attivi
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .eq('active', true),

    // Appuntamenti oggi
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .gte('start_at', startOfDay)
      .lte('end_at', endOfDay)
      .neq('status', 'cancelled'),

    // Prossimi 5 appuntamenti
    supabase
      .from('appointments')
      .select(`
        id, start_at, end_at, status,
        clients (id, full_name, phone),
        services (name, color),
        profiles!appointments_staff_id_fkey (full_name)
      `)
      .eq('tenant_id', profile.tenant_id)
      .gte('start_at', new Date().toISOString())
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true })
      .limit(5),

    // Ultimi 5 clienti aggiunti
    supabase
      .from('clients')
      .select('id, full_name, email, created_at, tags')
      .eq('tenant_id', profile.tenant_id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const firstName = profile.full_name?.split(' ')[0] ?? ''

  const stats = [
    {
      label: t('stats.totalClients'),
      value: totalClients ?? 0,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
    },
    {
      label: t('stats.appointmentsToday'),
      value: todayAppointments ?? 0,
      icon: Calendar,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950/20',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Saluto */}
      <div>
        <h1 className="text-2xl font-semibold">{t('welcome', { name: firstName })}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-semibold mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prossimi appuntamenti */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">{t('nextAppointments')}</CardTitle>
            <a
              href={`/${locale}/dashboard/appointments`}
              className="text-xs text-primary hover:underline"
            >
              {t('viewAll')}
            </a>
          </CardHeader>
          <CardContent className="p-0">
            {!upcomingAppointments?.length ? (
              <div className="px-6 pb-6 text-sm text-muted-foreground">
                {t('noAppointmentsToday')}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {upcomingAppointments.map((appt: any) => (
                  <div key={appt.id} className="flex items-center gap-4 px-6 py-3">
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ background: appt.services?.color ?? '#2563EB' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {appt.clients?.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {appt.services?.name ?? '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">
                        {formatDateTime(appt.start_at, locale === 'it' ? 'it-IT' : 'en-GB')}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        appt.status === 'confirmed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                      }`}>
                        {tAppts(`status.${appt.status}`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clienti recenti */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">{t('recentClients')}</CardTitle>
            <a
              href={`/${locale}/dashboard/clients`}
              className="text-xs text-primary hover:underline"
            >
              {t('viewAll')}
            </a>
          </CardHeader>
          <CardContent className="p-0">
            {!recentClients?.length ? (
              <div className="px-6 pb-6 text-sm text-muted-foreground">
                Nessun cliente ancora
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentClients.map((client: any) => (
                  <a
                    key={client.id}
                    href={`/${locale}/dashboard/clients/${client.id}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                      {client.full_name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{client.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{client.email ?? '—'}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {client.tags?.slice(0, 2).map((tag: string) => (
                        <span key={tag} className="text-xs bg-secondary px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
