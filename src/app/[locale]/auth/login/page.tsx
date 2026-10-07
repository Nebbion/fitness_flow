import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/login-form'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ redirect?: string; error?: string; reset?: string }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.login' })
  return { title: t('title') }
}

export default async function LoginPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { redirect: redirectTo, error, reset } = await searchParams

  // Se già autenticato, redirige
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect(`/${locale}`)
  }

  const t = await getTranslations({ locale, namespace: 'auth.login' })
  const initialError = error === 'confirmation_same_browser'
    ? t('confirmationSameBrowser')
    : error

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">{t('title')}</h1>
        <p className="text-slate-400 mt-1 text-sm">{t('subtitle')}</p>
      </div>

      {/* Form card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-black/20 p-8 border border-slate-200 dark:border-slate-800">
        <LoginForm
          locale={locale}
          redirectTo={redirectTo}
          initialError={initialError}
          initialSuccess={reset === 'success' ? t('passwordUpdated') : undefined}
        />
      </div>

      {/* Link register */}
      <p className="text-center text-sm text-slate-400">
        {t('noAccount')}{' '}
        <a
          href={`/${locale}/auth/register`}
          className="text-primary font-medium hover:underline"
        >
          {t('register')}
        </a>
      </p>
    </div>
  )
}
