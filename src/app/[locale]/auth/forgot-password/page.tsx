import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.passwordRecovery' })
  return { title: t('requestTitle') }
}

export default async function ForgotPasswordPage({ params, searchParams }: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { locale } = await params
  const { error } = await searchParams
  const t = await getTranslations({ locale, namespace: 'auth.passwordRecovery' })
  return <div className="space-y-6">
    <div className="text-center"><h1 className="text-2xl font-semibold text-white">{t('requestTitle')}</h1><p className="mt-1 text-sm text-slate-400">{t('requestSubtitle')}</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-black/20 dark:border-slate-800 dark:bg-slate-900">
      <ForgotPasswordForm locale={locale} initialError={error} />
    </div>
  </div>
}
