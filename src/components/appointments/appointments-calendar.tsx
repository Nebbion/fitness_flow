'use client'

import { useRef, useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import itLocale from '@fullcalendar/core/locales/it'
import enLocale from '@fullcalendar/core/locales/en-gb'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AppointmentModal } from './appointment-modal'
import type { UserRole } from '@/types'

interface AppointmentsCalendarProps {
  appointments: any[]
  locale: string
  role: UserRole
  userId: string
  tenantId: string
  staffList: { id: string; full_name: string | null }[]
  services: any[]
  initialView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'
  initialDate: string
}

export function AppointmentsCalendar({
  appointments,
  locale,
  role,
  userId,
  tenantId,
  staffList,
  services,
  initialView,
  initialDate,
}: AppointmentsCalendarProps) {
  const router = useRouter()
  const calendarRef = useRef<any>(null)
  const t = useTranslations('appointments')

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)

  // Converti appuntamenti in eventi FullCalendar
  const events = appointments.map(appt => ({
    id: appt.id,
    title: appt.clients?.full_name ?? 'Appuntamento',
    start: appt.start_at,
    end: appt.end_at,
    backgroundColor: appt.services?.color ?? '#2563EB',
    borderColor: appt.services?.color ?? '#2563EB',
    extendedProps: { appointment: appt },
    classNames: appt.status === 'cancelled' ? ['opacity-40 line-through'] : [],
  }))

  // Click su slot vuoto → apri modal per creazione
  const handleDateSelect = useCallback((selectInfo: any) => {
    setSelectedAppointment(null)
    setSelectedSlot({ start: selectInfo.start, end: selectInfo.end })
    setModalOpen(true)
    selectInfo.view.calendar.unselect()
  }, [])

  // Click su evento esistente → apri modal per modifica
  const handleEventClick = useCallback((clickInfo: any) => {
    const appt = clickInfo.event.extendedProps.appointment
    setSelectedSlot(null)
    setSelectedAppointment(appt)
    setModalOpen(true)
  }, [])

  // Drag & drop → aggiorna orario
  const handleEventDrop = useCallback(async (dropInfo: any) => {
    const apptId = dropInfo.event.id
    const newStart = dropInfo.event.start.toISOString()
    const newEnd = dropInfo.event.end?.toISOString() ?? newStart

    try {
      const res = await fetch(`/api/appointments/${apptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_at: newStart, end_at: newEnd }),
      })
      if (!res.ok) throw new Error('Aggiornamento fallito')
      router.refresh()
    } catch {
      toast.error('Impossibile aggiornare l\'appuntamento')
      dropInfo.revert()
    }
  }, [router])

  const viewMap: Record<string, string> = {
    month: 'dayGridMonth',
    week: 'timeGridWeek',
    day: 'timeGridDay',
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <style>{`
          .fc { font-family: inherit; }
          .fc-toolbar-title { font-size: 1rem !important; font-weight: 600; }
          .fc-button { 
            background: transparent !important; 
            border-color: hsl(var(--border)) !important;
            color: hsl(var(--foreground)) !important;
            font-size: 0.8rem !important;
            padding: 4px 10px !important;
            border-radius: 6px !important;
          }
          .fc-button:hover { background: hsl(var(--accent)) !important; }
          .fc-button-active, .fc-button-primary:not(:disabled):active {
            background: hsl(var(--primary)) !important;
            color: white !important;
            border-color: hsl(var(--primary)) !important;
          }
          .fc-toolbar { padding: 12px 16px !important; flex-wrap: wrap; gap: 8px; }
          .fc-col-header-cell-cushion, .fc-daygrid-day-number { 
            color: hsl(var(--foreground)) !important; 
            text-decoration: none !important;
          }
          .fc-day-today { background: hsl(var(--primary) / 0.05) !important; }
          .fc-event { border-radius: 4px !important; font-size: 12px !important; cursor: pointer; }
          .fc-event-title { font-weight: 500 !important; }
          .fc-timegrid-slot { height: 40px !important; }
          .fc-scrollgrid { border-color: hsl(var(--border)) !important; }
          .fc-scrollgrid td, .fc-scrollgrid th { border-color: hsl(var(--border)) !important; }
          .fc-highlight { background: hsl(var(--primary) / 0.1) !important; }
        `}</style>

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={viewMap[initialView] ?? 'timeGridWeek'}
          initialDate={initialDate}
          locale={locale === 'it' ? itLocale : enLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          selectable={role !== 'CLIENT'}
          selectMirror={true}
          editable={role !== 'CLIENT'}
          eventDrop={handleEventDrop}
          select={handleDateSelect}
          eventClick={handleEventClick}
          allDaySlot={false}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          height="calc(100vh - 200px)"
          nowIndicator={true}
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5, 6],
            startTime: '08:00',
            endTime: '20:00',
          }}
          eventContent={(arg) => (
            <div className="px-1 py-0.5 overflow-hidden">
              <div className="font-medium truncate text-white" style={{ fontSize: '11px' }}>
                {arg.event.title}
              </div>
              {arg.event.extendedProps.appointment?.services?.name && (
                <div className="truncate text-white/80" style={{ fontSize: '10px' }}>
                  {arg.event.extendedProps.appointment.services.name}
                </div>
              )}
            </div>
          )}
        />
      </div>

      {/* Modal creazione/modifica */}
      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedAppointment(null); setSelectedSlot(null) }}
        locale={locale}
        tenantId={tenantId}
        userId={userId}
        role={role}
        staffList={staffList}
        services={services}
        appointment={selectedAppointment}
        defaultSlot={selectedSlot}
        onSaved={() => { setModalOpen(false); router.refresh() }}
      />
    </>
  )
}
