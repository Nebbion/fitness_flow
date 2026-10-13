'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Plus, Printer, Save, Trash2, Utensils } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui/index'
import type { NutritionDay, NutritionFood, NutritionMeal } from '@/lib/nutrition/schemas'
import { calculatePlanAverage, sumNutritionFoods, sumNutritionMeals } from '@/lib/nutrition/calculations'
import { NutritionTotalsLine, PrintableNutritionPlan, type NutritionPlanDisplay } from './nutrition-plan-presentation'

const newMeal = (name = 'Colazione'): NutritionMeal => ({ id: crypto.randomUUID(), name, time: '', notes: '', alternatives: '', foods: [] })
const newDay = (label = 'Giorno tipo'): NutritionDay => ({ id: crypto.randomUUID(), label, meals: [newMeal()] })
const newFood = (): NutritionFood => ({ id: crypto.randomUUID(), name: '', quantity: '', calories: null, proteinG: null, carbsG: null, fatG: null, notes: '' })

function nullableNumber(value: string) {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function NutritionPlanPanel({ clientId, clientName, tenant }: {
  clientId: string
  clientName: string
  tenant: { name: string; logo_url?: string | null }
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('Piano alimentare')
  const [objective, setObjective] = useState('')
  const [guidelines, setGuidelines] = useState('')
  const [targetCalories, setTargetCalories] = useState<number | null>(null)
  const [days, setDays] = useState<NutritionDay[]>([])
  const [hasSavedPlan, setHasSavedPlan] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(`/api/clients/${clientId}/nutrition`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      if (payload.plan) {
        setTitle(payload.plan.title)
        setObjective(payload.plan.objective ?? '')
        setGuidelines(payload.plan.guidelines ?? '')
        setTargetCalories(payload.plan.target_calories ?? null)
        setDays(payload.plan.days ?? [])
        setHasSavedPlan(true)
      } else {
        setDays([newDay()])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossibile caricare il piano')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [clientId])

  function updateDay(dayIndex: number, patch: Partial<NutritionDay>) {
    setDays(value => value.map((day, index) => index === dayIndex ? { ...day, ...patch } : day))
  }

  function updateMeal(dayIndex: number, mealIndex: number, patch: Partial<NutritionMeal>) {
    setDays(value => value.map((day, index) => index !== dayIndex ? day : {
      ...day, meals: day.meals.map((meal, inner) => inner === mealIndex ? { ...meal, ...patch } : meal),
    }))
  }

  function updateFood(dayIndex: number, mealIndex: number, foodIndex: number, patch: Partial<NutritionFood>) {
    const meal = days[dayIndex].meals[mealIndex]
    updateMeal(dayIndex, mealIndex, { foods: meal.foods.map((food, index) => index === foodIndex ? { ...food, ...patch } : food) })
  }

  async function save() {
    setSaving(true)
    try {
      const response = await fetch(`/api/clients/${clientId}/nutrition`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, objective, guidelines, targetCalories, days }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setHasSavedPlan(true)
      toast.success('Piano alimentare salvato e disponibile nel portale cliente.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossibile salvare il piano')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="h-56 animate-pulse rounded-md bg-muted" />

  const displayPlan: NutritionPlanDisplay = { title, objective, guidelines, targetCalories, days }
  const average = calculatePlanAverage(days)

  return <div className="space-y-5 print:space-y-0">
    {hasSavedPlan && <PrintableNutritionPlan plan={displayPlan} tenant={tenant} client={{ full_name: clientName }} />}
    <div className="space-y-5 print:hidden">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle className="text-base">Piano alimentare</CardTitle><p className="mt-1 text-xs text-muted-foreground">I valori nutrizionali non compilati non vengono stimati.</p></div>
          {hasSavedPlan && <Button variant="outline" onClick={() => window.print()}><Printer />Stampa</Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
            <label className="text-xs text-muted-foreground">Titolo<Input className="mt-1" value={title} onChange={event => setTitle(event.target.value)} /></label>
            <label className="text-xs text-muted-foreground">Obiettivo kcal/giorno<Input className="mt-1" type="number" min={0} max={10000} value={targetCalories ?? ''} onChange={event => setTargetCalories(nullableNumber(event.target.value))} placeholder="Non definito" /></label>
          </div>
          <label className="block text-xs text-muted-foreground">Obiettivo<textarea className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm" rows={2} value={objective} onChange={event => setObjective(event.target.value)} placeholder="Obiettivo del percorso alimentare" /></label>
          <label className="block text-xs text-muted-foreground">Indicazioni generali<textarea className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm" rows={4} value={guidelines} onChange={event => setGuidelines(event.target.value)} placeholder="Idratazione, frequenze, integrazione, indicazioni generali..." /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div><p className="text-xs text-muted-foreground">Media giornaliera</p><NutritionTotalsLine totals={average} /></div>
            {targetCalories !== null && average.calories !== null && <p className="text-sm"><span className="text-muted-foreground">Scostamento medio:</span> <strong>{Math.round(average.calories - targetCalories)} kcal</strong></p>}
          </div>
        </CardContent>
      </Card>

      {days.map((day, dayIndex) => <Card key={day.id}>
        <CardHeader className="flex-row items-center gap-2 py-4">
          <Input className="max-w-sm font-medium" value={day.label} onChange={event => updateDay(dayIndex, { label: event.target.value })} aria-label="Nome giorno" />
          <div className="ml-auto flex items-center gap-1"><NutritionTotalsLine totals={sumNutritionMeals(day.meals)} compact />
            <Button size="icon" variant="ghost" aria-label={collapsed[day.id] ? 'Espandi giorno' : 'Comprimi giorno'} onClick={() => setCollapsed(value => ({ ...value, [day.id]: !value[day.id] }))}>{collapsed[day.id] ? <ChevronDown /> : <ChevronUp />}</Button>
            <Button size="icon" variant="ghost" aria-label="Elimina giorno" disabled={days.length === 1} onClick={() => setDays(value => value.filter(item => item.id !== day.id))}><Trash2 /></Button></div>
        </CardHeader>
        {!collapsed[day.id] && <CardContent className="space-y-5">
          {day.meals.map((meal, mealIndex) => <section key={meal.id} className="border-t pt-4 first:border-t-0 first:pt-0">
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
              <Input value={meal.name} onChange={event => updateMeal(dayIndex, mealIndex, { name: event.target.value })} placeholder="Nome pasto" />
              <Input value={meal.time} onChange={event => updateMeal(dayIndex, mealIndex, { time: event.target.value })} placeholder="Orario" />
              <Button size="icon" variant="ghost" aria-label="Elimina pasto" disabled={day.meals.length === 1} onClick={() => updateDay(dayIndex, { meals: day.meals.filter(item => item.id !== meal.id) })}><Trash2 /></Button>
            </div>

            <div className="mt-3 space-y-2">
              {meal.foods.map((food, foodIndex) => <div key={food.id} className="grid grid-cols-2 gap-2 rounded-md border p-3 md:grid-cols-[minmax(10rem,2fr)_8rem_repeat(4,5rem)_2.5rem]">
                <Input className="col-span-2 md:col-span-1" value={food.name} onChange={event => updateFood(dayIndex, mealIndex, foodIndex, { name: event.target.value })} placeholder="Alimento" />
                <Input value={food.quantity} onChange={event => updateFood(dayIndex, mealIndex, foodIndex, { quantity: event.target.value })} placeholder="Quantità" />
                {(['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((key, index) => <Input key={key} type="number" min={0} max={10000} value={food[key] ?? ''} onChange={event => updateFood(dayIndex, mealIndex, foodIndex, { [key]: nullableNumber(event.target.value) })} placeholder={['kcal', 'P g', 'C g', 'G g'][index]} aria-label={['Calorie', 'Proteine', 'Carboidrati', 'Grassi'][index]} />)}
                <Button size="icon" variant="ghost" aria-label="Elimina alimento" onClick={() => updateMeal(dayIndex, mealIndex, { foods: meal.foods.filter(item => item.id !== food.id) })}><Trash2 /></Button>
                <Input className="col-span-2 md:col-span-full" value={food.notes} onChange={event => updateFood(dayIndex, mealIndex, foodIndex, { notes: event.target.value })} placeholder="Note alimento (facoltative)" />
              </div>)}
              <div className="flex flex-wrap items-center justify-between gap-2"><Button size="sm" variant="outline" onClick={() => updateMeal(dayIndex, mealIndex, { foods: [...meal.foods, newFood()] })}><Plus />Alimento</Button><NutritionTotalsLine totals={sumNutritionFoods(meal.foods)} compact /></div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <textarea className="rounded-md border border-input bg-background p-3 text-sm" rows={2} value={meal.notes} onChange={event => updateMeal(dayIndex, mealIndex, { notes: event.target.value })} placeholder="Preparazione e note del pasto" />
              <textarea className="rounded-md border border-input bg-background p-3 text-sm" rows={2} value={meal.alternatives} onChange={event => updateMeal(dayIndex, mealIndex, { alternatives: event.target.value })} placeholder="Alternative (non incluse nei totali)" />
            </div>
          </section>)}
          <Button variant="outline" onClick={() => updateDay(dayIndex, { meals: [...day.meals, newMeal('Nuovo pasto')] })}><Plus />Pasto</Button>
        </CardContent>}
      </Card>)}

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="outline" onClick={() => setDays(value => [...value, newDay(`Giorno ${value.length + 1}`)])}><Plus />Giorno</Button>
        <Button onClick={save} disabled={saving || days.length === 0}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Salva piano</Button>
      </div>
      {days.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground"><Utensils className="mx-auto mb-2" />Aggiungi il primo giorno</div>}
    </div>
  </div>
}
