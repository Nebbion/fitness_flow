import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { withSignedExerciseImages } from '@/lib/training/media'
import { PortalTrainingPlan } from '@/components/training/portal-training-plan'

interface PageProps { params: Promise<{ locale: string }> }

export const metadata: Metadata = { title: 'La mia scheda', robots: { index: false, follow: false } }

export default async function PortalTrainingPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: client } = await supabase.from('clients').select('id, tenant_id, full_name')
    .eq('profile_id', user.id).single()
  if (!client) redirect(`/${locale}/auth/login`)

  const admin = createAdminClient() as any
  const [{ data: plan }, { data: tenant }] = await Promise.all([
    admin.from('training_plans').select('title, exercises, updated_at')
      .eq('client_id', client.id).eq('tenant_id', client.tenant_id).maybeSingle(),
    admin.from('tenants').select('name, logo_url').eq('id', client.tenant_id).single(),
  ])

  const signedPlan = await withSignedExerciseImages(admin, plan)
  return <PortalTrainingPlan plan={signedPlan} tenant={tenant ?? { name: 'FitnessFlow' }} client={client} />
}
