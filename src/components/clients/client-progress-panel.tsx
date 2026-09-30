'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, TrendingUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { formatDate } from '@/lib/utils'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface ClientProgressPanelProps {
  clientId: string
  locale: string
  role: UserRole
  tenantId: string
}

export function ClientProgressPanel({ clientId, locale, role, tenantId }: ClientProgressPanelProps) {
  const t = useTranslations('progress')
  const supabase = createSupabaseClient()

  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    weight_kg: '',
    body_fat_pct: '',
    muscle_mass_kg: '',
    notes: '',
    recorded_at: new Date().toISOString().split('T')[0],
  })

  async function load() {
    const { data } = await supabase
      .from('progress_entries')
      .select('*')
      .eq('client_id', clientId)
      .order('recorded_at', { ascending: true })
      .limit(50)
    setEntries(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [clientId])

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload: any = {
        client_id: clientId,
        tenant_id: tenantId,
        recorded_by: user?.id,
        recorded_at: new Date(form.recorded_at).toISOString(),
        notes: form.notes || null,
      }
      if (form.weight_kg) payload.weight_kg = parseFloat(form.weight_kg)
      if (form.body_fat_pct) payload.body_fat_pct = parseFloat(form.body_fat_pct)
      if (form.muscle_mass_kg) payload.muscle_mass_kg = parseFloat(form.muscle_mass_kg)

      const { error } = await supabase.from('progress_entries').insert(payload)
      if (error) throw error

      toast.success(t('createSuccess'))
      setShowForm(false)
      setForm({ weight_kg: '', body_fat_pct: '', muscle_mass_kg: '', notes: '', recorded_at: new Date().toISOString().split('T')[0] })
      await load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Dati per il grafico
  const chartData = entries.map(e => ({
    date: formatDate(e.recorded_at, locale === 'it' ? 'it-IT' : 'en-GB'),
    peso: e.weight_kg,
    grassi: e.body_fat_pct,
    muscoli: e.muscle_mass_kg,
  }))

  // Ultima misurazione
  const latest = entries[entries.length - 1]

  if (loading) {
    return <div className="h-48 rounded-xl bg-muted animate-pulse" />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{entries.length} misurazioni</p>
        {role !== 'CLIENT' && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            {t('newEntry')}
          </Button>
        )}
      </div>

      {/* Form nuova misurazione */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm">{t('newEntry')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('form.date')}</Label>
                <Input
                  type="date"
                  value={form.recorded_at}
                  onChange={e => setForm(f => ({ ...f, recorded_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('form.weight')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="70.5"
                  value={form.weight_kg}
                  onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('form.bodyFat')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="20.0"
                  value={form.body_fat_pct}
                  onChange={e => setForm(f => ({ ...f, body_fat_pct: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('form.muscleMass')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="35.0"
                  value={form.muscle_mass_kg}
                  onChange={e => setForm(f => ({ ...f, muscle_mass_kg: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('form.notes')}</Label>
              <Input
                placeholder="Note opzionali..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Annulla</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Salva
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('chart.noData')}</p>
        </div>
      ) : (
        <>
          {/* Cards ultima misurazione */}
          {latest && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t('chart.weight'), value: latest.weight_kg, unit: 'kg' },
                { label: t('chart.bodyFat'), value: latest.body_fat_pct, unit: '%' },
                { label: t('chart.muscleMass'), value: latest.muscle_mass_kg, unit: 'kg' },
              ].map(item => (
                <Card key={item.label}>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className="text-xl font-semibold">
                      {item.value != null ? `${item.value}${item.unit}` : '—'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Grafico andamento */}
          {chartData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Andamento nel tempo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {entries.some(e => e.weight_kg) && (
                      <Line type="monotone" dataKey="peso" stroke="#2563EB" strokeWidth={2} dot={false} name="Peso (kg)" />
                    )}
                    {entries.some(e => e.body_fat_pct) && (
                      <Line type="monotone" dataKey="grassi" stroke="#EF4444" strokeWidth={2} dot={false} name="Grassi (%)" />
                    )}
                    {entries.some(e => e.muscle_mass_kg) && (
                      <Line type="monotone" dataKey="muscoli" stroke="#22C55E" strokeWidth={2} dot={false} name="Muscoli (kg)" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Lista entries */}
          <div className="space-y-1.5">
            {[...entries].reverse().slice(0, 10).map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-accent/30 text-sm">
                <span className="text-muted-foreground">
                  {formatDate(entry.recorded_at, locale === 'it' ? 'it-IT' : 'en-GB')}
                </span>
                <div className="flex gap-4 text-right">
                  {entry.weight_kg && <span><strong>{entry.weight_kg}</strong> kg</span>}
                  {entry.body_fat_pct && <span><strong>{entry.body_fat_pct}</strong>%</span>}
                  {entry.muscle_mass_kg && <span><strong>{entry.muscle_mass_kg}</strong> kg 💪</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
