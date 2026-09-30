import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppointmentsCalendar } from '@/components/appointments/appointments-calendar'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string; date?: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'appointments' })
  return { title: t('title') }
}

export default async function AppointmentsPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { view = 'week', date } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect(`/${locale}/auth/onboarding`)

  // Carica appuntamenti del mese corrente + precedente + successivo
  const targetDate = date ? new Date(date) : new Date()
  const from = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1)
  const to = new Date(targetDate.getFullYear(), targetDate.getMonth() + 2, 0)

  let query = supabase
    .from('appointments')
    .select(`
      id, start_at, end_at, status, notes,
      clients (id, full_name, phone, email),
      services (id, name, color, duration_min),
      profiles!appointments_staff_id_fkey (id, full_name)
    `)
    .eq('tenant_id', profile.tenant_id)
    .gte('start_at', from.toISOString())
    .lte('start_at', to.toISOString())
    .order('start_at', { ascending: true })

  // STAFF vede solo i propri appuntamenti
  if (profile.role === 'STAFF') {
    query = query.eq('staff_id', user.id)
  }

  const { data: appointments } = await query

  // Staff list per il form
  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('tenant_id', profile.tenant_id)
    .in('role', ['TENANT_ADMIN', 'STAFF'])
    .eq('active', true)

  // Servizi per il form
  const { data: services } = await supabase
    .from('services')
    .select('id, name, color, duration_min, price')
    .eq('tenant_id', profile.tenant_id)
    .eq('active', true)
    .order('name')

  const t = await getTranslations({ locale, namespace: 'appointments' })

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button asChild>
          <a href={`/${locale}/dashboard/appointments/new`}>
            <Plus className="w-4 h-4 mr-2" />
            {t('newAppointment')}
          </a>
        </Button>
      </div>

      <AppointmentsCalendar
        appointments={appointments ?? []}
        locale={locale}
        role={profile.role as any}
        userId={user.id}
        tenantId={profile.tenant_id}
        staffList={staffList ?? []}
        services={services ?? []}
        initialView={view as any}
        initialDate={targetDate.toISOString()}
      />
    </div>
  )
}
