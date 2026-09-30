'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Building2, Bell, Sliders } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import type { CustomFieldDefinition } from '@/types'

interface SettingsTabsProps {
  locale: string
  tenant: any
  customFields: CustomFieldDefinition[]
  notifRules: any[]
}

const TABS = [
  { key: 'company',      label: 'Azienda',     icon: Building2 },
  { key: 'notifications',label: 'Notifiche',   icon: Bell },
  { key: 'customFields', label: 'Campi custom',icon: Sliders },
]

export function SettingsTabs({ locale, tenant, customFields, notifRules }: SettingsTabsProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('company')
  const [saving, setSaving] = useState(false)

  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: tenant?.name ?? '',
    brand_primary: tenant?.brand_primary ?? '#2563EB',
    brand_accent: tenant?.brand_accent ?? '#06B6D4',
    timezone: tenant?.timezone ?? 'Europe/Rome',
    locale: tenant?.locale ?? 'it',
  })

  async function saveCompany() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Impostazioni salvate')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleNotifRule(ruleId: string, active: boolean) {
    await fetch(`/api/settings/notifications/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    router.refresh()
  }

  const TRIGGER_LABELS: Record<string, string> = {
    appointment_created: 'Appuntamento creato',
    appointment_reminder: 'Reminder appuntamento',
    appointment_completed: 'Appuntamento completato',
    client_inactive: 'Cliente inattivo (30gg)',
  }

  const CHANNEL_LABELS: Record<string, string> = {
    whatsapp: '💬 WhatsApp',
    email: '📧 Email',
    both: '💬📧 Entrambi',
  }

  const DELAY_LABELS: Record<number, string> = {
    0: 'Subito',
    [-1440]: '24h prima',
    [-120]: '2h prima',
    4320: '3gg dopo',
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Company */}
      {activeTab === 'company' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Dati aziendali</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome studio</Label>
              <Input
                value={companyForm.name}
                onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Colore primario</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={companyForm.brand_primary}
                    onChange={e => setCompanyForm(f => ({ ...f, brand_primary: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-input cursor-pointer"
                  />
                  <Input
                    value={companyForm.brand_primary}
                    onChange={e => setCompanyForm(f => ({ ...f, brand_primary: e.target.value }))}
                    className="font-mono uppercase"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Colore accento</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={companyForm.brand_accent}
                    onChange={e => setCompanyForm(f => ({ ...f, brand_accent: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-input cursor-pointer"
                  />
                  <Input
                    value={companyForm.brand_accent}
                    onChange={e => setCompanyForm(f => ({ ...f, brand_accent: e.target.value }))}
                    className="font-mono uppercase"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fuso orario</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={companyForm.timezone}
                  onChange={e => setCompanyForm(f => ({ ...f, timezone: e.target.value }))}
                >
                  <option value="Europe/Rome">Europa/Roma (CET)</option>
                  <option value="Europe/London">Europa/Londra (GMT)</option>
                  <option value="America/New_York">America/New York (EST)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Lingua predefinita</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={companyForm.locale}
                  onChange={e => setCompanyForm(f => ({ ...f, locale: e.target.value }))}
                >
                  <option value="it">🇮🇹 Italiano</option>
                  <option value="en">🇬🇧 English</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={saveCompany} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salva impostazioni
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Regole notifiche automatiche</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {notifRules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium">{TRIGGER_LABELS[rule.event_trigger] ?? rule.event_trigger}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {CHANNEL_LABELS[rule.channel] ?? rule.channel}
                    {rule.delay_minutes !== 0 && ` · ${DELAY_LABELS[rule.delay_minutes] ?? `${rule.delay_minutes} min`}`}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={rule.active}
                    onChange={e => toggleNotifRule(rule.id, e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-muted peer-checked:bg-primary rounded-full peer transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
            ))}
            {notifRules.length === 0 && (
              <p className="px-6 py-4 text-sm text-muted-foreground">Nessuna regola configurata</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Custom Fields */}
      {activeTab === 'customFields' && (
        <div className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Campi personalizzati clienti</CardTitle></CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {customFields.map(field => (
                <div key={field.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{field.label_it}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {field.field_type} · chiave: <code className="bg-muted px-1 rounded">{field.field_key}</code>
                      {field.required && ' · obbligatorio'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      await fetch(`/api/settings/custom-fields/${field.id}`, { method: 'DELETE' })
                      router.refresh()
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {customFields.length === 0 && (
                <p className="px-6 py-4 text-sm text-muted-foreground">Nessun campo personalizzato</p>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground text-center">
            I campi personalizzati vengono generati automaticamente in base alla professione selezionata durante l'onboarding.
          </p>
        </div>
      )}
    </div>
  )
}
