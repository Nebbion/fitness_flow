'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarCheck2, Info, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import type { TrainingProgressStats } from '@/lib/training/progress'

const RANGES = [1, 3, 6, 12, 24] as const

function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits }).format(value)
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(value))
}

export function ClientProgressDashboard({ token, brand }: { token: string; brand: string }) {
  const [months, setMonths] = useState<number>(3)
  const [stats, setStats] = useState<TrainingProgressStats | null>(null)
  const [aiEnabled, setAIEnabled] = useState(false)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [analysisError, setAnalysisError] = useState('')

  async function load(signal?: AbortSignal) {
    setStatus('loading')
    setError('')
    setAnalysis('')
    setAnalysisStatus('idle')
    try {
      const response = await fetch(`/api/training/${token}/progress?months=${months}`, { cache: 'no-store', signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Impossibile caricare i progressi')
      setStats(payload.stats)
      setAIEnabled(payload.aiEnabled)
      setSelectedExerciseId(current => payload.stats.exercises.some((item: any) => item.exerciseId === current)
        ? current
        : payload.stats.exercises[0]?.exerciseId ?? '')
      setStatus('ready')
    } catch (caught: any) {
      if (caught.name === 'AbortError') return
      setError(caught.message)
      setStatus('error')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [token, months])

  const selectedExercise = useMemo(
    () => stats?.exercises.find(exercise => exercise.exerciseId === selectedExerciseId) ?? null,
    [stats, selectedExerciseId]
  )

  async function analyze() {
    setAnalysisStatus('loading')
    setAnalysisError('')
    try {
      const response = await fetch(`/api/training/${token}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ months }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Analisi non disponibile')
      setAnalysis(payload.analysis)
      setAnalysisStatus('idle')
    } catch (caught: any) {
      setAnalysisError(caught.message)
      setAnalysisStatus('error')
    }
  }

  if (status === 'loading') return <div className="space-y-4" aria-label="Caricamento progressi">
    <div className="h-10 rounded-md bg-muted animate-pulse" />
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border">
      {[1, 2, 3].map(item => <div key={item} className="h-24 bg-background animate-pulse" />)}
    </div>
    <div className="h-64 rounded-md bg-muted animate-pulse" />
  </div>

  if (status === 'error' || !stats) return <div className="rounded-md border border-destructive/30 bg-background p-5 text-center">
    <p className="text-sm text-destructive">{error || 'Impossibile caricare i progressi'}</p>
    <Button className="mt-4" size="sm" variant="outline" onClick={() => load()}><RefreshCw />Riprova</Button>
  </div>

  const volumeData = stats.sessionSeries.map(session => ({
    date: shortDate(session.completedAt),
    volume: session.volumeKgReps,
  }))
  const loadData = selectedExercise?.points.map(point => ({
    date: shortDate(point.completedAt),
    carico: point.maxLoadKg,
  })) ?? []

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">I miei progressi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sessioni completate e valori effettivamente registrati.</p>
      </div>
    </div>

    <div className="grid grid-cols-5 overflow-hidden rounded-md border border-border" aria-label="Intervallo progressi">
      {RANGES.map(range => <button key={range} type="button" onClick={() => setMonths(range)} aria-pressed={months === range}
        className={`h-10 border-r border-border text-sm last:border-r-0 ${months === range ? 'text-white font-medium' : 'bg-background text-muted-foreground'}`}
        style={months === range ? { background: brand } : undefined}>
        {range}m
      </button>)}
    </div>

    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
      <div className="bg-background p-3 min-w-0"><CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
        <p className="mt-3 text-xl font-semibold">{stats.completedSessions}</p><p className="text-xs text-muted-foreground">Allenamenti</p></div>
      <div className="bg-background p-3 min-w-0"><Activity className="h-4 w-4 text-muted-foreground" />
        <p className="mt-3 text-xl font-semibold truncate">{formatNumber(stats.totalVolumeKgReps, 0)}</p><p className="text-xs text-muted-foreground">kg·rip</p></div>
      <div className="bg-background p-3 min-w-0"><span className="text-sm text-muted-foreground">Σ</span>
        <p className="mt-3 text-xl font-semibold">{stats.totalSets}</p><p className="text-xs text-muted-foreground">Serie registrate</p></div>
    </div>

    <div className="flex gap-2 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
      <Info className="h-4 w-4 shrink-0" />
      <p>Volume = somma di ripetizioni × kg nelle serie con entrambi i valori. Il carico è il massimo in kg registrato per lo stesso esercizio e sessione.</p>
    </div>

    {stats.completedSessions === 0 ? <div className="rounded-md border border-dashed border-border bg-background p-8 text-center">
      <Activity className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="mt-3 font-medium">Nessun allenamento nel periodo</p>
      <p className="mt-1 text-sm text-muted-foreground">Completa una sessione oppure seleziona un intervallo più ampio.</p>
    </div> : <>
      <section className="border-t border-border pt-5">
        <div className="mb-3"><h2 className="font-semibold">Volume per allenamento</h2><p className="text-xs text-muted-foreground">Unità: kg·rip</p></div>
        {volumeData.some(item => item.volume > 0) ? <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [`${formatNumber(value)} kg·rip`, 'Volume']} />
              <Bar dataKey="volume" fill={brand} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div> : <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">Le sessioni non contengono ancora serie con ripetizioni e kg compilati.</p>}
      </section>

      <section className="border-t border-border pt-5 space-y-4">
        <div><h2 className="font-semibold">Andamento carichi</h2><p className="text-xs text-muted-foreground">Ogni esercizio è confrontato solo con il proprio storico in kg.</p></div>
        {stats.exercises.length ? <>
          <select className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedExerciseId}
            onChange={event => setSelectedExerciseId(event.target.value)} aria-label="Seleziona esercizio">
            {stats.exercises.map(exercise => <option key={exercise.exerciseId} value={exercise.exerciseId}>{exercise.name}</option>)}
          </select>
          {loadData.length >= 2 ? <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={loadData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} unit=" kg" />
                <Tooltip formatter={(value: number) => [`${formatNumber(value)} kg`, 'Carico massimo']} />
                <Line type="monotone" dataKey="carico" stroke={brand} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div> : <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">Servono almeno due sessioni con un carico in kg per mostrare l’andamento.</p>}

          <div className="divide-y divide-border border-y border-border">
            {stats.exercises.map(exercise => <div key={exercise.exerciseId} className="grid grid-cols-[1fr_auto_auto] gap-3 py-3 text-sm">
              <span className="truncate font-medium">{exercise.name}</span>
              <span className="text-right"><strong>{formatNumber(exercise.latestLoadKg)}</strong><span className="text-xs text-muted-foreground"> kg ultimo</span></span>
              <span className="text-right"><strong>{formatNumber(exercise.bestLoadKg)}</strong><span className="text-xs text-muted-foreground"> kg max</span></span>
            </div>)}
          </div>
        </> : <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">Nessun carico in kg registrato per gli esercizi nel periodo.</p>}
      </section>
    </>}

    {(stats.insufficientHistory || stats.invalidSessions > 0 || stats.truncated) && <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
      {stats.insufficientHistory && <p>Lo storico è insufficiente per valutare un andamento: servono almeno due sessioni completate.</p>}
      {stats.invalidSessions > 0 && <p>{stats.invalidSessions} sessioni non valide sono state escluse dai calcoli.</p>}
      {stats.truncated && <p>Sono mostrate le prime 500 sessioni del periodo; i totali possono essere parziali.</p>}
    </div>}

    <section className="border-t border-border pt-5 space-y-3">
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Analisi AI</h2>
        <p className="mt-1 text-xs text-muted-foreground">Interpreta queste statistiche; non modifica la scheda e non prevede risultati futuri.</p></div><Sparkles className="h-5 w-5 text-muted-foreground" /></div>
      {!aiEnabled ? <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Analisi non attiva. Il provider non è configurato.</p>
        : <Button className="w-full h-11" variant="outline" onClick={analyze} disabled={analysisStatus === 'loading' || stats.completedSessions === 0}>
          {analysisStatus === 'loading' ? <Loader2 className="animate-spin" /> : <Sparkles />}Analizza i miei progressi
        </Button>}
      {analysisError && <p className="text-sm text-destructive">{analysisError}</p>}
      {analysis && <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm leading-6">{analysis}</div>}
    </section>
  </div>
}
