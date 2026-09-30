'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  MoreHorizontal, Pencil, Link, UserX, UserCheck, Trash2, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ClientActionsProps {
  clientId: string
  locale: string
  clientName: string
  clientEmail: string | null
  hasPortalAccess: boolean
  isActive: boolean
}

export function ClientActions({
  clientId, locale, clientName, clientEmail, hasPortalAccess, isActive,
}: ClientActionsProps) {
  const t = useTranslations('clients.detail')
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleAction(action: string, body?: object) {
    setLoading(action)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(null)
    }
  }

  async function handlePortalInvite() {
    if (!clientEmail) {
      toast.error('Il cliente non ha un indirizzo email')
      return
    }
    setLoading('invite')
    try {
      const res = await fetch(`/api/clients/${clientId}/portal-invite`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(t('portalInviteSent', { email: clientEmail }))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete() {
    if (!confirm(t('deleteConfirm', { name: clientName }))) return
    setLoading('delete')
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(t('deleteSuccess') || 'Cliente eliminato')
      router.push(`/${locale}/dashboard/clients`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button size="sm" variant="outline" asChild>
        <a href={`/${locale}/dashboard/clients/${clientId}/edit`}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          {t('editClient')}
        </a>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MoreHorizontal className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {/* Invito portale */}
          {clientEmail && (
            <DropdownMenuItem onClick={handlePortalInvite}>
              <Link className="w-4 h-4 mr-2" />
              {hasPortalAccess ? 'Reinvia invito portale' : t('sendPortalInvite')}
            </DropdownMenuItem>
          )}

          {/* Attiva/Disattiva */}
          <DropdownMenuItem
            onClick={() => handleAction('toggle-active', { active: !isActive })}
          >
            {isActive ? (
              <><UserX className="w-4 h-4 mr-2" />Disattiva cliente</>
            ) : (
              <><UserCheck className="w-4 h-4 mr-2" />Riattiva cliente</>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Elimina */}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t('deleteClient')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
