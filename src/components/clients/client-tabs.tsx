'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calendar, FileText, TrendingUp, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClientOverview } from './client-overview'
import { ClientAppointmentsList } from './client-appointments-list'
import { ClientDocumentsList } from './client-documents-list'
import { ClientProgressPanel } from './client-progress-panel'
import type { CustomFieldDefinition, UserRole } from '@/types'

interface ClientTabsProps {
  client: any
  locale: string
  role: UserRole
  tenantId: string
  userId: string
  customFieldDefs: CustomFieldDefinition[]
  counts: {
    appointments: number
    documents: number
    progress: number
  }
}

export function ClientTabs({
  client,
  locale,
  role,
  tenantId,
  userId,
  customFieldDefs,
  counts,
}: ClientTabsProps) {
  const t = useTranslations('clients.detail')
  const [activeTab, setActiveTab] = useState('overview')

  const tabs = [
    { key: 'overview',      label: t('overview'),      icon: User,      count: null },
    { key: 'appointments',  label: t('appointments'),  icon: Calendar,  count: counts.appointments },
    { key: 'documents',     label: t('documents'),     icon: FileText,  count: counts.documents },
    { key: 'progress',      label: t('progress'),      icon: TrendingUp,count: counts.progress },
  ]

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full font-medium',
                  activeTab === tab.key
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'overview' && (
          <ClientOverview
            client={client}
            locale={locale}
            customFieldDefs={customFieldDefs}
          />
        )}
        {activeTab === 'appointments' && (
          <ClientAppointmentsList
            clientId={client.id}
            locale={locale}
            role={role}
            tenantId={tenantId}
          />
        )}
        {activeTab === 'documents' && (
          <ClientDocumentsList
            clientId={client.id}
            locale={locale}
            role={role}
            tenantId={tenantId}
          />
        )}
        {activeTab === 'progress' && (
          <ClientProgressPanel
            clientId={client.id}
            locale={locale}
            role={role}
            tenantId={tenantId}
          />
        )}
      </div>
    </div>
  )
}
