'use client'

import { useEffect, useState } from 'react'
import { Copy, Dumbbell, ExternalLink, Link2, Loader2, Plus, Save, Trash2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui/index'

type Exercise = { id: string; name: string; targetSets: number; targetReps: string; notes: string }

export function TrainingPlanPanel({ clientId, locale }: { clientId: string; locale: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('Scheda allenamento')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [access, setAccess] = useState<any>(null)
  const [link, setLink] = useState('')

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(`/api/clients/${clientId}/training`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      if (data.plan) {
        setTitle(data.plan.title)
        setExercises(data.plan.exercises)
      }
      setSessions(data.sessions)
      setAccess(data.access)
    } catch (error: any) { toast.error(error.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [clientId])

  function addExercise() {
    setExercises(value => [...value, { id: crypto.randomUUID(), name: '', targetSets: 3, targetReps: '8-12', notes: '' }])
  }

  function updateExercise(index: number, patch: Partial<Exercise>) {
    setExercises(value => value.map((exercise, i) => i === index ? { ...exercise, ...patch } : exercise))
  }

  async function savePlan() {
    setSaving(true)
    try {
      const response = await fetch(`/api/clients/${clientId}/training`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, exercises }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      toast.success('Scheda salvata. Le sessioni passate restano invariate.')
      await load()
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
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Scheda assegnata</CardTitle>
        <Button size="sm" variant="outline" onClick={addExercise}><Plus /> Esercizio</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Titolo scheda" />
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
                {entry.sets?.map((set: any) => `${set.reps ?? '-'} rep × ${set.weightKg ?? '-'} kg`).join(' · ')}
                {entry.notes ? ` · ${entry.notes}` : ''}
              </p>
            })}
          </div>}
        </div>)}
        {sessions.length === 0 && <p className="px-6 py-5 text-sm text-muted-foreground">Nessuna sessione registrata.</p>}
      </CardContent>
    </Card>
  </div>
}
