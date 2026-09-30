'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TenantPlan, TenantStatus } from '@/types'

const PLAN_OPTIONS: { value: TenantPlan; label: string }[] = [
  { value: 'trial', label: 'Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'business', label: 'Business' },
]

const STATUS_OPTIONS: { value: TenantStatus; label: string }[] = [
  { value: 'active', label: 'Attivo' },
  { value: 'inactive', label: 'Inattivo' },
  { value: 'suspended', label: 'Sospeso' },
  { value: 'cancelled', label: 'Cancellato' },
]

interface AdminTenantActionsProps {
  tenantId: string
  currentPlan: TenantPlan
  currentStatus: TenantStatus
  maxClients: number
}

export function AdminTenantActions({
  tenantId,
  currentPlan,
  currentStatus,
  maxClients,
}: AdminTenantActionsProps) {
  const router = useRouter()
  const [plan, setPlan] = useState<TenantPlan>(currentPlan)
  const [status, setStatus] = useState<TenantStatus>(currentStatus)
  const [clientLimit, setClientLimit] = useState(String(maxClients))
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    try {
      const parsedClientLimit = Number(clientLimit)
      if (!Number.isInteger(parsedClientLimit) || parsedClientLimit < 0) {
        throw new Error('Il limite clienti deve essere un numero intero positivo.')
      }

      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          status,
          max_clients: parsedClientLimit,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error ?? 'Aggiornamento non riuscito')

      toast.success('Tenant aggiornato')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Piano"
        value={plan}
        onChange={event => setPlan(event.target.value as TenantPlan)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={loading}
      >
        {PLAN_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      <select
        aria-label="Stato"
        value={status}
        onChange={event => setStatus(event.target.value as TenantStatus)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={loading}
      >
        {STATUS_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      <input
        aria-label="Limite clienti"
        type="number"
        min={0}
        max={999999}
        value={clientLimit}
        onChange={event => setClientLimit(event.target.value)}
        className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={loading}
      />

      <Button type="submit" size="sm" variant="outline" disabled={loading} className="h-8">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Salva
      </Button>
    </form>
  )
}
