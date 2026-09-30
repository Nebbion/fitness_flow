import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/auth/onboarding-wizard'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.onboarding' })
  return { title: t('title') }
}

export default async function OnboardingPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()

  // Deve essere autenticato
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  // Se ha già un tenant, vai alla dashboard
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.tenant_id) {
    redirect(`/${locale}/dashboard`)
  }

  const t = await getTranslations({ locale, namespace: 'auth.onboarding' })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-white font-semibold text-lg">FitnessFlow</span>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-white">{t('title')}</h1>
            <p className="text-slate-400 mt-2">
              {locale === 'it'
                ? `Ciao ${profile?.full_name?.split(' ')[0] ?? ''}! Configuriamo il tuo spazio in pochi minuti.`
                : `Hello ${profile?.full_name?.split(' ')[0] ?? ''}! Let's set up your space in a few minutes.`}
            </p>
          </div>

          <OnboardingWizard
            locale={locale}
            userId={user.id}
            userEmail={user.email ?? ''}
          />
        </div>
      </main>
    </div>
  )
}
