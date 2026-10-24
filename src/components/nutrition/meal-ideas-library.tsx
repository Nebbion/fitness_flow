'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, ImagePlus, Loader2, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, Input } from '@/components/ui/index'
import {
  MEAL_IDEA_MAX_IMAGES,
  MEAL_IDEA_MAX_IMAGE_BYTES,
  type MealIdeaImage,
} from '@/lib/nutrition/meal-ideas'

type MealIdea = {
  id: string
  title: string
  category: string
  description: string
  ingredients: string
  instructions: string
  source_url: string | null
  images: MealIdeaImage[]
}

type Draft = {
  title: string
  category: string
  description: string
  ingredients: string
  instructions: string
  sourceUrl: string
  images: MealIdeaImage[]
}

const emptyDraft: Draft = {
  title: '', category: '', description: '', ingredients: '', instructions: '', sourceUrl: '', images: [],
}

export function MealIdeasLibrary() {
  const [ideas, setIdeas] = useState<MealIdea[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const response = await fetch('/api/nutrition/meal-ideas', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setIdeas(payload.ideas ?? [])
    } catch (error: any) {
      toast.error(error.message ?? 'Idee Pasti non disponibili')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('it')
    if (!needle) return ideas
    return ideas.filter(idea => `${idea.title} ${idea.category} ${idea.description}`.toLocaleLowerCase('it').includes(needle))
  }, [ideas, query])

  function edit(idea: MealIdea) {
    setEditingId(idea.id)
    setDraft({
      title: idea.title,
      category: idea.category,
      description: idea.description,
      ingredients: idea.ingredients,
      instructions: idea.instructions,
      sourceUrl: idea.source_url ?? '',
      images: idea.images ?? [],
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
      const response = await fetch(editingId ? `/api/nutrition/meal-ideas/${editingId}` : '/api/nutrition/meal-ideas', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      toast.success(editingId ? 'Idea pasto aggiornata' : 'Idea creata. Ora puoi aggiungere le immagini.')
      if (editingId) reset()
      else {
        setEditingId(payload.idea.id)
        setDraft(current => ({ ...current, images: [] }))
      }
      await load()
    } catch (error: any) {
      toast.error(error.message ?? 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  async function upload(files: File[]) {
    if (!editingId) return toast.error('Salva prima l’idea, poi aggiungi le immagini')
    const available = MEAL_IDEA_MAX_IMAGES - draft.images.length
    if (available <= 0) return toast.error(`Puoi inserire fino a ${MEAL_IDEA_MAX_IMAGES} immagini`)
    setUploading(true)
    try {
      const uploaded: MealIdeaImage[] = []
      for (const file of files.slice(0, available)) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > MEAL_IDEA_MAX_IMAGE_BYTES) {
          throw new Error('Usa immagini JPG, PNG, WebP o GIF inferiori a 5 MB')
        }
        const body = new FormData()
        body.append('file', file)
        const response = await fetch(`/api/nutrition/meal-ideas/${editingId}/images`, { method: 'POST', body })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error)
        uploaded.push({ ...payload.image, alt: draft.title })
      }
      setDraft(current => ({ ...current, images: [...current.images, ...uploaded] }))
      toast.success('Immagini aggiunte. Salva per confermare descrizioni e modifiche.')
    } catch (error: any) {
      toast.error(error.message ?? 'Caricamento non riuscito')
    } finally {
      setUploading(false)
    }
  }

  async function remove(idea: MealIdea) {
    if (!window.confirm(`Eliminare “${idea.title}” e le relative immagini?`)) return
    const response = await fetch(`/api/nutrition/meal-ideas/${idea.id}`, { method: 'DELETE' })
    if (!response.ok) return toast.error((await response.json()).error)
    if (editingId === idea.id) reset()
    toast.success('Idea pasto eliminata')
    await load()
  }

  return <div className="space-y-6">
    <Card>
      <CardContent className="space-y-4 p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="font-semibold">{editingId ? 'Modifica idea pasto' : 'Nuova idea pasto'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Inserisci una ricetta completa, una descrizione veloce oppure un link esterno.</p></div>
          {editingId && <Button size="sm" variant="ghost" onClick={reset}><X />Annulla</Button>}
        </div>

        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <Input value={draft.title} maxLength={160} placeholder="Titolo, es. Porridge di avena"
            onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} />
          <Input value={draft.category} maxLength={80} placeholder="Categoria, es. Colazione"
            onChange={event => setDraft(current => ({ ...current, category: event.target.value }))} />
        </div>
        <textarea className="w-full rounded-md border border-input bg-background p-3 text-sm" rows={3} maxLength={3000}
          value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
          placeholder="Descrizione e possibili sostituzioni" />
        <div className="grid gap-3 lg:grid-cols-2">
          <textarea className="w-full rounded-md border border-input bg-background p-3 text-sm" rows={6} maxLength={5000}
            value={draft.ingredients} onChange={event => setDraft(current => ({ ...current, ingredients: event.target.value }))}
            placeholder={'Ingredienti, uno per riga\n80 g fiocchi d’avena\n150 g yogurt'} />
          <textarea className="w-full rounded-md border border-input bg-background p-3 text-sm" rows={6} maxLength={5000}
            value={draft.instructions} onChange={event => setDraft(current => ({ ...current, instructions: event.target.value }))}
            placeholder="Preparazione e indicazioni" />
        </div>
        <Input type="url" value={draft.sourceUrl} maxLength={1000} placeholder="Link facoltativo alla ricetta o al prodotto"
          onChange={event => setDraft(current => ({ ...current, sourceUrl: event.target.value }))} />

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-medium">Immagini</p><p className="text-xs text-muted-foreground">Fino a 6 immagini, massimo 5 MB ciascuna.</p></div>
            <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent ${!editingId || uploading ? 'pointer-events-none opacity-50' : ''}`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Carica
              <input type="file" multiple className="hidden" accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={event => { void upload(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
            </label>
          </div>
          {!editingId && <p className="text-xs text-muted-foreground">Salva l’idea per abilitare il caricamento.</p>}
          {draft.images.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {draft.images.map((image, index) => <div key={image.path} className="overflow-hidden rounded-md border border-border">
              <div className="relative aspect-[4/3] bg-white">
                {image.url && <img src={image.url} alt={image.alt || draft.title} className="h-full w-full object-cover" />}
                <Button size="icon" variant="secondary" className="absolute right-1 top-1 h-7 w-7" aria-label="Rimuovi immagine"
                  onClick={() => setDraft(current => ({ ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) }))}><X className="h-4 w-4" /></Button>
              </div>
              <input value={image.alt} maxLength={160} className="h-9 w-full border-t border-border px-2 text-xs" placeholder="Descrizione immagine"
                onChange={event => setDraft(current => ({ ...current, images: current.images.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item) }))} />
            </div>)}
          </div>}
        </div>

        <div className="flex justify-end"><Button onClick={save} disabled={saving || !draft.title.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : editingId ? <Save /> : <Plus />}{editingId ? 'Salva modifiche' : 'Crea idea'}
        </Button></div>
      </CardContent>
    </Card>

    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="font-semibold">Le tue idee</h2><p className="text-sm text-muted-foreground">{ideas.length} elementi in libreria</p></div>
      <div className="relative w-64 max-w-full"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cerca titolo o categoria" /></div>
    </div>

    {loading ? <div className="h-40 animate-pulse rounded-md bg-muted" />
      : filtered.length === 0 ? <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">Nessuna idea pasto trovata.</div>
      : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map(idea => <article key={idea.id} className="overflow-hidden rounded-lg border bg-card">
          {idea.images?.[0]?.url && <div className="aspect-[16/9] bg-white"><img src={idea.images[0].url} alt={idea.images[0].alt || idea.title} className="h-full w-full object-cover" /></div>}
          <div className="p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0">
              <h3 className="font-medium">{idea.title}</h3>
              {idea.category && <p className="mt-1 text-xs font-medium text-primary">{idea.category}</p>}
            </div><div className="flex shrink-0"><Button size="icon" variant="ghost" aria-label="Modifica" onClick={() => edit(idea)}><Pencil /></Button>
              <Button size="icon" variant="ghost" aria-label="Elimina" onClick={() => void remove(idea)}><Trash2 /></Button></div></div>
            {idea.description && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{idea.description}</p>}
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{idea.images?.length ?? 0} immagini</span>
              {idea.source_url && <a href={idea.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Apri link<ExternalLink className="h-3 w-3" /></a>}
            </div>
          </div>
        </article>)}
      </div>}
  </div>
}
