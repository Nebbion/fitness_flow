import type { Metadata } from 'next'
import { ClientTrainingApp } from '@/components/training/client-training-app'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; token: string }> }): Promise<Metadata> {
  const { locale, token } = await params
  return {
    title: 'FitnessFlow Cliente',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    manifest: `/${locale}/train/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: 'FitnessFlow' },
  }
}

export default async function TrainingPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params
  return <ClientTrainingApp token={token} locale={locale} />
}
