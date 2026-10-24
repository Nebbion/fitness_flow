import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ExerciseLibrary } from '@/components/training/exercise-library'
import { getTrainingProfessional } from '@/lib/training/professional-access'

export const metadata: Metadata = { title: 'Libreria esercizi' }

export default async function ExercisesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!await getTrainingProfessional()) redirect(`/${locale}/dashboard`)
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Libreria esercizi</h1>
      <p className="mt-1 text-sm text-muted-foreground">Inserisci gli esercizi manualmente oppure importa una scheda cartacea con l’AI.</p></div>
    <ExerciseLibrary />
  </div>
}
