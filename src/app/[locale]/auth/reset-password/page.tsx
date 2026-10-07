import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.passwordRecovery' })
  return { title: t('resetTitle') }
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'auth.passwordRecovery' })
  return <div className="space-y-6">
    <div className="text-center"><h1 className="text-2xl font-semibold text-white">{t('resetTitle')}</h1><p className="mt-1 text-sm text-slate-400">{t('resetSubtitle')}</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-black/20 dark:border-slate-800 dark:bg-slate-900">
      <ResetPasswordForm locale={locale} />
    </div>
  </div>
}
