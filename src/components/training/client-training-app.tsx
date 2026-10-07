'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Dumbbell, Loader2, Play, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SetEntry = { reps: number | null; weightKg: number | null; notes: string }
type Entry = { exerciseId: string; sets: SetEntry[]; notes: string }

export function ClientTrainingApp({ token }: { token: string }) {
  const [data, setData] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading')
  const [error, setError] = useState('')
  const lastSaved = useRef('')
  const saveInFlight = useRef(false)

  async function load() {
    try {
      const response = await fetch(`/api/training/${token}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setData(payload)
      if (payload.openSession) useSession(payload.openSession)
      else {
        setSession(null)
        setEntries([])
        setStatus('idle')
      }
    } catch (caught: any) { setError(caught.message); setStatus('error') }
  }

  useEffect(() => { load() }, [token])

  function useSession(next: any) {
    const initial = next.entries?.length ? next.entries : (next.plan_snapshot?.exercises ?? []).map((exercise: any) => ({
      exerciseId: exercise.id,
      sets: Array.from({ length: exercise.targetSets }, () => ({ reps: null, weightKg: null, notes: '' })),
      notes: '',
    }))
    setSession(next)
    setEntries(initial)
    lastSaved.current = JSON.stringify(initial)
    setStatus('saved')
  }

  async function start() {
    setStatus('loading')
    try {
      const response = await fetch(`/api/training/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      useSession(payload.session)
    } catch (caught: any) { setError(caught.message); setStatus('error') }
  }

  async function save(complete = false) {
    if (!session || saveInFlight.current || JSON.stringify(entries) === lastSaved.current && !complete) return
    saveInFlight.current = true
    setStatus('saving')
    try {
      const response = await fetch(`/api/training/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: complete ? 'complete' : 'save', sessionId: session.id, version: session.version, entries, mutationId: crypto.randomUUID() }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      lastSaved.current = JSON.stringify(entries)
      setSession(payload.session)
      setStatus('saved')
      if (complete) await load()
    } catch (caught: any) { setError(caught.message); setStatus('error') }
    finally { saveInFlight.current = false }
  }

  useEffect(() => {
    if (!session || JSON.stringify(entries) === lastSaved.current) return
    const timer = window.setTimeout(() => save(false), 900)
    return () => window.clearTimeout(timer)
  }, [entries, session?.id, session?.version])

  const exercises = session?.plan_snapshot?.exercises ?? data?.plan?.exercises ?? []
  const previous = useMemo(() => data?.history?.[0]?.entries ?? [], [data])

  function changeSet(exerciseIndex: number, setIndex: number, field: keyof SetEntry, value: string) {
    setEntries(current => current.map((entry, i) => i !== exerciseIndex ? entry : {
      ...entry,
      sets: entry.sets.map((set, j) => j !== setIndex ? set : {
        ...set,
        [field]: field === 'notes' ? value : value === '' ? null : Number(value),
      }),
    }))
  }

  if (status === 'loading' && !data) return <main className="min-h-screen grid place-items-center bg-background"><Loader2 className="animate-spin text-primary" /></main>
  if (!data) return <main className="min-h-screen grid place-items-center p-6 bg-background"><div className="max-w-sm text-center"><h1 className="text-xl font-semibold">Accesso non disponibile</h1><p className="mt-2 text-sm text-muted-foreground">{error || 'Il link è scaduto o è stato revocato.'}</p></div></main>

  const brand = data.tenant.brand_primary || '#2563EB'
  return <main className="min-h-screen bg-muted/30 pb-28" style={{ '--brand': brand } as any}>
    <header className="bg-background border-b border-border px-4 py-4 sticky top-0 z-10">
      <div className="mx-auto max-w-2xl flex items-center gap-3">
        {data.tenant.logo_url ? <img src={data.tenant.logo_url} alt={data.tenant.name} className="h-11 w-11 rounded-md object-contain bg-white border" />
          : <div className="h-11 w-11 rounded-md grid place-items-center text-white" style={{ background: brand }}><Dumbbell /></div>}
        <div className="min-w-0 flex-1"><p className="font-semibold truncate">{data.tenant.name}</p><p className="text-xs text-muted-foreground truncate">{data.client.full_name}</p></div>
        {session && <span className="text-xs text-muted-foreground flex items-center gap-1">
          {status === 'saving' ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvataggio</>
            : status === 'error' ? <span className="text-destructive">Errore salvataggio</span>
            : <><CheckCircle2 className="h-3.5 w-3.5" />Salvato</>}
        </span>}
      </div>
    </header>

    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <div><h1 className="text-xl font-semibold">{session?.plan_snapshot?.title ?? data.plan?.title ?? 'Allenamento'}</h1>
        <p className="text-sm text-muted-foreground mt-1">{session ? `Sessione iniziata ${new Date(session.started_at).toLocaleString('it-IT')}` : 'La tua scheda è pronta.'}</p></div>
      {!data.plan && !session && <div className="rounded-md border bg-background p-5 text-sm">Il professionista non ha ancora assegnato una scheda.</div>}
      {!session && data.plan && <Button className="w-full h-12" onClick={start} style={{ background: brand }}><Play />Inizia allenamento</Button>}

      {session && exercises.map((exercise: any, exerciseIndex: number) => {
        const entry = entries[exerciseIndex]
        const old = previous.find((item: Entry) => item.exerciseId === exercise.id)
        if (!entry) return null
        return <section key={exercise.id} className="bg-background border border-border rounded-md overflow-hidden">
          <div className="p-4 border-b border-border"><h2 className="font-semibold">{exercise.name}</h2>
            <p className="text-sm text-muted-foreground">{exercise.targetSets} serie · {exercise.targetReps} ripetizioni</p>
            {exercise.notes && <p className="text-sm mt-2">{exercise.notes}</p>}</div>
          <div className="p-3 space-y-3">
            {entry.sets.map((set, setIndex) => <div key={setIndex} className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-end">
              <span className="h-11 grid place-items-center text-sm font-medium text-muted-foreground">{setIndex + 1}</span>
              <label className="text-xs text-muted-foreground">Ripetizioni
                <input inputMode="numeric" type="number" min="0" className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base" value={set.reps ?? ''}
                  placeholder="0" onChange={event => changeSet(exerciseIndex, setIndex, 'reps', event.target.value)} />
              </label>
              <label className="text-xs text-muted-foreground">Peso kg
                <input inputMode="decimal" type="number" min="0" step="0.25" className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base" value={set.weightKg ?? ''}
                  placeholder="0" onChange={event => changeSet(exerciseIndex, setIndex, 'weightKg', event.target.value)} />
              </label>
              {old?.sets?.[setIndex] && <p className="col-start-2 col-span-2 text-xs text-muted-foreground">
                Precedente: {old.sets[setIndex].reps ?? '-'} rip. · {old.sets[setIndex].weightKg ?? '-'} kg
              </p>}
            </div>)}
            <textarea rows={2} className="w-full rounded-md border border-input bg-background p-3 text-sm" placeholder="Note sull’esercizio"
              value={entry.notes} onChange={event => setEntries(current => current.map((item, i) => i === exerciseIndex ? { ...item, notes: event.target.value } : item))} />
          </div>
        </section>
      })}

      {data.history?.length > 0 && <section className="pt-3"><h2 className="font-semibold mb-2">Sessioni precedenti</h2>
        <div className="divide-y divide-border rounded-md border bg-background">{data.history.slice(0, 5).map((item: any) => <div key={item.id} className="p-3 flex justify-between gap-3 text-sm">
          <span>{item.plan_snapshot?.title ?? 'Allenamento'}</span><span className="text-muted-foreground">{new Date(item.completed_at).toLocaleDateString('it-IT')}</span>
        </div>)}</div></section>}
    </div>

    {session && !session.completed_at && <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur p-3">
      <div className="mx-auto max-w-2xl grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-12" onClick={() => save(false)} disabled={status === 'saving'}><Save />Salva</Button>
        <Button className="h-12" onClick={() => save(true)} disabled={status === 'saving'} style={{ background: brand }}><CheckCircle2 />Completa</Button>
      </div>
      {status === 'error' && <p className="mt-2 text-center text-xs text-destructive">{error}</p>}
    </div>}
  </main>
}
