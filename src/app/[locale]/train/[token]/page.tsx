import type { Metadata } from 'next'
import { ClientTrainingApp } from '@/components/training/client-training-app'

export const metadata: Metadata = {
  title: 'Allenamento',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function TrainingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <ClientTrainingApp token={token} />
}
