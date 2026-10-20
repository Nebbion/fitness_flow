import type { PlanMeasurements } from '@/lib/nutrition/schemas'
import { Input } from '@/components/ui/index'

const fields = [
  ['weightKg', 'Peso (kg)', 500], ['fatMassKg', 'Massa grassa FM (kg)', 500],
  ['fatFreeMassKg', 'Massa magra FFM (kg)', 500], ['bodyFatPercent', 'Massa grassa (%)', 100],
  ['muscleMassKg', 'Massa muscolare (kg)', 500], ['totalBodyWaterL', 'Acqua corporea totale (L)', 300],
  ['phaseAngle', 'Angolo di fase (gradi)', 90], ['resistanceOhm', 'Resistenza (ohm)', 5000],
  ['reactanceOhm', 'Reattanza (ohm)', 5000], ['waistCm', 'Circonferenza vita (cm)', 300],
] as const

export function PlanMeasurementsEditor({ title, value, onChange }: {
  title: string; value: PlanMeasurements; onChange: (next: PlanMeasurements) => void
}) {
  return <section className="min-w-0 space-y-3 border-t pt-4">
    <h3 className="font-semibold">{title}</h3>
    <label className="block text-xs">Data rilevazione<Input className="mt-1" type="date" value={value.recordedOn ?? ''}
      onChange={event => onChange({ ...value, recordedOn: event.target.value || null })} /></label>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([key, label, max]) => <label key={key} className="min-w-0 text-xs">{label}
        <Input className="mt-1" type="number" min={0} max={max} step="any" value={value[key] ?? ''}
          onChange={event => onChange({ ...value, [key]: event.target.value === '' ? null : Number(event.target.value) })} />
      </label>)}
    </div>
    <label className="block text-xs">Altri dati BIA e note
      <textarea className="mt-1 w-full rounded-md border bg-background p-3 text-sm" rows={3} maxLength={3000} value={value.notes}
        onChange={event => onChange({ ...value, notes: event.target.value })} />
    </label>
  </section>
}

export function PlanMeasurementsComparison({ initial, final }: {
  initial?: Partial<PlanMeasurements>; final?: Partial<PlanMeasurements>
}) {
  const present = fields.filter(([key]) => initial?.[key] != null || final?.[key] != null)
  if (!present.length && !initial?.notes && !final?.notes && !initial?.recordedOn && !final?.recordedOn) return null
  return <section className="space-y-3">
    <h2 className="font-semibold">Rilevazioni del piano</h2>
    <table className="w-full text-left text-xs"><thead><tr className="border-b">
      <th className="py-2">Parametro</th><th>Inizio piano<br />{initial?.recordedOn}</th><th>Fine piano<br />{final?.recordedOn}</th>
    </tr></thead><tbody>{present.map(([key, label]) => <tr key={key} className="border-b">
      <th className="py-2 font-normal">{label}</th><td>{initial?.[key] ?? '—'}</td><td>{final?.[key] ?? '—'}</td>
    </tr>)}</tbody></table>
    {initial?.notes && <p className="whitespace-pre-wrap text-sm"><strong>Note iniziali:</strong> {initial.notes}</p>}
    {final?.notes && <p className="whitespace-pre-wrap text-sm"><strong>Note finali:</strong> {final.notes}</p>}
  </section>
}
