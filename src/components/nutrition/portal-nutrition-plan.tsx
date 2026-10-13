'use client'

import { Printer, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NutritionPlanContent, PrintableNutritionPlan, type NutritionPlanDisplay } from './nutrition-plan-presentation'

export function PortalNutritionPlan({ plan, tenant, client }: {
  plan: NutritionPlanDisplay | null
  tenant: { name: string; logo_url?: string | null }
  client: { full_name: string }
}) {
  if (!plan) return <div className="rounded-md border border-dashed p-10 text-center">
    <Utensils className="mx-auto h-8 w-8 text-muted-foreground" />
    <h1 className="mt-3 font-medium">Nessun piano alimentare assegnato</h1>
    <p className="mt-1 text-sm text-muted-foreground">Il nutrizionista non ha ancora pubblicato il tuo piano.</p>
  </div>

  return <>
    <PrintableNutritionPlan plan={plan} tenant={tenant} client={client} />
    <div className="space-y-5 print:hidden">
      <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">La mia alimentazione</h1><p className="mt-1 text-sm text-muted-foreground">{plan.title}</p></div>
        <Button variant="outline" onClick={() => window.print()}><Printer />Stampa</Button></div>
      <NutritionPlanContent plan={plan} tenant={tenant} client={client} />
    </div>
  </>
}
