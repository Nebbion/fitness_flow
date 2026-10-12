'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dumbbell, ImagePlus, Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, Input } from '@/components/ui/index'

type ExerciseImage = { path: string; alt: string; url?: string }
type LibraryExercise = {
  id: string
  name: string
  default_sets: number
  default_reps: string
  notes: string
  images: ExerciseImage[]
}

type Draft = {
  name: string
  defaultSets: number
  defaultReps: string
  notes: string
  images: ExerciseImage[]
}

const emptyDraft: Draft = { name: '', defaultSets: 3, defaultReps: '8-12', notes: '', images: [] }

export function ExerciseLibrary() {
  const [exercises, setExercises] = useState<LibraryExercise[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const response = await fetch('/api/training/exercises', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setExercises(payload.exercises)
    } catch (error: any) {
      toast.error(error.message ?? 'Libreria non disponibile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => exercises.filter(exercise =>
    exercise.name.toLowerCase().includes(query.trim().toLowerCase())
  ), [exercises, query])

  function edit(exercise: LibraryExercise) {
    setEditingId(exercise.id)
    setDraft({
      name: exercise.name,
      defaultSets: exercise.default_sets,
      defaultReps: exercise.default_reps,
      notes: exercise.notes,
      images: exercise.images ?? [],
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function reset() {
    setEditingId(null)
    setDraft(emptyDraft)
  }

  async function save() {
    setSaving(true)
    try {
      const response = await fetch(editingId ? `/api/training/exercises/${editingId}` : '/api/training/exercises', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      toast.success(editingId ? 'Esercizio aggiornato' : 'Esercizio creato. Ora puoi aggiungere le immagini.')
      await load()
      if (editingId) reset()
      else {
        setEditingId(payload.exercise.id)
        setDraft(current => ({ ...current, images: [] }))
      }
    } catch (error: any) {
      toast.error(error.message ?? 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  async function upload(files: File[]) {
    if (!editingId) return toast.error('Salva prima l’esercizio, poi aggiungi le immagini')
    const available = 6 - draft.images.length
    if (available <= 0) return toast.error('Puoi inserire fino a 6 immagini')
    setUploading(true)
    try {
      const uploaded: ExerciseImage[] = []
      for (const file of files.slice(0, available)) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
          throw new Error('Usa immagini JPG, PNG, WebP o GIF inferiori a 5 MB')
        }
        const body = new FormData()
        body.append('file', file)
        const response = await fetch(`/api/training/exercises/${editingId}/images`, { method: 'POST', body })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error)
        uploaded.push({ ...payload.image, alt: draft.name ? `Esecuzione ${draft.name}` : '' })
      }
      setDraft(current => ({ ...current, images: [...current.images, ...uploaded] }))
      toast.success('Immagini aggiunte. Salva per confermare descrizioni e modifiche.')
    } catch (error: any) {
      toast.error(error.message ?? 'Caricamento non riuscito')
    } finally {
      setUploading(false)
    }
  }

  async function remove(exercise: LibraryExercise) {
    if (!window.confirm(`Eliminare “${exercise.name}” dalla libreria? Le schede già salvate non cambieranno.`)) return
    const response = await fetch(`/api/training/exercises/${exercise.id}`, { method: 'DELETE' })
    if (!response.ok) return toast.error((await response.json()).error)
    toast.success('Esercizio eliminato dalla libreria')
    if (editingId === exercise.id) reset()
    await load()
  }

  return <div className="space-y-6">
    <Card>
      <CardContent className="p-5 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="font-semibold">{editingId ? 'Modifica esercizio' : 'Nuovo esercizio'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Le immagini e le istruzioni verranno riutilizzate nelle schede cliente.</p></div>
          {editingId && <Button size="sm" variant="ghost" onClick={reset}><X />Annulla</Button>}
        </div>
        <Input value={draft.name} maxLength={120} placeholder="Nome esercizio"
          onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">Serie predefinite
            <Input className="mt-1" type="number" min={1} max={20} value={draft.defaultSets}
              onChange={event => setDraft(current => ({ ...current, defaultSets: Number(event.target.value) }))} />
          </label>
          <label className="text-xs text-muted-foreground">Ripetizioni predefinite
            <Input className="mt-1" value={draft.defaultReps} maxLength={30}
              onChange={event => setDraft(current => ({ ...current, defaultReps: event.target.value }))} />
          </label>
        </div>
        <textarea className="w-full rounded-md border border-input bg-background p-3 text-sm" rows={3} maxLength={500}
          value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))}
          placeholder="Istruzioni tecniche e accorgimenti" />

        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-medium">Immagini esecuzione</p><p className="text-xs text-muted-foreground">Fino a 6 immagini, massimo 5 MB ciascuna.</p></div>
            <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent ${!editingId || uploading ? 'pointer-events-none opacity-50' : ''}`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Carica
              <input type="file" multiple className="hidden" accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={event => { upload(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
            </label>
          </div>
          {!editingId && <p className="text-xs text-muted-foreground">Salva i dati principali per abilitare il caricamento.</p>}
          {draft.images.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {draft.images.map((image, index) => <div key={image.path} className="overflow-hidden rounded-md border border-border">
              <div className="relative aspect-[4/3] bg-white">
                {image.url && <img src={image.url} alt={image.alt || draft.name} className="h-full w-full object-contain" />}
                <Button size="icon" variant="secondary" className="absolute right-1 top-1 h-7 w-7" aria-label="Rimuovi immagine"
                  onClick={() => setDraft(current => ({ ...current, images: current.images.filter((_, i) => i !== index) }))}><X className="h-4 w-4" /></Button>
              </div>
              <input value={image.alt} maxLength={160} className="h-9 w-full border-t border-border px-2 text-xs" placeholder="Descrizione"
                onChange={event => setDraft(current => ({ ...current, images: current.images.map((item, i) => i === index ? { ...item, alt: event.target.value } : item) }))} />
            </div>)}
          </div>}
        </div>
        <div className="flex justify-end"><Button onClick={save} disabled={saving || !draft.name.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : editingId ? <Save /> : <Plus />}{editingId ? 'Salva modifiche' : 'Crea esercizio'}
        </Button></div>
      </CardContent>
    </Card>

    <div className="flex items-center justify-between gap-4">
      <div><h2 className="font-semibold">I tuoi esercizi</h2><p className="text-sm text-muted-foreground">{exercises.length} in libreria</p></div>
      <div className="relative w-56 max-w-full"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cerca" /></div>
    </div>

    {loading ? <div className="h-40 rounded-md bg-muted animate-pulse" />
      : filtered.length === 0 ? <div className="rounded-md border border-dashed p-10 text-center"><Dumbbell className="mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Nessun esercizio trovato</p></div>
      : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map(exercise => <div key={exercise.id} className="rounded-md border border-border bg-background overflow-hidden">
          {exercise.images?.[0]?.url && <div className="aspect-[16/9] bg-white border-b border-border"><img src={exercise.images[0].url} alt={exercise.images[0].alt || exercise.name} className="h-full w-full object-contain" /></div>}
          <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-medium truncate">{exercise.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{exercise.default_sets} serie · {exercise.default_reps} rip. · {exercise.images?.length ?? 0} immagini</p></div>
            <div className="flex"><Button size="icon" variant="ghost" aria-label="Modifica" onClick={() => edit(exercise)}><Pencil /></Button>
              <Button size="icon" variant="ghost" aria-label="Elimina" onClick={() => remove(exercise)}><Trash2 /></Button></div></div>
            {exercise.notes && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{exercise.notes}</p>}
          </div>
        </div>)}
      </div>}
  </div>
}
