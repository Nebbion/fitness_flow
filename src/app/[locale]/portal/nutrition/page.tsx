import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PortalNutritionPlan } from '@/components/nutrition/portal-nutrition-plan'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getPortalClientMemberships } from '@/lib/portal/client-memberships'

interface PageProps { params: Promise<{ locale: string }> }

export const metadata: Metadata = { title: 'La mia alimentazione', robots: { index: false, follow: false } }

export default async function PortalNutritionPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const admin = createAdminClient() as any
  const memberships = await getPortalClientMemberships(user.id)
  const nutritionMemberships = memberships.filter(item => item.tenants?.profession === 'nutritionist')
  if (!nutritionMemberships.length) redirect(`/${locale}/portal`)
  const clientIds = nutritionMemberships.map(item => item.id)
  const [plansWithHistoryResult] = await Promise.all([
    admin.from('nutrition_plans').select('id, title, objective, guidelines, target_calories, days, updated_at, starts_on, ends_on, initial_measurements, final_measurements')
      .in('client_id', clientIds).order('created_at', { ascending: false }),
  ])

  // Keep existing portals usable while the nutrition-history migration is deployed.
  const plansResult = plansWithHistoryResult.error?.code === '42703'
    ? await admin.from('nutrition_plans').select('id, title, objective, guidelines, target_calories, days, updated_at')
      .in('client_id', clientIds).order('created_at', { ascending: false })
    : plansWithHistoryResult

  if (plansResult.error) throw new Error('Impossibile caricare i piani alimentari')
  return <PortalNutritionPlan plans={plansResult.data ?? []} tenant={nutritionMemberships[0]?.tenants ?? { name: 'FitnessFlow' }} client={{ full_name: nutritionMemberships[0]?.full_name ?? '' }} />
}
