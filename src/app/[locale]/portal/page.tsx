import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPortalClientMemberships } from '@/lib/portal/client-memberships'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { Calendar, Dumbbell, FileText, TrendingUp, Utensils } from 'lucide-react'
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

  const memberships = await getPortalClientMemberships(user.id)
  if (!memberships.length) redirect(`/${locale}/auth/login`)
  const clientIds = memberships.map(item => item.id)
  const client = memberships[0]
  const admin = createAdminClient() as any

  // Prossimo appuntamento + statistiche
  const [
    { data: nextAppointment },
    { count: totalAppointments },
    { count: totalDocuments },
    { data: lastProgress },
  ] = await Promise.all([
    admin
      .from('appointments')
      .select('id, start_at, end_at, status, services(name), profiles!appointments_staff_id_fkey(full_name)')
      .in('client_id', clientIds)
      .gte('start_at', new Date().toISOString())
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    admin
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .in('client_id', clientIds)
      .eq('status', 'completed'),

    admin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .in('client_id', clientIds)
      .eq('visible_to_client', true),

    admin
      .from('progress_entries')
      .select('weight_kg, body_fat_pct, recorded_at')
      .in('client_id', clientIds)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const firstName = client.full_name?.split(' ')[0] ?? ''
  const tenant = client.tenants
  const supportsTraining = memberships.some(item => ['personal_trainer', 'nutritionist'].includes(item.tenants?.profession ?? ''))
  const supportsNutrition = memberships.some(item => item.tenants?.profession === 'nutritionist')
  const quickLinks = [
    { href: `/${locale}/portal/appointments`, icon: Calendar, label: t('appointments.title'), color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
    ...(supportsTraining ? [{ href: `/${locale}/portal/training`, icon: Dumbbell, label: 'La mia scheda', color: 'text-red-600 bg-red-50 dark:bg-red-950/20' }] : []),
    ...(supportsNutrition ? [{ href: `/${locale}/portal/nutrition`, icon: Utensils, label: 'La mia alimentazione', color: 'text-green-700 bg-green-50 dark:bg-green-950/20' }] : []),
    { href: `/${locale}/portal/documents`, icon: FileText, label: t('documents.title'), color: 'text-cyan-700 bg-cyan-50 dark:bg-cyan-950/20' },
    { href: `/${locale}/portal/progress`, icon: TrendingUp, label: t('progress.title'), color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/20' },
  ]

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(item => {
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
