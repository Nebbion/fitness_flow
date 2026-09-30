'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Sparkles, Copy, Check, RefreshCw, Loader2,
  Salad, Dumbbell, FileText, MessageSquare, Mail, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label, Card, CardContent } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import type { AIFeature } from '@/lib/ai/openai'
import type { ProfessionType } from '@/types'

interface AIAssistantProps {
  locale: string
  profession: string
  clients: { id: string; full_name: string; email: string | null }[]
  plan: string
}

interface FeatureConfig {
  key: AIFeature
  labelKey: string
  icon: React.ElementType
  professions: string[]
  needsClient: boolean
  needsInstruction: boolean
  instructionPlaceholder: string
}

const FEATURES: FeatureConfig[] = [
  {
    key: 'nutrition_plan',
    labelKey: 'nutritionPlan',
    icon: Salad,
    professions: ['nutritionist'],
    needsClient: true,
    needsInstruction: true,
    instructionPlaceholder: 'Es. obiettivo dimagrimento, allergia al glutine, 1800 kcal...',
  },
  {
    key: 'meal_suggestions',
    labelKey: 'nutritionPlan',
    icon: Salad,
    professions: ['nutritionist'],
    needsClient: true,
    needsInstruction: true,
    instructionPlaceholder: 'Es. colazione proteica, pranzo veloce da ufficio...',
  },
  {
    key: 'workout_plan',
    labelKey: 'workoutPlan',
    icon: Dumbbell,
    professions: ['personal_trainer', 'physiotherapist'],
    needsClient: true,
    needsInstruction: true,
    instructionPlaceholder: 'Es. 3 giorni/settimana, focus gambe e glutei, solo corpo libero...',
  },
  {
    key: 'workout_progression',
    labelKey: 'workoutPlan',
    icon: Dumbbell,
    professions: ['personal_trainer'],
    needsClient: true,
    needsInstruction: false,
    instructionPlaceholder: '',
  },
  {
    key: 'summarize_client',
    labelKey: 'summarizeClient' as any,
    icon: FileText,
    professions: ['nutritionist', 'personal_trainer', 'physiotherapist', 'osteopath', 'massage_therapist', 'other'],
    needsClient: true,
    needsInstruction: false,
    instructionPlaceholder: '',
  },
  {
    key: 'draft_whatsapp',
    labelKey: 'draftWhatsapp' as any,
    icon: MessageSquare,
    professions: ['nutritionist', 'personal_trainer', 'physiotherapist', 'osteopath', 'massage_therapist', 'other'],
    needsClient: true,
    needsInstruction: true,
    instructionPlaceholder: 'Es. reminder per appuntamento di domani, follow-up dopo sessione...',
  },
  {
    key: 'draft_email',
    labelKey: 'draftEmail' as any,
    icon: Mail,
    professions: ['nutritionist', 'personal_trainer', 'physiotherapist', 'osteopath', 'massage_therapist', 'other'],
    needsClient: true,
    needsInstruction: true,
    instructionPlaceholder: 'Es. invio piano alimentare aggiornato, proposta nuovo percorso...',
  },
]

const FEATURE_LABELS: Record<string, string> = {
  nutrition_plan: 'Piano Alimentare',
  meal_suggestions: 'Suggerimenti Pasti',
  workout_plan: 'Scheda Allenamento',
  workout_progression: 'Progressione',
  summarize_client: 'Riassunto Cliente',
  draft_whatsapp: 'Bozza WhatsApp',
  draft_email: 'Bozza Email',
}

export function AIAssistant({ locale, profession, clients, plan }: AIAssistantProps) {
  const t = useTranslations('ai')

  const [selectedFeature, setSelectedFeature] = useState<AIFeature | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [instruction, setInstruction] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const availableFeatures = FEATURES.filter(f =>
    f.professions.includes(profession) || f.professions.includes('other')
  )

  const currentFeature = FEATURES.find(f => f.key === selectedFeature)

  const filteredClients = clients.filter(c =>
    c.full_name.toLowerCase().includes(clientSearch.toLowerCase())
  )

  async function handleGenerate() {
    if (!selectedFeature) return
    if (currentFeature?.needsClient && !selectedClientId) {
      toast.error(t('selectClient'))
      return
    }

    setOutput('')
    setLoading(true)
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: selectedFeature,
          clientId: selectedClientId || undefined,
          customInstruction: instruction || undefined,
          locale,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(err)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        text += chunk
        setOutput(text)
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error(err.message ?? 'Errore durante la generazione')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success(t('copied'))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Pannello sinistra — configurazione */}
      <div className="space-y-4">
        {/* Selezione feature */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Funzionalità</Label>
            <div className="space-y-1">
              {availableFeatures.map(feature => {
                const Icon = feature.icon
                return (
                  <button
                    key={feature.key}
                    onClick={() => { setSelectedFeature(feature.key); setOutput('') }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors',
                      selectedFeature === feature.key
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {FEATURE_LABELS[feature.key]}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selezione cliente */}
        {currentFeature?.needsClient && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cerca cliente..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {filteredClients.slice(0, 20).map(client => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors',
                      selectedClientId === client.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent'
                    )}
                  >
                    {client.full_name}
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-1">Nessun cliente trovato</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Istruzioni aggiuntive */}
        {currentFeature?.needsInstruction && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Istruzioni</Label>
              <textarea
                rows={4}
                placeholder={currentFeature.instructionPlaceholder}
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </CardContent>
          </Card>
        )}

        {/* Genera */}
        <Button
          className="w-full"
          disabled={!selectedFeature || loading}
          onClick={handleGenerate}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generazione...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Genera con AI
            </>
          )}
        </Button>

        {loading && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => abortRef.current?.abort()}
          >
            Interrompi
          </Button>
        )}
      </div>

      {/* Pannello destra — output */}
      <div className="lg:col-span-2">
        <Card className="h-full min-h-96">
          <CardContent className="p-0 h-full flex flex-col">
            {/* Header output */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  {selectedFeature ? FEATURE_LABELS[selectedFeature] : 'Output AI'}
                </span>
                {loading && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Generando...
                  </span>
                )}
              </div>
              {output && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setOutput(''); setInstruction('') }}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Nuovo
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied
                      ? <><Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />Copiato</>
                      : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copia</>
                    }
                  </Button>
                </div>
              )}
            </div>

            {/* Contenuto */}
            <div className="flex-1 p-4 overflow-y-auto">
              {!output && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Seleziona una funzionalità</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Scegli cosa generare e premi il pulsante
                    </p>
                  </div>
                </div>
              )}

              {(output || loading) && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {output}
                    {loading && <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
