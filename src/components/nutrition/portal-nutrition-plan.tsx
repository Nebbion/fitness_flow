'use client'

import { Printer, Utensils } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { NutritionPlanContent, PrintableNutritionPlan, type NutritionPlanDisplay } from './nutrition-plan-presentation'

export function PortalNutritionPlan({ plans, tenant, client }: {
  plans: NutritionPlanDisplay[]
  tenant: { name: string; logo_url?: string | null }
  client: { full_name: string }
}) {
  const [selectedId, setSelectedId] = useState(plans[0]?.id ?? '')
  const plan = plans.find(item => item.id === selectedId) ?? plans[0]
  if (!plan) return <div className="rounded-md border border-dashed p-10 text-center">
    <Utensils className="mx-auto h-8 w-8 text-muted-foreground" />
    <h1 className="mt-3 font-medium">Nessun piano alimentare assegnato</h1>
    <p className="mt-1 text-sm text-muted-foreground">Il nutrizionista non ha ancora pubblicato il tuo piano.</p>
  </div>

  return <>
    <PrintableNutritionPlan plan={plan} tenant={tenant} client={client} />
    <div className="space-y-5 print:hidden">
      <label className="block text-sm font-medium">Piani alimentari e storico
        <select className="mt-2 h-12 w-full rounded-md border bg-background px-3" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          {plans.map(item => <option key={item.id} value={item.id}>{item.title} · {item.starts_on ?? 'Inizio non indicato'} / {item.ends_on ?? 'Fine non indicata'}</option>)}
        </select>
      </label>
      <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">La mia alimentazione</h1><p className="mt-1 text-sm text-muted-foreground">{plan.title}</p></div>
        <Button variant="outline" onClick={() => window.print()}><Printer />Stampa</Button></div>
      <NutritionPlanContent plan={plan} tenant={tenant} client={client} />
    </div>
  </>
}
