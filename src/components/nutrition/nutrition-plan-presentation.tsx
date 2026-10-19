import type { NutritionDay } from '@/lib/nutrition/schemas'
import { ChevronDown } from 'lucide-react'
import { calculatePlanAverage, sumNutritionFoods, sumNutritionMeals, type NutritionTotals } from '@/lib/nutrition/calculations'

export interface NutritionPlanDisplay {
  title: string
  objective?: string
  guidelines?: string
  target_calories?: number | null
  targetCalories?: number | null
  days: NutritionDay[]
  updated_at?: string
}

function value(value: number | null, suffix: string) {
  return value === null ? '—' : `${Math.round(value * 10) / 10}${suffix}`
}

export function NutritionTotalsLine({ totals, compact = false }: { totals: NutritionTotals; compact?: boolean }) {
  return <div className={`flex flex-wrap gap-x-4 gap-y-1 ${compact ? 'text-xs' : 'text-sm'}`}>
    <span><strong>{value(totals.calories, '')}</strong> kcal</span>
    <span>P {value(totals.proteinG, ' g')}</span>
    <span>C {value(totals.carbsG, ' g')}</span>
    <span>G {value(totals.fatG, ' g')}</span>
  </div>
}

export function NutritionPlanContent({ plan, tenant, client }: {
  plan: NutritionPlanDisplay
  tenant: { name: string; logo_url?: string | null }
  client: { full_name: string }
}) {
  const average = calculatePlanAverage(plan.days)
  const target = plan.target_calories ?? plan.targetCalories ?? null

  return <article className="nutrition-print space-y-7 bg-background text-foreground">
    <header className="flex items-start justify-between gap-6 border-b pb-5">
      <div>
        <p className="text-sm text-muted-foreground">{tenant.name}</p>
        <h1 className="mt-1 text-2xl font-semibold">{plan.title}</h1>
        <p className="mt-1 text-sm">Piano alimentare di {client.full_name}</p>
      </div>
      {tenant.logo_url && <img src={tenant.logo_url} alt="" className="h-14 w-14 object-contain" />}
    </header>

    {(plan.objective || plan.guidelines) && <section className="grid gap-5 md:grid-cols-2">
      {plan.objective && <div><h2 className="text-sm font-semibold">Obiettivo</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{plan.objective}</p></div>}
      {plan.guidelines && <div><h2 className="text-sm font-semibold">Indicazioni generali</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{plan.guidelines}</p></div>}
    </section>}

    <section className="border-y py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs text-muted-foreground">Media giornaliera del piano</p><NutritionTotalsLine totals={average} /></div>
        {target !== null && <div className="text-right"><p className="text-xs text-muted-foreground">Obiettivo energetico</p><p className="font-semibold">{target} kcal/giorno</p></div>}
      </div>
    </section>

    {plan.days.map(day => {
      const dayTotals = sumNutritionMeals(day.meals)
      return <details open key={day.id} className="nutrition-day border-y border-border">
        <summary className="nutrition-day-heading flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold"><ChevronDown className="nutrition-chevron h-4 w-4 shrink-0 print:hidden" /><span className="break-words">{day.label}</span></h2>
          <NutritionTotalsLine totals={dayTotals} compact />
        </summary>
        <div className="space-y-5 p-3 sm:p-5">
          {day.meals.map(meal => <details open key={meal.id} className="nutrition-meal break-inside-avoid-page border-l-4 pl-3">
            <summary className="nutrition-meal-heading flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
              <h3 className="flex items-center gap-2 font-medium"><ChevronDown className="nutrition-chevron h-4 w-4 shrink-0 print:hidden" /><span className="break-words">{meal.name}{meal.time ? <span className="ml-2 text-xs font-normal text-muted-foreground">{meal.time}</span> : null}</span></h3>
              <NutritionTotalsLine totals={sumNutritionFoods(meal.foods)} compact />
            </summary>
            {meal.foods.length > 0 && <div className="mt-2 overflow-hidden rounded border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted"><tr><th className="px-3 py-2">Alimento</th><th className="px-3 py-2">Quantità</th><th className="px-3 py-2 text-right">kcal</th><th className="hidden px-3 py-2 text-right sm:table-cell">P / C / G</th></tr></thead>
                <tbody className="divide-y">{meal.foods.map(food => <tr key={food.id}>
                  <td className="px-3 py-2"><span className="font-medium">{food.name}</span>{food.notes && <span className="block text-muted-foreground">{food.notes}</span>}</td>
                  <td className="px-3 py-2">{food.quantity || '—'}</td>
                  <td className="px-3 py-2 text-right">{food.calories ?? '—'}</td>
                  <td className="hidden px-3 py-2 text-right sm:table-cell">{value(food.proteinG, '')} / {value(food.carbsG, '')} / {value(food.fatG, '')}</td>
                </tr>)}</tbody>
              </table>
            </div>}
            {meal.notes && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{meal.notes}</p>}
            {meal.alternatives && <p className="mt-2 whitespace-pre-wrap border-l-2 border-primary pl-3 text-xs leading-5"><strong>Alternative:</strong> {meal.alternatives}</p>}
          </details>)}
        </div>
      </details>
    })}
  </article>
}

export function PrintableNutritionPlan(props: Parameters<typeof NutritionPlanContent>[0]) {
  return <div className="hidden print:block"><NutritionPlanContent {...props} /></div>
}
