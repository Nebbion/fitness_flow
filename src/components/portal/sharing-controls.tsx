'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Membership = { id: string; tenants: { name: string; profession: string } | null }
type Share = { owner_client_id: string; recipient_client_id: string; scope: 'training' | 'nutrition' }

export function SharingControls() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [])
  async function load() {
    try {
      const response = await fetch('/api/portal/sharing', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setMemberships(payload.memberships)
      setShares(payload.shares)
    } catch (error: any) { toast.error(error.message ?? 'Impossibile caricare le condivisioni') }
    finally { setLoading(false) }
  }
  async function toggle(ownerClientId: string, recipientClientId: string, scope: 'training' | 'nutrition', enabled: boolean) {
    try {
      const response = await fetch('/api/portal/sharing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerClientId, recipientClientId, scope, enabled }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      setShares(current => enabled ? [...current, { owner_client_id: ownerClientId, recipient_client_id: recipientClientId, scope }]
        : current.filter(item => !(item.owner_client_id === ownerClientId && item.recipient_client_id === recipientClientId && item.scope === scope)))
    } catch (error: any) { toast.error(error.message ?? 'Impossibile aggiornare la condivisione') }
  }
  if (loading) return <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
  if (memberships.length < 2) return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Collega un secondo professionista al tuo portale per gestire le condivisioni.</div>
  return <div className="space-y-4">
    {memberships.flatMap(owner => memberships.filter(recipient => recipient.id !== owner.id).map(recipient => {
      const title = `${owner.tenants?.name ?? 'Professionista'} → ${recipient.tenants?.name ?? 'Professionista'}`
      return <section key={`${owner.id}-${recipient.id}`} className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Autorizza il professionista destinatario a consultare i dati selezionati, senza modificarli.</p>
        <div className="mt-4 space-y-3">
          {(['training', 'nutrition'] as const).map(scope => {
            const checked = shares.some(item => item.owner_client_id === owner.id && item.recipient_client_id === recipient.id && item.scope === scope)
            return <label key={scope} className="flex items-center justify-between gap-3 text-sm"><span>{scope === 'training' ? 'Scheda allenamento' : 'Piano alimentare'}</span>
              <input type="checkbox" checked={checked} onChange={event => void toggle(owner.id, recipient.id, scope, event.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
          })}
        </div>
      </section>
    }))}
  </div>
}
