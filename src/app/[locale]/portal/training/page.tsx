import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPortalClientMemberships } from '@/lib/portal/client-memberships'
import { ClientTrainingApp } from '@/components/training/client-training-app'
import { hasPracticeModule } from '@/lib/practice-modules'

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

  const memberships = await getPortalClientMemberships(user.id)
  const trainingMemberships = memberships.filter(item => hasPracticeModule(item.tenants, 'training'))
  if (!trainingMemberships.length) redirect(`/${locale}/portal`)
  return <ClientTrainingApp locale={locale} initialView={initialView}
    clientOptions={trainingMemberships.map(item => ({ id: item.id, label: item.tenants?.name ?? 'Professionista' }))} />
}
