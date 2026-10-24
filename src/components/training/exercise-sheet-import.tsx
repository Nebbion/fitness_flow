'use client'

import { useMemo, useState } from 'react'
import { Check, FileImage, FileText, Loader2, Sparkles, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, Input } from '@/components/ui/index'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  EXERCISE_IMPORT_BUCKET,
  EXERCISE_IMPORT_MAX_FILES,
  EXERCISE_IMPORT_MAX_FILE_BYTES,
  EXERCISE_IMPORT_MAX_TOTAL_BYTES,
  type ImportedExercise,
} from '@/lib/training/exercise-import'

type ImportExerciseDraft = ImportedExercise & {
  confidence: 'high' | 'medium' | 'low'
  needsReview: boolean
  usedFallbackSets: boolean
  usedFallbackReps: boolean
  selected: boolean
}

type ImportPreview = {
  title: string
  warnings: string[]
  exercises: ImportExerciseDraft[]
}

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

async function compressImage(file: File) {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= EXERCISE_IMPORT_MAX_FILE_BYTES) {
      bitmap.close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    for (const quality of [0.88, 0.72, 0.58]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= EXERCISE_IMPORT_MAX_FILE_BYTES) {
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
          type: 'image/jpeg',
          lastModified: file.lastModified,
        })
      }
    }
  } catch {
    // Se il browser non riesce a comprimere, verra validato il file originale.
  }
  return file
}

export function ExerciseSheetImport({ onImported }: { onImported: () => Promise<void> | void }) {
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')

  const selectedCount = useMemo(
    () => preview?.exercises.filter(exercise => exercise.selected).length ?? 0,
    [preview]
  )

  function chooseFiles(nextFiles: File[]) {
    if (nextFiles.length > EXERCISE_IMPORT_MAX_FILES) {
      toast.error(`Puoi caricare fino a ${EXERCISE_IMPORT_MAX_FILES} pagine`)
      return
    }
    if (nextFiles.some(file => !acceptedTypes.includes(file.type))) {
      toast.error('Usa immagini JPG, PNG, WebP oppure un PDF')
      return
    }
    setFiles(nextFiles)
    setPreview(null)
  }

  async function discard(paths: string[]) {
    if (!paths.length) return
    await fetch('/api/training/exercises/import/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    }).catch(() => {})
  }

  async function analyze() {
    if (!files.length) return toast.error('Seleziona almeno una foto o un PDF')
    setAnalyzing(true)
    setPreview(null)
    const uploadedPaths: string[] = []
    try {
      setProgress('Preparazione dei file…')
      const preparedFiles: File[] = []
      for (const file of files) preparedFiles.push(await compressImage(file))
      if (preparedFiles.some(file => file.size <= 0 || file.size > EXERCISE_IMPORT_MAX_FILE_BYTES)) {
        throw new Error('Ogni file deve essere inferiore a 8 MB')
      }
      if (preparedFiles.reduce((sum, file) => sum + file.size, 0) > EXERCISE_IMPORT_MAX_TOTAL_BYTES) {
        throw new Error('I file devono occupare complessivamente meno di 20 MB')
      }

      const supabase = createSupabaseClient()
      const uploaded: Array<{ path: string; name: string; mimeType: string; size: number }> = []
      for (let index = 0; index < preparedFiles.length; index += 1) {
        const file = preparedFiles[index]
        setProgress(`Caricamento pagina ${index + 1} di ${preparedFiles.length}…`)
        const signedResponse = await fetch('/api/training/exercises/import/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size }),
        })
        const signedPayload = await signedResponse.json()
        if (!signedResponse.ok) throw new Error(signedPayload.error ?? 'Caricamento non riuscito')

        const upload = signedPayload.upload
        const { error } = await supabase.storage
          .from(EXERCISE_IMPORT_BUCKET)
          .uploadToSignedUrl(upload.path, upload.token, file, {
            contentType: file.type,
            cacheControl: '60',
          })
        if (error) throw new Error('Caricamento del file non riuscito')
        uploadedPaths.push(upload.path)
        uploaded.push({ path: upload.path, name: file.name, mimeType: file.type, size: file.size })
      }

      setProgress('L’AI sta leggendo esercizi, serie e ripetizioni…')
      const response = await fetch('/api/training/exercises/import/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: uploaded }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Analisi non riuscita')

      setPreview({
        title: payload.title,
        warnings: payload.warnings ?? [],
        exercises: (payload.exercises ?? []).map((exercise: ImportExerciseDraft) => ({
          ...exercise,
          selected: true,
        })),
      })
      uploadedPaths.length = 0
      toast.success(`${payload.exercises.length} esercizi rilevati: controllali prima di importarli`)
    } catch (error: any) {
      await discard(uploadedPaths)
      toast.error(error.message ?? 'Importazione non riuscita')
    } finally {
      setAnalyzing(false)
      setProgress('')
    }
  }

  function updateExercise(index: number, patch: Partial<ImportExerciseDraft>) {
    setPreview(current => current ? {
      ...current,
      exercises: current.exercises.map((exercise, itemIndex) =>
        itemIndex === index ? { ...exercise, ...patch } : exercise
      ),
    } : current)
  }

  async function confirmImport() {
    if (!preview) return
    const selected = preview.exercises
      .filter(exercise => exercise.selected)
      .map(({ confidence: _confidence, needsReview: _needsReview, usedFallbackSets: _sets, usedFallbackReps: _reps, selected: _selected, ...exercise }) => exercise)
    if (!selected.length) return toast.error('Seleziona almeno un esercizio')

    setSaving(true)
    try {
      const response = await fetch('/api/training/exercises/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercises: selected }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Salvataggio non riuscito')
      const createdCount = payload.created?.length ?? 0
      const skippedCount = payload.skipped?.length ?? 0
      toast.success(`${createdCount} esercizi aggiunti alla libreria${skippedCount ? `, ${skippedCount} già presenti` : ''}`)
      setPreview(null)
      setFiles([])
      await onImported()
    } catch (error: any) {
      toast.error(error.message ?? 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  return <Card>
    <CardContent className="space-y-5 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Sparkles className="h-5 w-5" /></div>
        <div>
          <h2 className="font-semibold">Importa una scheda con l’AI</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fotografa le pagine oppure carica un PDF. Potrai correggere ogni esercizio prima di salvarlo.
          </p>
        </div>
      </div>

      {!preview && <>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center hover:bg-accent/40">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="mt-2 text-sm font-medium">Scegli foto o PDF</span>
          <span className="mt-1 text-xs text-muted-foreground">Fino a 6 pagine, 8 MB ciascuna e 20 MB complessivi</span>
          <input
            type="file"
            multiple
            className="hidden"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={event => { chooseFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }}
          />
        </label>

        {files.length > 0 && <div className="space-y-2">
          {files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
            {file.type === 'application/pdf' ? <FileText className="h-4 w-4 text-muted-foreground" /> : <FileImage className="h-4 w-4 text-muted-foreground" />}
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Rimuovi file" onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}>
              <X className="h-4 w-4" />
            </Button>
          </div>)}
        </div>}

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            I file vengono inviati al servizio AI e cancellati dallo storage dopo l’analisi.
          </p>
          <Button onClick={analyze} disabled={analyzing || files.length === 0}>
            {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {analyzing ? progress || 'Analisi…' : 'Analizza scheda'}
          </Button>
        </div>
      </>}

      {preview && <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-muted/40 p-3">
          <div><p className="text-sm font-semibold">{preview.title}</p><p className="text-xs text-muted-foreground">{preview.exercises.length} esercizi rilevati</p></div>
          <Button size="sm" variant="outline" onClick={() => { setPreview(null); setFiles([]) }}><X />Annulla importazione</Button>
        </div>

        {preview.warnings.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <p className="font-medium">Controlla questi punti:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        </div>}

        <div className="space-y-3">
          {preview.exercises.map((exercise, index) => <section key={index} className={`rounded-lg border p-4 ${exercise.needsReview ? 'border-amber-500/40' : 'border-border'}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={exercise.selected} onChange={event => updateExercise(index, { selected: event.target.checked })} />
                Esercizio {index + 1}
              </label>
              <span className={`rounded-full px-2 py-0.5 text-xs ${exercise.needsReview ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-green-500/15 text-green-700 dark:text-green-300'}`}>
                {exercise.needsReview ? 'Da controllare' : 'Lettura affidabile'}
              </span>
            </div>
            <div className={`space-y-3 ${exercise.selected ? '' : 'pointer-events-none opacity-50'}`}>
              <Input value={exercise.name} maxLength={120} placeholder="Nome esercizio" onChange={event => updateExercise(index, { name: event.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">Serie{exercise.usedFallbackSets ? ' (predefinite)' : ''}
                  <Input className="mt-1" type="number" min={1} max={20} value={exercise.defaultSets} onChange={event => updateExercise(index, { defaultSets: Number(event.target.value), usedFallbackSets: false })} />
                </label>
                <label className="text-xs text-muted-foreground">Ripetizioni{exercise.usedFallbackReps ? ' (predefinite)' : ''}
                  <Input className="mt-1" value={exercise.defaultReps} maxLength={30} onChange={event => updateExercise(index, { defaultReps: event.target.value, usedFallbackReps: false })} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">Carico (kg)
                  <Input className="mt-1" type="number" min={0} max={2000} step="any" value={exercise.defaultWeightKg ?? ''} onChange={event => updateExercise(index, { defaultWeightKg: event.target.value === '' ? null : Number(event.target.value) })} />
                </label>
                <label className="text-xs text-muted-foreground">Isometria (secondi)
                  <Input className="mt-1" type="number" min={1} max={3600} value={exercise.defaultIsometrySeconds ?? ''} onChange={event => updateExercise(index, { defaultIsometrySeconds: event.target.value === '' ? null : Number(event.target.value) })} />
                </label>
              </div>
              <textarea className="w-full rounded-md border border-input bg-background p-3 text-sm" rows={2} maxLength={500} value={exercise.notes} placeholder="Note tecniche" onChange={event => updateExercise(index, { notes: event.target.value })} />
            </div>
          </section>)}
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button onClick={confirmImport} disabled={saving || selectedCount === 0}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
            Importa {selectedCount} esercizi
          </Button>
        </div>
      </div>}
    </CardContent>
  </Card>
}

