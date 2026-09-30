import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewAppointmentPage } from '@/components/appointments/new-appointment-page'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ client?: string }>
}

export const metadata: Metadata = {
  title: 'Nuovo appuntamento',
}

export default async function NewAppointmentRoute({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { client: clientId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect(`/${locale}/auth/onboarding`)

  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('tenant_id', profile.tenant_id)
    .in('role', ['TENANT_ADMIN', 'STAFF'])
    .eq('active', true)

  const { data: services } = await supabase
    .from('services')
    .select('id, name, color, duration_min, price')
    .eq('tenant_id', profile.tenant_id)
    .eq('active', true)
    .order('name')

  let defaultClient = null
  if (clientId) {
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, email, phone')
      .eq('id', clientId)
      .eq('tenant_id', profile.tenant_id)
      .single()
    defaultClient = data
  }

  return (
    <NewAppointmentPage
      locale={locale}
      tenantId={profile.tenant_id}
      userId={user.id}
      role={profile.role as any}
      staffList={staffList ?? []}
      services={services ?? []}
      defaultClient={defaultClient}
    />
  )
}
