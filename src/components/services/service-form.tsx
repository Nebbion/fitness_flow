'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'
import { createServiceSchema, type CreateServiceInput } from '@/schemas'
import { Button } from '@/components/ui/button'
import { Input, Label, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'

interface ServiceFormProps {
  locale: string
  tenantId: string
  service?: any
  trigger: React.ReactNode
}

const PRESET_COLORS = [
  '#2563EB', '#06B6D4', '#22C55E', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#F97316',
  '#14B8A6', '#6366F1', '#84CC16', '#64748B',
]

export function ServiceForm({ locale, tenantId, service, trigger }: ServiceFormProps) {
  const t = useTranslations('services')
  const router = useRouter()
  const isEditing = !!service
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CreateServiceInput>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: service ? {
      name: service.name,
      description: service.description ?? '',
      duration_min: service.duration_min,
      price: service.price ?? undefined,
      currency: service.currency ?? 'EUR',
      color: service.color ?? '#2563EB',
      active: service.active ?? true,
    } : {
      duration_min: 60,
      currency: 'EUR',
      color: '#2563EB',
      active: true,
    },
  })

  const selectedColor = watch('color')

  async function onSubmit(data: CreateServiceInput) {
    setLoading(true)
    try {
      const url = isEditing ? `/api/services/${service.id}` : '/api/services'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error((await res.json()).error)

      toast.success(isEditing ? t('updateSuccess') : t('createSuccess'))
      setOpen(false)
      if (!isEditing) reset()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return <div onClick={() => setOpen(true)}>{trigger}</div>
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {isEditing ? 'Modifica servizio' : t('newService')}
          </CardTitle>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('form.name')} *</Label>
            <Input placeholder={t('form.namePlaceholder')} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('form.description')}</Label>
            <textarea
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('form.duration')}</Label>
              <Input
                type="number"
                min="5"
                step="5"
                {...register('duration_min', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('form.price')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...register('price', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Colore */}
          <div className="space-y-2">
            <Label>{t('form.color')}</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('color', color)}
                  className={`w-7 h-7 rounded-full transition-transform ${selectedColor === color ? 'scale-125 ring-2 ring-offset-2 ring-current' : ''}`}
                  style={{ background: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Attivo */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              className="rounded border-input"
              {...register('active')}
            />
            <Label htmlFor="active">{t('form.active')}</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {isEditing ? 'Salva' : 'Crea servizio'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
