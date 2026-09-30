'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, MoreHorizontal, ShieldCheck, UserX, UserCheck } from 'lucide-react'
import { inviteStaffSchema, type InviteStaffInput } from '@/schemas'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/index'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── Staff Invite Form ────────────────────────────────────────
export function StaffInviteForm({ locale }: { locale: string }) {
  const t = useTranslations('staff')
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteStaffInput>({
    resolver: zodResolver(inviteStaffSchema),
    defaultValues: { role: 'STAFF' },
  })

  async function onSubmit(data: InviteStaffInput) {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, locale }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(t('inviteSent', { email: data.email }))
      reset()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('form.fullName')}</Label>
          <Input placeholder="Mario Rossi" {...register('full_name')} />
          {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('form.email')}</Label>
          <Input type="email" placeholder="mario@studio.it" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs">{t('form.role')}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register('role')}
          >
            <option value="STAFF">{t('roles.STAFF')}</option>
            <option value="TENANT_ADMIN">{t('roles.TENANT_ADMIN')}</option>
          </select>
        </div>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Invia invito
        </Button>
      </div>
    </form>
  )
}

// ─── Staff Member Actions ─────────────────────────────────────
interface StaffMemberActionsProps {
  memberId: string
  memberName: string
  currentRole: 'TENANT_ADMIN' | 'STAFF'
  isActive: boolean
  locale: string
}

export function StaffMemberActions({
  memberId, memberName, currentRole, isActive, locale,
}: StaffMemberActionsProps) {
  const t = useTranslations('staff')
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleAction(body: object) {
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    if (!confirm(t('removeConfirm', { name: memberName }))) return
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(t('removeSuccess'))
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() =>
          handleAction({ role: currentRole === 'STAFF' ? 'TENANT_ADMIN' : 'STAFF' })
        }>
          <ShieldCheck className="w-4 h-4 mr-2" />
          {currentRole === 'STAFF' ? 'Promuovi ad Admin' : 'Rimuovi da Admin'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction({ active: !isActive })}>
          {isActive
            ? <><UserX className="w-4 h-4 mr-2" />Disattiva</>
            : <><UserCheck className="w-4 h-4 mr-2" />Riattiva</>
          }
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleRemove}>
          Rimuovi dallo staff
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
