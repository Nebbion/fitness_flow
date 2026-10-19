import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PortalNutritionPlan } from '@/components/nutrition/portal-nutrition-plan'
import { createAdminClient, createClient } from '@/lib/supabase/server'

interface PageProps { params: Promise<{ locale: string }> }

export const metadata: Metadata = { title: 'La mia alimentazione', robots: { index: false, follow: false } }

export default async function PortalNutritionPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: client } = await supabase.from('clients').select('id, tenant_id, full_name').eq('profile_id', user.id).single()
  if (!client) redirect(`/${locale}/auth/login`)

  const admin = createAdminClient() as any
  const [{ data: tenant }, plansResult] = await Promise.all([
    admin.from('tenants').select('name, logo_url, profession').eq('id', client.tenant_id).single(),
    admin.from('nutrition_plans').select('id, title, objective, guidelines, target_calories, days, updated_at, starts_on, ends_on, initial_measurements, final_measurements')
      .eq('client_id', client.id).eq('tenant_id', client.tenant_id).order('created_at', { ascending: false }),
  ])
  if (tenant?.profession !== 'nutritionist') redirect(`/${locale}/portal`)

  if (plansResult.error) throw new Error('Impossibile caricare i piani alimentari')
  return <PortalNutritionPlan plans={plansResult.data ?? []} tenant={tenant ?? { name: 'FitnessFlow' }} client={client} />
}
