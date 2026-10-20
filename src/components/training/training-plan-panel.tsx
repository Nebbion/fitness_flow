'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Copy, Dumbbell, ExternalLink, Link2, Loader2, Plus, Save, Trash2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui/index'

type ExerciseImage = { path: string; alt: string; url?: string }
type Exercise = { id: string; name: string; targetSets: number; targetReps: string; targetWeightKg?: number | null; isometrySeconds?: number | null; notes: string; images: ExerciseImage[] }
type LibraryExercise = { id: string; name: string; default_sets: number; default_reps: string; default_weight_kg?: number | null; default_isometry_seconds?: number | null; notes: string; images: ExerciseImage[] }

export function TrainingPlanPanel({ clientId, locale }: { clientId: string; locale: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('Scheda allenamento')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [access, setAccess] = useState<any>(null)
  const [link, setLink] = useState('')
  const [library, setLibrary] = useState<LibraryExercise[]>([])
  const [selectedLibraryId, setSelectedLibraryId] = useState('')
  const [plans, setPlans] = useState<any[]>([])
  const [planId, setPlanId] = useState<string | undefined>()
  const [version, setVersion] = useState<number | undefined>()
  const [baseline, setBaseline] = useState('')

  function selectPlan(plan?: any) {
    setPlanId(plan?.id)
    setVersion(plan?.version)
    const nextTitle = plan?.title ?? 'Scheda allenamento'
    const nextExercises = (plan?.exercises ?? []).map((exercise: Exercise) => ({ ...exercise, images: exercise.images ?? [] }))
    setTitle(nextTitle)
    setExercises(nextExercises)
    setBaseline(JSON.stringify({ title: nextTitle, exercises: nextExercises }))
  }
  function changePlan(plan?: any) {
    if (JSON.stringify({ title, exercises }) !== baseline && !window.confirm('Abbandonare le modifiche non salvate?')) return
    selectPlan(plan)
  }

  async function load(selectedId?: string) {
    setLoading(true)
    try {
      const response = await fetch(`/api/clients/${clientId}/training`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setPlans(data.plans ?? [])
      selectPlan(data.plans?.find((plan: any) => plan.id === selectedId) ?? data.plan)
      setSessions(data.sessions)
      setAccess(data.access)
    } catch (error: any) { toast.error(error.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [clientId])

  useEffect(() => {
    fetch('/api/training/exercises', { cache: 'no-store' }).then(async response => {
      const payload = await response.json()
      if (response.ok) setLibrary(payload.exercises)
    })
  }, [])

  function addExercise() {
    setExercises(value => [...value, { id: crypto.randomUUID(), name: '', targetSets: 3, targetReps: '8-12', notes: '', images: [] }])
  }

  function updateExercise(index: number, patch: Partial<Exercise>) {
    setExercises(value => value.map((exercise, i) => i === index ? { ...exercise, ...patch } : exercise))
  }

  function addFromLibrary() {
    const source = library.find(item => item.id === selectedLibraryId)
    if (!source) return
    if (exercises.some(item => item.id === source.id)) return toast.error('L’esercizio è già presente nella scheda')
    setExercises(value => [...value, {
      id: source.id,
      name: source.name,
      targetSets: source.default_sets,
      targetReps: source.default_reps,
      targetWeightKg: source.default_weight_kg ?? null,
      isometrySeconds: source.default_isometry_seconds ?? null,
      notes: source.notes,
      images: source.images ?? [],
    }])
    setSelectedLibraryId('')
  }

  async function savePlan() {
    setSaving(true)
    try {
      const response = await fetch(`/api/clients/${clientId}/training`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: planId, version, title, exercises }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      toast.success('Scheda salvata. Le sessioni passate restano invariate.')
      await load(data.plan.id)
    } catch (error: any) { toast.error(error.message) }
    finally { setSaving(false) }
  }

  async function createLink() {
    const response = await fetch(`/api/clients/${clientId}/training`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale }),
    })
    const data = await response.json()
    if (!response.ok) return toast.error(data.error)
    setLink(data.url)
    setAccess({ expires_at: data.expiresAt, revoked_at: null })
    await navigator.clipboard?.writeText(data.url)
    toast.success('Nuovo link copiato. Il precedente non è più valido.')
  }

  async function revokeLink() {
    await fetch(`/api/clients/${clientId}/training`, { method: 'DELETE' })
    setLink('')
    setAccess((value: any) => value ? { ...value, revoked_at: new Date().toISOString() } : null)
    toast.success('Link revocato')
  }

  if (loading) return <div className="h-48 rounded-md bg-muted animate-pulse" />

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm">Schede allenamento
        <select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={planId ?? ''} disabled={saving}
          onChange={event => changePlan(plans.find(plan => plan.id === event.target.value))}>
          {!planId && <option value="">Nuova scheda</option>}
          {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
        </select>
      </label>
      <Button variant="outline" disabled={saving} onClick={() => changePlan()}><Plus />Nuova scheda</Button>
    </div>
    <Card>
      <CardHeader><CardTitle className="text-base">Scheda assegnata</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Titolo scheda" />
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <select className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={selectedLibraryId}
            onChange={event => setSelectedLibraryId(event.target.value)}>
            <option value="">Seleziona dalla libreria esercizi</option>
            {library.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <Button variant="outline" onClick={addFromLibrary} disabled={!selectedLibraryId}><BookOpen />Aggiungi</Button>
          <Button variant="ghost" onClick={addExercise}><Plus />Libero</Button>
        </div>
        {library.length === 0 && <p className="text-xs text-muted-foreground">Crea esercizi con immagini dalla voce “Esercizi” nel menu, oppure aggiungi un esercizio libero.</p>}
        {exercises.map((exercise, index) => <div key={exercise.id} className="border-b border-border pb-4 last:border-0 space-y-3">
          <div className="flex gap-2">
            <Input value={exercise.name} onChange={event => updateExercise(index, { name: event.target.value })} placeholder="Nome esercizio" />
            <Button size="icon" variant="ghost" aria-label="Rimuovi esercizio" onClick={() => setExercises(value => value.filter((_, i) => i !== index))}>
              <Trash2 />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Serie
              <Input className="mt-1" type="number" min={1} max={20} value={exercise.targetSets}
                onChange={event => updateExercise(index, { targetSets: Number(event.target.value) })} />
            </label>
            <label className="text-xs text-muted-foreground">Ripetizioni
              <Input className="mt-1" value={exercise.targetReps} onChange={event => updateExercise(index, { targetReps: event.target.value })} />
            </label>
          </div>
          <textarea className="w-full rounded-md border border-input bg-background p-3 text-sm" rows={2} value={exercise.notes}
            onChange={event => updateExercise(index, { notes: event.target.value })} placeholder="Indicazioni tecniche" />
          <label className="block text-xs text-muted-foreground">Carico consigliato (kg)
            <Input type="number" min={0} max={2000} step="any" value={exercise.targetWeightKg ?? ''}
              onChange={event => updateExercise(index, { targetWeightKg: event.target.value === '' ? null : Number(event.target.value) })} />
          </label>
          <label className="block text-xs text-muted-foreground">Tempo dell'esercizio - isometria (secondi, facoltativo)
            <Input className="mt-1" type="number" min={1} max={3600} step={1} placeholder="Es. 30" value={exercise.isometrySeconds ?? ''}
              onChange={event => updateExercise(index, { isometrySeconds: event.target.value === '' ? null : Number(event.target.value) })} />
          </label>
          {(exercise.images?.length ?? 0) > 0 && <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {exercise.images.map(image => <div key={image.path} className="aspect-square overflow-hidden rounded-md border bg-white">
              {image.url ? <img src={image.url} alt={image.alt || exercise.name} className="h-full w-full object-contain" />
                : <div className="h-full grid place-items-center text-[10px] text-muted-foreground">Immagine</div>}
            </div>)}
          </div>}
        </div>)}
        {exercises.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground"><Dumbbell className="mx-auto mb-2" />Aggiungi il primo esercizio</div>}
        <div className="flex justify-end"><Button onClick={savePlan} disabled={saving || exercises.length === 0}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Salva scheda
        </Button></div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Link personale cliente</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Il link scade dopo 180 giorni e può essere revocato in qualsiasi momento.</p>
        {link && <div className="flex gap-2"><Input readOnly value={link} />
          <Button size="icon" variant="outline" aria-label="Copia link" onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copiato') }}><Copy /></Button>
          <Button size="icon" variant="outline" aria-label="Apri link" onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}><ExternalLink /></Button>
        </div>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={createLink}><Link2 />{access && !access.revoked_at ? 'Rigenera link' : 'Crea link'}</Button>
          {access && !access.revoked_at && <Button variant="outline" onClick={revokeLink}><Unlink />Revoca</Button>}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Storico sessioni</CardTitle></CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {sessions.map(session => <div key={session.id} className="px-6 py-4">
          <div className="flex justify-between gap-3"><p className="text-sm font-medium">{session.plan_snapshot?.title ?? 'Allenamento'}</p>
            <span className="text-xs text-muted-foreground">{new Date(session.started_at).toLocaleDateString(locale)}</span></div>
          <p className="text-xs text-muted-foreground mt-1">{session.completed_at ? 'Completata' : 'In corso'} · {session.entries?.length ?? 0} esercizi registrati</p>
          {session.entries?.length > 0 && <div className="mt-3 space-y-1">
            {session.entries.map((entry: any) => {
              const exercise = session.plan_snapshot?.exercises?.find((item: any) => item.id === entry.exerciseId)
              return <p key={entry.exerciseId} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{exercise?.name ?? 'Esercizio'}:</span>{' '}
                {entry.sets?.map((set: any) => `${set.reps ?? '-'} rep × ${set.weightKg ?? '-'} kg${set.notes ? ` (${set.notes})` : ''}`).join(' · ')}
                {entry.notes ? ` · ${entry.notes}` : ''}
              </p>
            })}
          </div>}
          {session.notes && <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Note sessione:</span> {session.notes}</p>}
        </div>)}
        {sessions.length === 0 && <p className="px-6 py-5 text-sm text-muted-foreground">Nessuna sessione registrata.</p>}
      </CardContent>
    </Card>
  </div>
}
