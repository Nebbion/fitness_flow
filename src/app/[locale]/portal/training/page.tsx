import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { withSignedExerciseImages } from '@/lib/training/media'
import { ClientTrainingApp } from '@/components/training/client-training-app'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string }>
}

export const metadata: Metadata = { title: 'La mia scheda', robots: { index: false, follow: false } }

export default async function PortalTrainingPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const requestedView = (await searchParams).view
  const initialView = ['plan', 'workout', 'history'].includes(requestedView ?? '')
    ? requestedView as 'plan' | 'workout' | 'history'
    : 'plan'
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: client } = await supabase.from('clients').select('id, tenant_id, full_name')
    .eq('profile_id', user.id).single()
  if (!client) redirect(`/${locale}/auth/login`)

  const admin = createAdminClient() as any
  const [{ data: plan }, { data: tenant }] = await Promise.all([
    admin.from('training_plans').select('title, exercises, updated_at')
      .eq('client_id', client.id).eq('tenant_id', client.tenant_id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('tenants').select('name, logo_url, profession').eq('id', client.tenant_id).single(),
  ])

  if (!['personal_trainer', 'nutritionist'].includes(tenant?.profession ?? '')) redirect(`/${locale}/portal`)

  const signedPlan = await withSignedExerciseImages(admin, plan)
  return <ClientTrainingApp locale={locale} initialView={initialView} />
}
