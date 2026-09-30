import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RegisterForm } from '@/components/auth/register-form'
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
  const t = await getTranslations({ locale, namespace: 'auth.register' })
  return { title: t('title') }
}

export default async function RegisterPage({ params }: PageProps) {
  const { locale } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect(`/${locale}`)

  const t = await getTranslations({ locale, namespace: 'auth.register' })

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">{t('title')}</h1>
        <p className="text-slate-400 mt-1 text-sm">{t('subtitle')}</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-black/20 p-8 border border-slate-200 dark:border-slate-800">
        <RegisterForm locale={locale} />
      </div>

      <p className="text-center text-sm text-slate-400">
        {t('hasAccount')}{' '}
        <a
          href={`/${locale}/auth/login`}
          className="text-primary font-medium hover:underline"
        >
          {t('login')}
        </a>
      </p>
    </div>
  )
}
