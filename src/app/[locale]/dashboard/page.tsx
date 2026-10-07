import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime, getInitials } from '@/lib/utils'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
}

type DashboardTenant = {
  name: string | null
  logo_url: string | null
  brand_primary: string | null
  brand_accent: string | null
  plan: string | null
}

function getBrandColor(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback
}

function DashboardBrandCover({
  tenant,
  welcome,
  dateLabel,
}: {
  tenant: DashboardTenant | null
  welcome: string
  dateLabel: string
}) {
  const tenantName = tenant?.name ?? 'FitnessFlow'
  const primary = getBrandColor(tenant?.brand_primary, '#2563EB')
  const accent = getBrandColor(tenant?.brand_accent, '#06B6D4')

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-card text-white shadow-sm">
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${accent} 64%, #111827 100%)` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.72),rgba(15,23,42,0.34),rgba(15,23,42,0.14))]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.12)_1px,transparent_1px,transparent_18px)] opacity-30" />

      <div className="relative flex min-h-[190px] flex-col justify-between gap-6 p-6 sm:min-h-[220px] sm:flex-row sm:items-center sm:p-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-white/80">{dateLabel}</p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">{welcome}</h1>
          <p className="mt-2 text-sm text-white/85 sm:text-base">{tenantName}</p>
          {tenant?.plan && (
            <span className="mt-5 inline-flex rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {tenant.plan}
            </span>
          )}
        </div>

        <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-white/50 bg-white/95 p-3 shadow-sm sm:h-36 sm:w-36">
          {tenant?.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenantName}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-lg text-3xl font-semibold text-white"
              style={{ backgroundColor: primary }}
            >
              {getInitials(tenantName)}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  return { title: t('title') }
}

export default async function DashboardPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient() as any
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  const tAppts = await getTranslations({ locale, namespace: 'appointments' })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      tenant_id, full_name, role,
      tenants (name, logo_url, brand_primary, brand_accent, plan)
    `)
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect(`/${locale}/auth/onboarding`)

  const tenant = (Array.isArray(profile.tenants) ? profile.tenants[0] : profile.tenants) as DashboardTenant | null

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
  const dateLabel = new Date().toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

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
      <DashboardBrandCover
        tenant={tenant}
        welcome={t('welcome', { name: firstName })}
        dateLabel={dateLabel}
      />

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
