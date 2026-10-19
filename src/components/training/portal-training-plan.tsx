'use client'

import { Dumbbell, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExerciseGallery, PrintableTrainingPlan } from './training-plan-presentation'

export function PortalTrainingPlan({ plan, tenant, client }: { plan: any; tenant: any; client: any }) {
  if (!plan) return <div className="rounded-md border border-dashed p-10 text-center">
    <Dumbbell className="mx-auto h-8 w-8 text-muted-foreground" />
    <h2 className="mt-3 font-medium">Nessuna scheda assegnata</h2>
    <p className="mt-1 text-sm text-muted-foreground">Il professionista non ha ancora pubblicato una scheda di allenamento.</p>
  </div>

  const exercises = plan.exercises ?? []
  return <>
    <PrintableTrainingPlan tenant={tenant} client={client} exercises={exercises} title={plan.title} />
    <div className="space-y-5 print:hidden">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">La mia scheda</h1><p className="mt-1 text-sm text-muted-foreground">{plan.title}</p></div>
        <Button variant="outline" onClick={() => window.print()}><Printer />Stampa</Button>
      </div>
      <div className="space-y-4">
        {exercises.map((exercise: any, index: number) => <section key={exercise.id} className="overflow-hidden rounded-md border border-border bg-background">
          <div className="p-4 md:p-5"><div className="flex items-start justify-between gap-4"><div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Esercizio {index + 1}</p><h2 className="mt-1 font-semibold">{exercise.name}</h2></div>
            <p className="shrink-0 text-sm"><strong>{exercise.targetSets}</strong> serie · <strong>{exercise.targetReps}</strong> rip.</p></div>
            {exercise.notes && <p className="mt-3 text-sm leading-6">{exercise.notes}</p>}
            {exercise.isometrySeconds != null && <p className="mt-2 text-sm">Tempo dell'esercizio - isometria: <strong>{exercise.isometrySeconds} s</strong></p>}
            <ExerciseGallery images={exercise.images} name={exercise.name} />
          </div>
        </section>)}
      </div>
    </div>
  </>
}
