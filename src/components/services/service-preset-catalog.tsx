'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MASSAGE_SERVICE_PRESETS, type ServicePreset } from '@/lib/service-presets'

export function ServicePresetCatalog({ existingNames }: { existingNames: string[] }) {
  const router = useRouter()
  const [activating, setActivating] = useState<string | null>(null)
  const [activeNames, setActiveNames] = useState(() => new Set(existingNames.map(name => name.toLocaleLowerCase('it'))))

  async function activate(preset: ServicePreset) {
    setActivating(preset.name)
    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...preset, price: undefined, currency: 'EUR', active: true }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Impossibile attivare il servizio')
      setActiveNames(current => new Set([...current, preset.name.toLocaleLowerCase('it')]))
      toast.success(`${preset.name} aggiunto. Puoi ora modificarne durata e prezzo.`)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message ?? 'Impossibile attivare il servizio')
    } finally {
      setActivating(null)
    }
  }

  return <section className="rounded-lg border border-border bg-card p-4">
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"><Sparkles className="h-4 w-4" /></div>
      <div><h2 className="font-semibold">Servizi pronti da attivare</h2><p className="mt-1 text-sm text-muted-foreground">Disponibili per ogni categoria professionale. Durata, prezzo e descrizione restano modificabili.</p></div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {MASSAGE_SERVICE_PRESETS.map(preset => {
        const enabled = activeNames.has(preset.name.toLocaleLowerCase('it'))
        return <div key={preset.name} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3">
          <div className="min-w-0"><p className="text-sm font-medium">{preset.name}</p><p className="mt-0.5 text-xs text-muted-foreground">Durata suggerita: {preset.duration_min} min</p></div>
          <Button size="sm" variant={enabled ? 'outline' : 'default'} disabled={enabled || activating === preset.name} onClick={() => void activate(preset)}>
            {activating === preset.name ? <Loader2 className="animate-spin" /> : enabled ? <Check /> : <Plus />}
            {enabled ? 'Attivo' : 'Attiva'}
          </Button>
        </div>
      })}
    </div>
  </section>
}
