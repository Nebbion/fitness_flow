'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'
import { createClientSchema, type CreateClientInput } from '@/schemas'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent, CardHeader, CardTitle, Separator } from '@/components/ui/index'
import type { CustomFieldDefinition } from '@/types'

interface ClientFormProps {
  locale: string
  tenantId: string
  staffList: { id: string; full_name: string | null }[]
  customFields: CustomFieldDefinition[]
  defaultStaffId?: string
  // Per modifica
  clientId?: string
  defaultValues?: Partial<CreateClientInput>
}

export function ClientForm({
  locale,
  tenantId,
  staffList,
  customFields,
  defaultStaffId,
  clientId,
  defaultValues,
}: ClientFormProps) {
  const t = useTranslations('clients.form')
  const tErrors = useTranslations('errors')
  const router = useRouter()

  const isEditing = !!clientId
  const [isLoading, setIsLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(defaultValues?.tags ?? [])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      assigned_staff_id: defaultStaffId ?? '',
      preferred_language: locale as 'it' | 'en',
      tags: [],
      custom_fields: {},
      ...defaultValues,
    },
  })

  function addTag() {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      const newTags = [...tags, trimmed]
      setTags(newTags)
      setValue('tags', newTags)
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    const newTags = tags.filter(t => t !== tag)
    setTags(newTags)
    setValue('tags', newTags)
  }

  async function onSubmit(data: CreateClientInput) {
    setIsLoading(true)
    try {
      const url = isEditing
        ? `/api/clients/${clientId}`
        : '/api/clients'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tags }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error ?? 'Errore')
      }

      const result = await response.json()
      toast.success(isEditing
        ? 'Cliente aggiornato con successo'
        : 'Cliente creato con successo'
      )
      router.push(`/${locale}/dashboard/clients/${result.id ?? clientId}`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? tErrors('serverError'))
    } finally {
      setIsLoading(false)
    }
  }

  const fieldLabel = (field: CustomFieldDefinition) =>
    locale === 'it' ? field.label_it : field.label_en

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Dati anagrafici */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="sm:col-span-2 space-y-2">
              <Label>{t('fullName')} *</Label>
              <Input placeholder={t('fullNamePlaceholder')} {...register('full_name')} />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label>{t('email')}</Label>
              <Input type="email" placeholder={t('emailPlaceholder')} {...register('email')} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Telefono */}
            <div className="space-y-2">
              <Label>{t('phone')}</Label>
              <Input type="tel" placeholder={t('phonePlaceholder')} {...register('phone')} />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>

            {/* Data di nascita */}
            <div className="space-y-2">
              <Label>{t('birthDate')}</Label>
              <Input type="date" {...register('birth_date')} />
            </div>

            {/* Sesso */}
            <div className="space-y-2">
              <Label>{t('gender')}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('gender')}
              >
                <option value="">—</option>
                <option value="male">{t('genderOptions.male')}</option>
                <option value="female">{t('genderOptions.female')}</option>
                <option value="other">{t('genderOptions.other')}</option>
                <option value="not_specified">{t('genderOptions.not_specified')}</option>
              </select>
            </div>

            {/* Lingua preferita */}
            <div className="space-y-2">
              <Label>{t('language')}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('preferred_language')}
              >
                <option value="it">🇮🇹 Italiano</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>

            {/* Staff assegnato */}
            {staffList.length > 0 && (
              <div className="space-y-2">
                <Label>{t('assignedStaff')}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('assigned_staff_id')}
                >
                  <option value="">Nessuno</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <textarea
              placeholder={t('notesPlaceholder')}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              {...register('notes')}
            />
          </div>

          <label className="flex items-start gap-3 rounded-md border border-border p-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" {...register('whatsapp_reminders_consent')} />
            <span>
              <span className="block text-sm font-medium">Consenso promemoria WhatsApp</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Attiva solo dopo aver raccolto il consenso del cliente a ricevere promemoria sul suo numero.
              </span>
            </span>
          </label>

          {/* Tag */}
          <div className="space-y-2">
            <Label>{t('tags')}</Label>
            <div className="flex gap-2">
              <Input
                placeholder={t('tagsPlaceholder')}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Campi custom */}
      {customFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('customFields')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customFields.map(field => (
                <div key={field.id} className="space-y-2">
                  <Label>
                    {fieldLabel(field)}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Controller
                    name={`custom_fields.${field.field_key}` as any}
                    control={control}
                    render={({ field: formField }) => {
                      switch (field.field_type) {
                        case 'text':
                        case 'number':
                          return (
                            <Input
                              type={field.field_type}
                              {...formField}
                              value={formField.value ?? ''}
                            />
                          )
                        case 'textarea':
                          return (
                            <textarea
                              rows={2}
                              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                              {...formField}
                              value={formField.value ?? ''}
                            />
                          )
                        case 'date':
                          return <Input type="date" {...formField} value={formField.value ?? ''} />
                        case 'checkbox':
                          return (
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={field.field_key}
                                checked={!!formField.value}
                                onChange={e => formField.onChange(e.target.checked)}
                                className="rounded border-input"
                              />
                              <label htmlFor={field.field_key} className="text-sm">{fieldLabel(field)}</label>
                            </div>
                          )
                        case 'select':
                          return (
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              {...formField}
                              value={formField.value ?? ''}
                            >
                              <option value="">—</option>
                              {field.options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )
                        case 'multi_select':
                          return (
                            <select
                              multiple
                              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              {...formField}
                              value={formField.value ?? []}
                              onChange={e => {
                                const selected = Array.from(e.target.selectedOptions).map(o => o.value)
                                formField.onChange(selected)
                              }}
                            >
                              {field.options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )
                        default:
                          return <Input {...formField} value={formField.value ?? ''} />
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Annulla
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Salva modifiche' : 'Crea cliente'}
        </Button>
      </div>
    </form>
  )
}
