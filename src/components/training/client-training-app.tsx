'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, CalendarDays, Check, CheckCircle2, ClipboardList, CloudOff,
  Dumbbell, History, Loader2, Play, Printer, RefreshCcw, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PwaInstallHelp } from '@/components/pwa/pwa-install-help'
import { isMutationConfirmed, reconcilePendingMutation } from '@/lib/training/autosave'
import { ExerciseGallery, PrintableTrainingPlan } from './training-plan-presentation'

type SetEntry = { reps: number | null; weightKg: number | null; notes: string }
type Entry = { exerciseId: string; sets: SetEntry[]; notes: string }
type View = 'plan' | 'workout' | 'history' | 'appointments'
type SaveStatus = 'loading' | 'idle' | 'dirty' | 'saving' | 'saved' | 'offline' | 'error'
type PendingMutation = {
  action: 'save' | 'complete'
  sessionId: string
  version: number
  mutationId: string
  entries: Entry[]
  notes: string
}
type Draft = { sessionId: string; entries: Entry[]; notes: string; updatedAt: string }

const viewLabels: Array<{ id: View; label: string; icon: typeof Dumbbell }> = [
  { id: 'plan', label: 'Scheda', icon: ClipboardList },
  { id: 'workout', label: 'Allenamento', icon: Dumbbell },
  { id: 'history', label: 'Storico', icon: History },
  { id: 'appointments', label: 'Appuntamenti', icon: CalendarDays },
]

function valuesOf(entries: Entry[], notes: string) {
  return JSON.stringify({ entries, notes })
}

function draftKey(sessionId: string) { return `fitnessflow:draft:${sessionId}` }
function pendingKey(sessionId: string) { return `fitnessflow:pending:${sessionId}` }

function readLocal<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null } catch { return null }
}

function SaveState({ status, savedAt, onRetry }: { status: SaveStatus; savedAt: Date | null; onRetry: () => void }) {
  if (status === 'idle' || status === 'loading') return null
  if (status === 'saving') return <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvataggio…</span>
  if (status === 'dirty') return <span className="flex items-center gap-1.5 text-xs text-amber-700" role="status"><Save className="h-3.5 w-3.5" />Modifiche da salvare</span>
  if (status === 'offline') return <button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-xs text-amber-700" title="Riprova"><CloudOff className="h-3.5 w-3.5" />Offline · in attesa</button>
  if (status === 'error') return <button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-xs text-destructive" title="Riprova"><AlertCircle className="h-3.5 w-3.5" />Non salvato · Riprova</button>
  return <span className="flex items-center gap-1.5 text-xs text-emerald-700" role="status"><Check className="h-3.5 w-3.5" />{savedAt ? `Salvato ${savedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : 'Salvato'}</span>
}

export function ClientTrainingApp({ token, locale = 'it', initialView = 'plan', clientOptions = [] }: {
  token?: string
  locale?: string
  initialView?: View
  clientOptions?: Array<{ id: string; label: string }>
}) {
  const [selectedClientId, setSelectedClientId] = useState(clientOptions[0]?.id ?? '')
  const endpoint = token ? `/api/training/${token}` : `/api/portal/training${selectedClientId ? `?clientId=${encodeURIComponent(selectedClientId)}` : ''}`
  const dateLocale = locale === 'en' ? 'en-GB' : 'it-IT'
  const [data, setData] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [sessionNotes, setSessionNotes] = useState('')
  const [view, setView] = useState<View>(initialView)
  const [status, setStatus] = useState<SaveStatus>('loading')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [saveBlocked, setSaveBlocked] = useState(false)
  const lastSaved = useRef('')
  const sessionRef = useRef<any>(null)
  const entriesRef = useRef<Entry[]>([])
  const notesRef = useRef('')
  const pendingRef = useRef<PendingMutation | null>(null)
  const saveInFlight = useRef(false)
  const resaveRequested = useRef(false)
  const completeRequested = useRef(false)
  const saveBlockedRef = useRef(false)

  function storeDraft(nextEntries = entriesRef.current, nextNotes = notesRef.current) {
    const active = sessionRef.current
    if (!active) return
    const draft: Draft = { sessionId: active.id, entries: nextEntries, notes: nextNotes, updatedAt: new Date().toISOString() }
    localStorage.setItem(draftKey(active.id), JSON.stringify(draft))
  }

  function removeLocal(sessionId: string) {
    localStorage.removeItem(draftKey(sessionId))
    localStorage.removeItem(pendingKey(sessionId))
  }

  function hydrateSession(next: any, recover = true) {
    const serverEntries: Entry[] = next.entries?.length ? next.entries : (next.plan_snapshot?.exercises ?? []).map((exercise: any) => ({
      exerciseId: exercise.id,
      sets: Array.from({ length: exercise.targetSets }, () => ({ reps: null, weightKg: null, notes: '' })),
      notes: '',
    }))
    const serverNotes = next.notes ?? ''
    const serverValue = valuesOf(serverEntries, serverNotes)
    let recoveredEntries = serverEntries
    let recoveredNotes = serverNotes
    let recovered = false
    let conflict = false

    sessionRef.current = next
    pendingRef.current = null
    saveBlockedRef.current = false
    setSaveBlocked(false)
    if (recover) {
      const pending = readLocal<PendingMutation>(pendingKey(next.id))
      const draft = readLocal<Draft>(draftKey(next.id))
      if (pending && pending.sessionId === next.id) {
        const resolution = reconcilePendingMutation(next, pending)
        if (resolution === 'confirmed') localStorage.removeItem(pendingKey(next.id))
        else if (resolution === 'retry') pendingRef.current = pending
        else {
          localStorage.removeItem(pendingKey(next.id))
          conflict = true
          saveBlockedRef.current = true
          setSaveBlocked(true)
          setError('La sessione è stata aggiornata da un altro dispositivo. I dati locali sono conservati, ma non verranno sovrascritti automaticamente.')
        }
      }
      if (draft && draft.sessionId === next.id && valuesOf(draft.entries, draft.notes) !== serverValue) {
        recoveredEntries = draft.entries
        recoveredNotes = draft.notes
        recovered = true
      } else if (draft) localStorage.removeItem(draftKey(next.id))
    }

    entriesRef.current = recoveredEntries
    notesRef.current = recoveredNotes
    setSession(next)
    setEntries(recoveredEntries)
    setSessionNotes(recoveredNotes)
    lastSaved.current = serverValue
    setStatus(conflict ? 'error' : recovered ? (navigator.onLine ? 'dirty' : 'offline') : 'saved')
    setSavedAt(recovered ? null : new Date())
    if (pendingRef.current && navigator.onLine) queueMicrotask(() => requestSave(false))
  }

  async function load() {
    setError('')
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setData(payload)
      setSelectedPlanId(current => payload.plans?.some((plan: any) => plan.id === current) ? current : payload.plan?.id ?? '')
      if (payload.openSession) hydrateSession(payload.openSession)
      else {
        sessionRef.current = null
        pendingRef.current = null
        entriesRef.current = []
        notesRef.current = ''
        setSession(null)
        setEntries([])
        setSessionNotes('')
        setStatus('idle')
      }
    } catch (caught: any) {
      setError(caught.message || 'Impossibile caricare i dati')
      setStatus('error')
    }
  }

  useEffect(() => { load() }, [token, selectedClientId])
  useEffect(() => { setView(initialView) }, [initialView])
  useEffect(() => {
    const online = () => { if (sessionRef.current) requestSave(false) }
    const offline = () => { if (sessionRef.current && valuesOf(entriesRef.current, notesRef.current) !== lastSaved.current) setStatus('offline') }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline) }
  }, [])

  async function start() {
    setStatus('loading')
    setError('')
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', planId: selectedPlanId || undefined, ...(token ? {} : { clientId: selectedClientId }) }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      hydrateSession(payload.session, false)
      setView('workout')
    } catch (caught: any) { setError(caught.message); setStatus('error') }
  }

  async function sendPending(mutation: PendingMutation) {
    if (!navigator.onLine) { setStatus('offline'); return }
    saveInFlight.current = true
    setStatus('saving')
    setError('')
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ ...mutation, ...(token ? {} : { clientId: selectedClientId }) }),
      })
      const payload = await response.json()
      if (!response.ok) throw Object.assign(new Error(payload.error), { status: response.status })
      if (!isMutationConfirmed(payload.session, mutation.mutationId)) throw new Error('Conferma di salvataggio non valida')

      sessionRef.current = payload.session
      setSession(payload.session)
      pendingRef.current = null
      localStorage.removeItem(pendingKey(mutation.sessionId))
      lastSaved.current = valuesOf(mutation.entries, mutation.notes)
      const stillCurrent = valuesOf(entriesRef.current, notesRef.current) === lastSaved.current

      if (mutation.action === 'complete') {
        removeLocal(mutation.sessionId)
        setSavedAt(new Date())
        setStatus('saved')
        await load()
        setView('history')
      } else if (stillCurrent) {
        localStorage.removeItem(draftKey(mutation.sessionId))
        setSavedAt(new Date())
        setStatus('saved')
      } else {
        setStatus(navigator.onLine ? 'dirty' : 'offline')
        resaveRequested.current = true
      }
    } catch (caught: any) {
      const offline = !navigator.onLine || caught instanceof TypeError
      setError(caught.message || 'Salvataggio non riuscito')
      setStatus(offline ? 'offline' : 'error')
      if (caught.status === 409) {
        saveBlockedRef.current = true
        setSaveBlocked(true)
      }
      if (caught.status === 403 || caught.status === 404) {
        removeLocal(mutation.sessionId)
        pendingRef.current = null
      }
    } finally {
      saveInFlight.current = false
      if (resaveRequested.current || completeRequested.current) {
        const complete = completeRequested.current
        resaveRequested.current = false
        completeRequested.current = false
        queueMicrotask(() => requestSave(complete))
      }
    }
  }

  function requestSave(complete = false) {
    const active = sessionRef.current
    if (!active || active.completed_at || saveBlockedRef.current) return
    if (saveInFlight.current) {
      resaveRequested.current = true
      if (complete) completeRequested.current = true
      return
    }
    if (pendingRef.current) {
      if (complete) completeRequested.current = true
      void sendPending(pendingRef.current)
      return
    }

    const currentValue = valuesOf(entriesRef.current, notesRef.current)
    if (!complete && currentValue === lastSaved.current) return
    const mutation: PendingMutation = {
      action: complete ? 'complete' : 'save',
      sessionId: active.id,
      version: active.version,
      mutationId: crypto.randomUUID(),
      entries: entriesRef.current,
      notes: notesRef.current,
    }
    pendingRef.current = mutation
    localStorage.setItem(pendingKey(active.id), JSON.stringify(mutation))
    void sendPending(mutation)
  }

  useEffect(() => {
    if (!session || valuesOf(entries, sessionNotes) === lastSaved.current || status === 'saving') return
    storeDraft(entries, sessionNotes)
    if (!navigator.onLine) { setStatus('offline'); return }
    if (status !== 'error') setStatus('dirty')
    const timer = window.setTimeout(() => requestSave(false), 900)
    return () => window.clearTimeout(timer)
  }, [entries, sessionNotes, session?.id])

  const selectedPlan = data?.plans?.find((plan: any) => plan.id === selectedPlanId) ?? data?.plan
  const exercises = session?.plan_snapshot?.exercises ?? selectedPlan?.exercises ?? []
  const previous = useMemo(() => data?.history ?? [], [data])

  function updateEntries(next: Entry[]) {
    entriesRef.current = next
    setEntries(next)
    storeDraft(next, notesRef.current)
  }

  function updateNotes(next: string) {
    notesRef.current = next
    setSessionNotes(next)
    storeDraft(entriesRef.current, next)
  }

  function changeSet(exerciseIndex: number, setIndex: number, field: keyof SetEntry, value: string) {
    updateEntries(entriesRef.current.map((entry, i) => i !== exerciseIndex ? entry : {
      ...entry,
      sets: entry.sets.map((set, j) => j !== setIndex ? set : {
        ...set,
        [field]: field === 'notes' ? value : value === '' ? null : Number(value),
      }),
    }))
  }

  function discardLocalAndReload() {
    if (sessionRef.current) removeLocal(sessionRef.current.id)
    pendingRef.current = null
    saveBlockedRef.current = false
    setSaveBlocked(false)
    void load()
  }

  if (status === 'loading' && !data) return <main className="min-h-screen grid place-items-center bg-background"><Loader2 className="animate-spin text-primary" /></main>
  if (!data) return <main className="min-h-screen grid place-items-center p-6 bg-background"><div className="max-w-sm text-center"><h1 className="text-xl font-semibold">Accesso non disponibile</h1><p className="mt-2 text-sm text-muted-foreground">{error || 'Il link è scaduto o è stato revocato.'}</p><Button className="mt-4" variant="outline" onClick={load}><RefreshCcw />Riprova</Button></div></main>

  const brand = data.tenant.brand_primary || '#2563EB'
  const printableTitle = session?.plan_snapshot?.title ?? selectedPlan?.title ?? 'Scheda allenamento'
  const appointments = data.appointments ?? []
  const now = Date.now()
  const upcoming = appointments.filter((item: any) => new Date(item.start_at).getTime() >= now && item.status !== 'cancelled').sort((a: any, b: any) => +new Date(a.start_at) - +new Date(b.start_at))
  const past = appointments.filter((item: any) => new Date(item.start_at).getTime() < now || item.status === 'cancelled').sort((a: any, b: any) => +new Date(b.start_at) - +new Date(a.start_at))

  return <>
    <PrintableTrainingPlan tenant={data.tenant} client={data.client} exercises={exercises} title={printableTitle} />
    <main className={`min-h-screen bg-muted/30 print:hidden ${token ? 'pb-24' : ''}`} style={{ '--brand': brand } as any}>
      {token && <header className="safe-top sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {data.tenant.logo_url ? <img src={data.tenant.logo_url} alt={data.tenant.name} className="h-10 w-10 rounded-lg border bg-white object-contain" />
            : <div className="grid h-10 w-10 place-items-center rounded-lg text-white" style={{ background: brand }}><Dumbbell className="h-5 w-5" /></div>}
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{data.tenant.name}</p><p className="truncate text-xs text-muted-foreground">{data.client.full_name}</p></div>
          {session && <div className="hidden sm:block"><SaveState status={status} savedAt={savedAt} onRetry={() => requestSave(false)} /></div>}
          <PwaInstallHelp compact />
        </div>
      </header>}

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {!token && clientOptions.length > 1 && !session && <label className="block text-sm font-medium">Professionista
          <select className="mt-2 h-11 w-full rounded-lg border bg-background px-3" value={selectedClientId} onChange={event => setSelectedClientId(event.target.value)}>
            {clientOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>}
        {!token && session && <div className="flex justify-end"><SaveState status={status} savedAt={savedAt} onRetry={() => requestSave(false)} /></div>}
        {token && session && <div className="flex justify-end sm:hidden"><SaveState status={status} savedAt={savedAt} onRetry={() => requestSave(false)} /></div>}
        {error && status === 'error' && <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>{saveBlocked && <Button type="button" size="sm" variant="outline" onClick={discardLocalAndReload}>Usa dati server</Button>}</div>}

        {view === 'plan' && <PlanView data={data} selectedPlan={selectedPlan} selectedPlanId={selectedPlanId} setSelectedPlanId={setSelectedPlanId}
          exercises={selectedPlan?.exercises ?? []} brand={brand} status={status} start={start} printableTitle={selectedPlan?.title ?? printableTitle} />}

        {view === 'workout' && !session && <section className="rounded-xl border bg-background p-6 text-center">
          <Dumbbell className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-3 text-xl font-semibold">Pronto per allenarti?</h1>
          <p className="mt-2 text-sm text-muted-foreground">Avvia la scheda selezionata. I valori saranno salvati automaticamente.</p>
          {selectedPlan ? <Button className="mt-5 h-12 w-full" onClick={start} disabled={status === 'loading'} style={{ background: brand }}><Play />Inizia allenamento</Button>
            : <p className="mt-4 text-sm">Il professionista non ha ancora assegnato una scheda.</p>}
        </section>}

        {view === 'workout' && session && <>
          <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">{printableTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Iniziato {new Date(session.started_at).toLocaleString(dateLocale)}</p></div>
            <Button size="icon" variant="outline" aria-label="Stampa scheda" title="Stampa scheda" onClick={() => window.print()}><Printer /></Button>
          </div>
          {exercises.map((exercise: any, exerciseIndex: number) => {
            const entry = entries[exerciseIndex]
            const old = previous.map((oldSession: any) => oldSession.entries?.find((item: Entry) => item.exerciseId === exercise.id)).find(Boolean)
            if (!entry) return null
            return <section key={exercise.id} className="overflow-hidden rounded-xl border border-border bg-background">
              <div className="border-b border-border p-4"><h2 className="font-semibold">{exercise.name}</h2>
                <p className="text-sm text-muted-foreground">{exercise.targetSets} serie · {exercise.targetReps} ripetizioni</p>
                {exercise.notes && <p className="mt-2 text-sm">{exercise.notes}</p>}
                {exercise.targetWeightKg != null && <p className="mt-2 text-sm">Carico consigliato: {exercise.targetWeightKg} kg</p>}
                {exercise.isometrySeconds != null && <p className="mt-2 text-sm">Isometria: <strong>{exercise.isometrySeconds} s</strong></p>}
                <ExerciseGallery images={exercise.images} name={exercise.name} /></div>
              <div className="space-y-4 p-3">
                {entry.sets.map((set, setIndex) => <div key={setIndex} className="grid grid-cols-[2rem_1fr_1fr] items-end gap-2">
                  <span className="grid h-11 place-items-center text-sm font-medium text-muted-foreground">{setIndex + 1}</span>
                  <label className="text-xs text-muted-foreground">Ripetizioni
                    <input inputMode="numeric" type="number" min="0" className="mt-1 h-12 w-full rounded-lg border border-input bg-background px-3 text-base" value={set.reps ?? ''}
                      placeholder={old?.sets?.[setIndex]?.reps?.toString() ?? '0'} onChange={event => changeSet(exerciseIndex, setIndex, 'reps', event.target.value)} />
                  </label>
                  <label className="text-xs text-muted-foreground">Peso kg
                    <input inputMode="decimal" type="number" min="0" step="0.25" className="mt-1 h-12 w-full rounded-lg border border-input bg-background px-3 text-base" value={set.weightKg ?? ''}
                      placeholder={old?.sets?.[setIndex]?.weightKg?.toString() ?? '0'} onChange={event => changeSet(exerciseIndex, setIndex, 'weightKg', event.target.value)} />
                  </label>
                  {old?.sets?.[setIndex] && <p className="col-start-2 col-span-2 text-xs text-muted-foreground">Ultimo valore: <strong>{old.sets[setIndex].reps ?? '—'} rip. · {old.sets[setIndex].weightKg ?? '—'} kg</strong></p>}
                  <input className="col-start-2 col-span-2 h-10 rounded-lg border border-input bg-background px-3 text-sm" value={set.notes} maxLength={300}
                    placeholder="Nota serie" onChange={event => changeSet(exerciseIndex, setIndex, 'notes', event.target.value)} />
                </div>)}
                <textarea rows={2} className="w-full rounded-lg border border-input bg-background p-3 text-sm" placeholder="Note sull’esercizio" maxLength={1000}
                  value={entry.notes} onChange={event => updateEntries(entriesRef.current.map((item, i) => i === exerciseIndex ? { ...item, notes: event.target.value } : item))} />
              </div>
            </section>
          })}
          <textarea rows={3} className="w-full rounded-lg border border-input bg-background p-3 text-sm" placeholder="Note sulla sessione"
            value={sessionNotes} onChange={event => updateNotes(event.target.value)} maxLength={2000} />
        </>}

        {view === 'history' && <HistoryView history={data.history ?? []} locale={dateLocale} />}
        {view === 'appointments' && <AppointmentsView upcoming={upcoming} past={past} locale={dateLocale} />}
      </div>

      {view === 'workout' && session && !session.completed_at && <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
          <Button variant="outline" className="h-12" onClick={() => requestSave(false)} disabled={status === 'saving'}><Save />Salva ora</Button>
          <Button className="h-12" onClick={() => requestSave(true)} disabled={status === 'saving'} style={{ background: brand }}><CheckCircle2 />Completa</Button>
        </div>
      </div>}

      {token && <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur" aria-label="Navigazione cliente">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {viewLabels.map(item => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} type="button" onClick={() => setView(item.id)}
            className={`flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[10px] ${active ? 'font-semibold text-primary' : 'text-muted-foreground'}`} aria-current={active ? 'page' : undefined}>
            <Icon className="h-5 w-5" /><span className="truncate">{item.label}</span>
          </button> })}
        </div>
      </nav>}
    </main>
  </>
}

function PlanView({ data, selectedPlan, selectedPlanId, setSelectedPlanId, exercises, brand, status, start, printableTitle }: any) {
  return <>
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">{printableTitle}</h1><p className="mt-1 text-sm text-muted-foreground">Consulta le indicazioni prima di iniziare.</p></div>
      {selectedPlan && <Button size="icon" variant="outline" aria-label="Stampa scheda" onClick={() => window.print()}><Printer /></Button>}
    </div>
    {!selectedPlan && <div className="rounded-xl border bg-background p-5 text-sm">Il professionista non ha ancora assegnato una scheda.</div>}
    {data.plans?.length > 1 && <label className="block text-sm font-medium">Scheda allenamento
      <select className="mt-2 h-12 w-full rounded-lg border bg-background px-3" value={selectedPlanId} disabled={status === 'loading'} onChange={event => setSelectedPlanId(event.target.value)}>
        {data.plans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
      </select>
    </label>}
    {selectedPlan && <Button className="h-12 w-full" onClick={start} disabled={status === 'loading'} style={{ background: brand }}><Play />Inizia allenamento</Button>}
    <div className="space-y-3">{exercises.map((exercise: any) => <section key={exercise.id} className="overflow-hidden rounded-xl border border-border bg-background p-4">
      <h2 className="font-semibold">{exercise.name}</h2><p className="text-sm text-muted-foreground">{exercise.targetSets} serie · {exercise.targetReps} ripetizioni</p>
      {exercise.notes && <p className="mt-2 text-sm">{exercise.notes}</p>}
      {exercise.targetWeightKg != null && <p className="mt-2 text-sm">Carico consigliato: {exercise.targetWeightKg} kg</p>}
      {exercise.isometrySeconds != null && <p className="mt-2 text-sm">Isometria: <strong>{exercise.isometrySeconds} s</strong></p>}
      <ExerciseGallery images={exercise.images} name={exercise.name} />
    </section>)}</div>
  </>
}

function HistoryView({ history, locale }: { history: any[]; locale: string }) {
  return <section><h1 className="text-xl font-semibold">Storico allenamenti</h1><p className="mt-1 text-sm text-muted-foreground">Le sessioni concluse conservano la scheda usata in quel momento.</p>
    {!history.length ? <div className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><History className="mx-auto mb-2 h-8 w-8" />Nessun allenamento completato.</div>
      : <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border bg-background">{history.map(item => <details key={item.id} className="p-4 text-sm">
        <summary className="cursor-pointer font-medium">{item.plan_snapshot?.title ?? 'Allenamento'} · {new Date(item.completed_at).toLocaleDateString(locale)}</summary>
        {(item.entries ?? []).map((entry: Entry) => <div key={entry.exerciseId} className="mt-3">
          <p className="font-medium">{item.plan_snapshot?.exercises?.find((exercise: any) => exercise.id === entry.exerciseId)?.name ?? 'Esercizio'}</p>
          {entry.sets.map((set, index) => <p key={index} className="py-0.5 text-muted-foreground">Serie {index + 1}: {set.reps ?? '—'} rip. · {set.weightKg ?? '—'} kg{set.notes ? ` · ${set.notes}` : ''}</p>)}
          {entry.notes && <p className="mt-1 text-muted-foreground">{entry.notes}</p>}
        </div>)}
        {item.notes && <p className="mt-3 border-t pt-2 text-muted-foreground">Note: {item.notes}</p>}
      </details>)}</div>}
  </section>
}

function AppointmentsView({ upcoming, past, locale }: { upcoming: any[]; past: any[]; locale: string }) {
  const Card = ({ item }: { item: any }) => <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
    <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ background: item.services?.color ?? '#2563eb' }} />
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.services?.name ?? 'Appuntamento'}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{new Date(item.start_at).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
      {item.profiles?.full_name && <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.profiles.full_name}</p>}
    </div><span className="rounded-full bg-muted px-2 py-1 text-[10px] capitalize text-muted-foreground">{item.status}</span>
  </div>
  return <section><h1 className="text-xl font-semibold">Appuntamenti</h1>
    <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prossimi</h2>
    <div className="mt-2 space-y-2">{upcoming.length ? upcoming.map(item => <Card key={item.id} item={item} />) : <div className="rounded-xl border border-dashed p-7 text-center text-sm text-muted-foreground"><CalendarDays className="mx-auto mb-2 h-8 w-8" />Nessun appuntamento in programma.</div>}</div>
    {!!past.length && <><h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Passati</h2><div className="mt-2 space-y-2">{past.map(item => <Card key={item.id} item={item} />)}</div></>}
  </section>
}
