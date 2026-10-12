import type { Metadata } from 'next'
import { ExerciseLibrary } from '@/components/training/exercise-library'

export const metadata: Metadata = { title: 'Libreria esercizi' }

export default function ExercisesPage() {
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Libreria esercizi</h1>
      <p className="mt-1 text-sm text-muted-foreground">Crea il tuo catalogo con istruzioni e immagini da riutilizzare nelle schede.</p></div>
    <ExerciseLibrary />
  </div>
}
