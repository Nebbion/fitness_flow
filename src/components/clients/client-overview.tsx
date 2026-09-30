'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { formatDate, calcAge } from '@/lib/utils'
import type { CustomFieldDefinition } from '@/types'

interface ClientOverviewProps {
  client: any
  locale: string
  customFieldDefs: CustomFieldDefinition[]
}

export function ClientOverview({ client, locale, customFieldDefs }: ClientOverviewProps) {
  const t = useTranslations('clients.form')
  const dateLocale = locale === 'it' ? 'it-IT' : 'en-GB'

  const fieldLabel = (field: CustomFieldDefinition) =>
    locale === 'it' ? field.label_it : field.label_en

  const infoRows = [
    { label: t('email'), value: client.email },
    { label: t('phone'), value: client.phone },
    {
      label: t('birthDate'),
      value: client.birth_date
        ? `${formatDate(client.birth_date, dateLocale)} (${calcAge(client.birth_date)} anni)`
        : null,
    },
    {
      label: t('gender'),
      value: client.gender ? t(`genderOptions.${client.gender}` as any) : null,
    },
    {
      label: t('assignedStaff'),
      value: client.assigned_staff?.full_name ?? null,
    },
    {
      label: t('language'),
      value: client.preferred_language === 'it' ? '🇮🇹 Italiano' : '🇬🇧 English',
    },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Info base */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Informazioni
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border">
          {infoRows.map(row => (
            row.value ? (
              <div key={row.label} className="flex justify-between py-3 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium text-right max-w-[60%]">{row.value}</span>
              </div>
            ) : null
          ))}
          {client.notes && (
            <div className="py-3 text-sm space-y-1">
              <span className="text-muted-foreground">{t('notes')}</span>
              <p className="text-foreground bg-muted/50 rounded-lg p-3 mt-1 text-sm leading-relaxed">
                {client.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campi custom */}
      {customFieldDefs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {t('customFields')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border">
            {customFieldDefs.map(field => {
              const value = client.custom_fields?.[field.field_key]
              if (value === null || value === undefined || value === '') return null
              return (
                <div key={field.id} className="flex justify-between py-3 text-sm">
                  <span className="text-muted-foreground">{fieldLabel(field)}</span>
                  <span className="font-medium text-right">
                    {field.field_type === 'checkbox'
                      ? value ? '✓ Sì' : '✗ No'
                      : Array.isArray(value)
                      ? value.join(', ')
                      : String(value)}
                    {field.field_key.endsWith('_kg') ? ' kg' : ''}
                    {field.field_key.endsWith('_cm') ? ' cm' : ''}
                    {field.field_key.endsWith('_pct') ? '%' : ''}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
