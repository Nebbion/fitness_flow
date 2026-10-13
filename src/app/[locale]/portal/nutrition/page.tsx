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
  const [{ data: tenant }, { data: plan }] = await Promise.all([
    admin.from('tenants').select('name, logo_url, profession').eq('id', client.tenant_id).single(),
    admin.from('nutrition_plans').select('title, objective, guidelines, target_calories, days, updated_at')
      .eq('client_id', client.id).eq('tenant_id', client.tenant_id).maybeSingle(),
  ])
  if (tenant?.profession !== 'nutritionist') redirect(`/${locale}/portal`)

  return <PortalNutritionPlan plan={plan} tenant={tenant ?? { name: 'FitnessFlow' }} client={client} />
}
