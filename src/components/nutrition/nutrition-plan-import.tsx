'use client'

import { useMemo, useState } from 'react'
import { Check, FileImage, FileText, Loader2, Sparkles, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/index'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { NutritionDay } from '@/lib/nutrition/schemas'
import {
  NUTRITION_IMPORT_BUCKET,
  NUTRITION_IMPORT_MAX_FILE_BYTES,
  NUTRITION_IMPORT_MAX_FILES,
  NUTRITION_IMPORT_MAX_TOTAL_BYTES,
} from '@/lib/nutrition/import'

export type ImportedNutritionDraft = {
  title: string
  objective: string
  guidelines: string
  targetCalories: number | null
  startsOn: string | null
  endsOn: string | null
  days: NutritionDay[]
  warnings: string[]
}

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export function NutritionPlanImport({ onApply }: { onApply: (draft: ImportedNutritionDraft) => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<ImportedNutritionDraft | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState('')

  const mealCount = useMemo(
    () => preview?.days.reduce((sum, day) => sum + day.meals.length, 0) ?? 0,
    [preview]
  )

  function chooseFiles(nextFiles: File[]) {
    if (nextFiles.length > NUTRITION_IMPORT_MAX_FILES) {
      return toast.error(`Puoi caricare fino a ${NUTRITION_IMPORT_MAX_FILES} file`)
    }
    if (nextFiles.some(file => !acceptedTypes.includes(file.type))) {
      return toast.error('Usa immagini JPG, PNG, WebP oppure un PDF')
    }
    if (nextFiles.some(file => file.size <= 0 || file.size > NUTRITION_IMPORT_MAX_FILE_BYTES)) {
      return toast.error('Ogni file deve essere inferiore a 12 MB')
    }
    if (nextFiles.reduce((sum, file) => sum + file.size, 0) > NUTRITION_IMPORT_MAX_TOTAL_BYTES) {
      return toast.error('I file devono occupare complessivamente meno di 25 MB')
    }
    setFiles(nextFiles)
    setPreview(null)
  }

  async function discard(paths: string[]) {
    if (!paths.length) return
    await fetch('/api/nutrition/import/upload', {
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
      const supabase = createSupabaseClient()
      const uploaded: Array<{ path: string; name: string; mimeType: string; size: number }> = []

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        setProgress(`Caricamento file ${index + 1} di ${files.length}…`)
        const signedResponse = await fetch('/api/nutrition/import/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size }),
        })
        const signedPayload = await signedResponse.json()
        if (!signedResponse.ok) throw new Error(signedPayload.error ?? 'Caricamento non riuscito')

        const upload = signedPayload.upload
        const { error } = await supabase.storage.from(NUTRITION_IMPORT_BUCKET)
          .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type, cacheControl: '60' })
        if (error) throw new Error('Caricamento del file non riuscito')
        uploadedPaths.push(upload.path)
        uploaded.push({ path: upload.path, name: file.name, mimeType: file.type, size: file.size })
      }

      setProgress('L’AI sta leggendo pasti, quantità e alternative…')
      const response = await fetch('/api/nutrition/import/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: uploaded }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Analisi non riuscita')

      setPreview(payload.draft)
      uploadedPaths.length = 0
      toast.success('Piano letto: controlla la bozza prima di usarla')
    } catch (error: any) {
      await discard(uploadedPaths)
      toast.error(error.message ?? 'Importazione non riuscita')
    } finally {
      setAnalyzing(false)
      setProgress('')
    }
  }

  return <Card>
    <CardContent className="space-y-5 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Sparkles className="h-5 w-5" /></div>
        <div><h2 className="font-semibold">Importa un piano alimentare con l’AI</h2>
          <p className="mt-1 text-sm text-muted-foreground">Carica il PDF o le fotografie. L’AI prepara una bozza e non inventa valori nutrizionali mancanti.</p></div>
      </div>

      {!preview && <>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center hover:bg-accent/40">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="mt-2 text-sm font-medium">Scegli foto o PDF</span>
          <span className="mt-1 text-xs text-muted-foreground">Fino a 6 file, 12 MB ciascuno e 25 MB complessivi</span>
          <input type="file" multiple className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={event => { chooseFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} />
        </label>

        {files.length > 0 && <div className="space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
          {file.type === 'application/pdf' ? <FileText className="h-4 w-4 text-muted-foreground" /> : <FileImage className="h-4 w-4 text-muted-foreground" />}
          <span className="min-w-0 flex-1 truncate">{file.name}</span><span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Rimuovi file" onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}><X className="h-4 w-4" /></Button>
        </div>)}</div>}

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">I file vengono cancellati dallo storage appena terminata l’analisi.</p>
          <Button onClick={analyze} disabled={analyzing || files.length === 0}>{analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />}{analyzing ? progress || 'Analisi…' : 'Analizza piano'}</Button>
        </div>
      </>}

      {preview && <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-muted/40 p-4">
          <div><p className="font-semibold">{preview.title}</p><p className="mt-1 text-xs text-muted-foreground">{preview.days.length} giornate · {mealCount} pasti rilevati</p></div>
          <Button size="sm" variant="outline" onClick={() => { setPreview(null); setFiles([]) }}><X />Annulla</Button>
        </div>
        {preview.warnings.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <p className="font-medium">Controlla questi punti:</p><ul className="mt-1 list-disc space-y-1 pl-5">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        </div>}
        <div className="space-y-2">{preview.days.map(day => <div key={day.id} className="rounded-md border p-3">
          <p className="text-sm font-medium">{day.label}</p><p className="mt-1 text-xs text-muted-foreground">{day.meals.map(meal => meal.name).join(' · ')}</p>
        </div>)}</div>
        <div className="flex justify-end border-t pt-4"><Button onClick={() => { onApply(preview); setPreview(null); setFiles([]) }}><Check />Usa come nuova bozza</Button></div>
      </div>}
    </CardContent>
  </Card>
}
