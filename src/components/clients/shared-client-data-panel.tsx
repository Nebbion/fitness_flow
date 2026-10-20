'use client'

import { useEffect, useState } from 'react'
import { Dumbbell, Loader2, Utensils } from 'lucide-react'

export function SharedClientDataPanel({ clientId }: { clientId: string }) {
  const [data, setData] = useState<{ training: any[]; nutrition: any[] } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void (async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}/shared-data`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setData(payload)
    } catch (caught: any) { setError(caught.message ?? 'Impossibile caricare i dati condivisi') }
  })() }, [clientId])
  if (!data && !error) return <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
  if (error) return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
  if (!data?.training.length && !data?.nutrition.length) return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Il cliente non ha condiviso dati con questo studio.</div>
  return <div className="space-y-4">
    {data?.training.map(plan => <section key={`training-${plan.id}`} className="rounded-lg border bg-card p-4"><div className="flex items-center gap-2"><Dumbbell className="h-4 w-4 text-primary" /><h2 className="font-semibold">{plan.title}</h2></div>
      <p className="mt-1 text-xs text-muted-foreground">Condivisa da {plan.ownerName}</p><ul className="mt-3 space-y-1 text-sm">{(plan.exercises ?? []).map((exercise: any) => <li key={exercise.id}>{exercise.name} · {exercise.targetSets} x {exercise.targetReps}</li>)}</ul></section>)}
    {data?.nutrition.map(plan => <section key={`nutrition-${plan.id}`} className="rounded-lg border bg-card p-4"><div className="flex items-center gap-2"><Utensils className="h-4 w-4 text-primary" /><h2 className="font-semibold">{plan.title}</h2></div>
      <p className="mt-1 text-xs text-muted-foreground">Condiviso da {plan.ownerName}</p>{plan.objective && <p className="mt-3 text-sm">{plan.objective}</p>}{plan.target_calories != null && <p className="mt-2 text-sm">Target: {plan.target_calories} kcal</p>}</section>)}
  </div>
}
