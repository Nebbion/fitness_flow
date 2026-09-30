'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { registerSchema, type RegisterInput } from '@/schemas'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RegisterFormProps {
  locale: string
}

export function RegisterForm({ locale }: RegisterFormProps) {
  const t = useTranslations('auth.register')
  const tErrors = useTranslations('errors')
  const router = useRouter()
  const supabase = createClient()

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [registered, setRegistered] = useState(false)

  function getFieldError(message: string | undefined, values?: Record<string, number>) {
    if (!message) return ''
    return tErrors(message.replace(/^errors\./, '') as any, values)
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterInput) {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            preferred_language: locale,
          },
          emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
        },
      })

      if (error) {
        console.error('Supabase sign-up error:', {
          code: error.code,
          message: error.message,
          status: error.status,
        })

        if (error.message.includes('already registered')) {
          setError('email', { message: tErrors('emailAlreadyUsed') })
        } else {
          setError('root', {
            message: getRegistrationErrorMessage(error, tErrors('serverError')),
          })
        }
        return
      }

      setRegistered(true)
    } catch {
      toast.error(tErrors('serverError'))
    } finally {
      setIsLoading(false)
    }
  }

  if (registered) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Account creato!</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('success')}</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{errors.root.message}</p>
        </div>
      )}

      {/* Nome */}
      <div className="space-y-2">
        <Label htmlFor="full_name">{t('fullName')}</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="full_name"
            type="text"
            autoComplete="name"
            placeholder="Mario Rossi"
            className="pl-10"
            disabled={isLoading}
            {...register('full_name')}
          />
        </div>
        {errors.full_name && (
          <p className="text-xs text-destructive">
            {getFieldError(errors.full_name.message, { min: 2 })}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="mario@email.com"
            className="pl-10"
            disabled={isLoading}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive">{getFieldError(errors.email.message)}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="pl-10 pr-10"
            disabled={isLoading}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">
            {getFieldError(errors.password.message, { min: 8, max: 72 })}
          </p>
        )}
      </div>

      {/* Conferma password */}
      <div className="space-y-2">
        <Label htmlFor="password_confirm">{t('passwordConfirm')}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password_confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="pl-10"
            disabled={isLoading}
            {...register('password_confirm')}
          />
        </div>
        {errors.password_confirm && (
          <p className="text-xs text-destructive">{getFieldError(errors.password_confirm.message)}</p>
        )}
      </div>

      <Button type="submit" className="w-full mt-2" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </>
        ) : (
          t('submit')
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Registrandoti accetti i nostri{' '}
        <a href="/termini" className="underline hover:text-foreground">Termini di Servizio</a>{' '}
        e la{' '}
        <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>
      </p>
    </form>
  )
}

function getRegistrationErrorMessage(
  error: { code?: string; message?: string; status?: number },
  fallback: string
) {
  const message = typeof error.message === 'string' ? error.message : ''
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('signup is disabled')) {
    return 'Le nuove registrazioni non sono abilitate in Supabase.'
  }

  if (normalizedMessage.includes('invalid api key')) {
    return 'La chiave pubblica di Supabase non e valida. Verifica NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  }

  if (normalizedMessage.includes('captcha')) {
    return 'La verifica anti-bot di Supabase e attiva ma non configurata.'
  }

  if (error.status === 500 || error.code === 'unexpected_failure') {
    return 'Supabase non riesce a creare il profilo. Verifica che tutte le migration siano state applicate e controlla Authentication > Logs.'
  }

  return message || fallback
}
