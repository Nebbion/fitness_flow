'use client'

import { useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Check, Building2, Stethoscope, Palette, CreditCard } from 'lucide-react'
import { onboardingSchema, type OnboardingInput } from '@/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ProfessionType } from '@/types'

interface OnboardingWizardProps {
  locale: string
  userId: string
  userEmail: string
}

const PROFESSIONS: { value: ProfessionType; icon: string; color: string }[] = [
  { value: 'nutritionist',     icon: '🥗', color: 'border-green-400 bg-green-50 dark:bg-green-950/20' },
  { value: 'personal_trainer', icon: '💪', color: 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' },
  { value: 'physiotherapist',  icon: '🦴', color: 'border-purple-400 bg-purple-50 dark:bg-purple-950/20' },
  { value: 'osteopath',        icon: '🙌', color: 'border-orange-400 bg-orange-50 dark:bg-orange-950/20' },
  { value: 'massage_therapist',icon: '💆', color: 'border-pink-400 bg-pink-50 dark:bg-pink-950/20' },
  { value: 'other',            icon: '⭐', color: 'border-slate-400 bg-slate-50 dark:bg-slate-950/20' },
]

const STEPS = [
  { id: 1, icon: Building2,   key: 'step1' },
  { id: 2, icon: Stethoscope, key: 'step2' },
  { id: 3, icon: Palette,     key: 'step3' },
]

export function OnboardingWizard({ locale, userId, userEmail }: OnboardingWizardProps) {
  const t = useTranslations('auth.onboarding')
  const tErrors = useTranslations('errors')
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProfession, setSelectedProfession] = useState<ProfessionType | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      brand_primary: '#2563EB',
      brand_accent: '#06B6D4',
      locale: locale as 'it' | 'en',
      timezone: 'Europe/Rome',
    },
  })

  const companyName = watch('company_name') ?? ''
  const brandPrimary = watch('brand_primary') ?? '#2563EB'
  const brandAccent = watch('brand_accent') ?? '#06B6D4'

  // Auto-genera slug dal nome azienda
  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .substring(0, 40)
  }

  async function goToNext() {
    let fieldsToValidate: (keyof OnboardingInput)[] = []
    if (currentStep === 1) fieldsToValidate = ['company_name', 'slug']
    if (currentStep === 2) fieldsToValidate = ['profession']

    const valid = await trigger(fieldsToValidate)
    if (valid) setCurrentStep(s => s + 1)
  }

  async function onSubmit(data: OnboardingInput) {
    if (!selectedProfession) {
      toast.error('Seleziona una professione')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, profession: selectedProfession }),
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type') ?? ''
        const body = contentType.includes('application/json')
          ? await response.json()
          : null
        throw new Error(body?.error ?? 'Errore durante la configurazione')
      }

      toast.success('Studio configurato con successo!')
      router.push(`/${locale}/dashboard`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? tErrors('serverError'))
    } finally {
      setIsLoading(false)
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter

    // The wizard must only create a tenant when the explicit final action is used.
    if (submitter?.getAttribute('data-onboarding-submit') !== 'true') {
      event.preventDefault()
      return
    }

    void handleSubmit(onSubmit)(event)
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-black/20 border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Step indicator */}
      <div className="flex border-b border-border">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          const isActive = currentStep === step.id
          const isDone = currentStep > step.id
          return (
            <div
              key={step.id}
              className={cn(
                'flex-1 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors',
                isActive && 'text-primary border-b-2 border-primary',
                isDone && 'text-muted-foreground',
                !isActive && !isDone && 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                isDone ? 'bg-primary text-white' : isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {isDone ? <Check className="w-3 h-3" /> : <span>{step.id}</span>}
              </div>
              <span className="hidden sm:block">{t(`${step.key}.title`)}</span>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleFormSubmit} className="p-8">

        {/* STEP 1 — Dati aziendali */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-semibold">{t('step1.title')}</h2>
              <p className="text-muted-foreground text-sm mt-1">{t('step1.subtitle')}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('step1.companyName')}</Label>
              <Input
                placeholder={t('step1.companyNamePlaceholder')}
                {...register('company_name')}
                onChange={e => {
                  register('company_name').onChange(e)
                  setValue('slug', generateSlug(e.target.value))
                }}
              />
              {errors.company_name && (
                <p className="text-xs text-destructive">{errors.company_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('step1.slug')}</Label>
              <div className="flex items-center gap-0">
                <div className="bg-muted px-3 py-2 rounded-l-md border border-r-0 border-input text-sm text-muted-foreground whitespace-nowrap">
                  fitnessflow.app/
                </div>
                <Input
                  className="rounded-l-none"
                  {...register('slug')}
                />
              </div>
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug.message}</p>
              )}
              <p className="text-xs text-muted-foreground">{t('step1.slugHelp', { slug: watch('slug') ?? '' })}</p>
            </div>
          </div>
        )}

        {/* STEP 2 — Professione */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-semibold">{t('step2.title')}</h2>
              <p className="text-muted-foreground text-sm mt-1">{t('step2.subtitle')}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PROFESSIONS.map(prof => (
                <button
                  key={prof.value}
                  type="button"
                  onClick={() => {
                    setSelectedProfession(prof.value)
                    setValue('profession', prof.value)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                    selectedProfession === prof.value
                      ? prof.color + ' border-current'
                      : 'border-border hover:border-muted-foreground/50 bg-background'
                  )}
                >
                  <span className="text-3xl">{prof.icon}</span>
                  <span className="text-xs font-medium text-foreground">
                    {t(`step2.professions.${prof.value}`)}
                  </span>
                </button>
              ))}
            </div>
            {errors.profession && (
              <p className="text-xs text-destructive">Seleziona una professione</p>
            )}
          </div>
        )}

        {/* STEP 3 — Colori brand */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-semibold">{t('step3.title')}</h2>
              <p className="text-muted-foreground text-sm mt-1">{t('step3.subtitle')}</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{t('step3.primaryColor')}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-12 h-10 rounded-lg border border-input cursor-pointer"
                    value={brandPrimary}
                    onChange={event => setValue('brand_primary', event.target.value, { shouldDirty: true })}
                  />
                  <Input
                    className="font-mono uppercase"
                    value={brandPrimary}
                    onChange={event => setValue('brand_primary', event.target.value, { shouldDirty: true })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('step3.accentColor')}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-12 h-10 rounded-lg border border-input cursor-pointer"
                    value={brandAccent}
                    onChange={event => setValue('brand_accent', event.target.value, { shouldDirty: true })}
                  />
                  <Input
                    className="font-mono uppercase"
                    value={brandAccent}
                    onChange={event => setValue('brand_accent', event.target.value, { shouldDirty: true })}
                  />
                </div>
              </div>
            </div>

            {/* Anteprima */}
            <div
              className="rounded-xl p-6 text-white"
              style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandAccent})` }}
            >
              <div className="font-semibold text-lg">{companyName || 'Il tuo Studio'}</div>
              <div className="text-sm opacity-80 mt-1">Anteprima brand</div>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              {t('step4.trialNote')}
            </p>
          </div>
        )}

        {/* Navigazione */}
        <div className="flex justify-between mt-8 pt-6 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={currentStep === 1 || isLoading}
          >
            ← Indietro
          </Button>

          {currentStep < STEPS.length ? (
            <Button type="button" onClick={goToNext}>
              Avanti →
            </Button>
          ) : (
            <Button type="submit" data-onboarding-submit="true" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Configurazione...
                </>
              ) : (
                t('complete')
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
