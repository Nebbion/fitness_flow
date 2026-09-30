'use client'

import { useRouter } from 'next/navigation'
import { AppointmentModal } from './appointment-modal'
import type { UserRole } from '@/types'

interface NewAppointmentPageProps {
  locale: string
  tenantId: string
  userId: string
  role: UserRole
  staffList: { id: string; full_name: string | null }[]
  services: any[]
  defaultClient: { id: string; full_name: string; email: string | null; phone: string | null } | null
}

export function NewAppointmentPage({
  locale,
  tenantId,
  userId,
  role,
  staffList,
  services,
  defaultClient,
}: NewAppointmentPageProps) {
  const router = useRouter()
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  function close() {
    router.push(`/${locale}/dashboard/appointments`)
  }

  return (
    <AppointmentModal
      open
      onClose={close}
      locale={locale}
      tenantId={tenantId}
      userId={userId}
      role={role}
      staffList={staffList}
      services={services}
      defaultClient={defaultClient}
      defaultSlot={{ start, end }}
      onSaved={close}
    />
  )
}
