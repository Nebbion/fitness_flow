'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calendar, Dumbbell, FileText, Share2, TrendingUp, User, Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClientOverview } from './client-overview'
import { ClientAppointmentsList } from './client-appointments-list'
import { ClientDocumentsList } from './client-documents-list'
import { ClientProgressPanel } from './client-progress-panel'
import { TrainingPlanPanel } from '@/components/training/training-plan-panel'
import { NutritionPlanPanel } from '@/components/nutrition/nutrition-plan-panel'
import { SharedClientDataPanel } from './shared-client-data-panel'
import type { CustomFieldDefinition, UserRole } from '@/types'
import type { PracticeModule } from '@/lib/practice-modules'

interface ClientTabsProps {
  client: any
  locale: string
  role: UserRole
  tenantId: string
  userId: string
  profession: string
  enabledModules: PracticeModule[]
  tenant: { name: string; logo_url?: string | null }
  initialTab?: string
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
  profession,
  enabledModules,
  tenant,
  initialTab,
  customFieldDefs,
  counts,
}: ClientTabsProps) {
  const t = useTranslations('clients.detail')
  const supportsTraining = enabledModules.includes('training')
  const supportsNutrition = enabledModules.includes('nutrition')
  const allowedInitialTabs = ['overview', 'appointments', 'documents', 'progress', 'shared', supportsTraining && 'training', supportsNutrition && 'nutrition'].filter(Boolean)
  const [activeTab, setActiveTab] = useState(allowedInitialTabs.includes(initialTab ?? '') ? initialTab! : 'overview')

  const tabs = [
    { key: 'overview',      label: t('overview'),      icon: User,      count: null },
    { key: 'appointments',  label: t('appointments'),  icon: Calendar,  count: counts.appointments },
    { key: 'documents',     label: t('documents'),     icon: FileText,  count: counts.documents },
    { key: 'progress',      label: t('progress'),      icon: TrendingUp,count: counts.progress },
    ...(supportsTraining ? [{ key: 'training', label: 'Allenamento', icon: Dumbbell, count: null }] : []),
    ...(supportsNutrition ? [{ key: 'nutrition', label: 'Alimentazione', icon: Utensils, count: null }] : []),
    { key: 'shared', label: 'Condivisi', icon: Share2, count: null },
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
        {activeTab === 'training' && <TrainingPlanPanel clientId={client.id} locale={locale} />}
        {activeTab === 'nutrition' && <NutritionPlanPanel clientId={client.id} clientName={client.full_name} tenant={tenant} />}
        {activeTab === 'shared' && <SharedClientDataPanel clientId={client.id} />}
      </div>
    </div>
  )
}
