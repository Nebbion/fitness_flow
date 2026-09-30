'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { loginSchema, type LoginInput } from '@/schemas'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginFormProps {
  locale: string
  redirectTo?: string
  initialError?: string
}

export function LoginForm({ locale, redirectTo, initialError }: LoginFormProps) {
  const t = useTranslations('auth.login')
  const tErrors = useTranslations('errors')
  const router = useRouter()
  const supabase = createClient()

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  function getFieldError(message: string | undefined, values?: Record<string, number>) {
    if (!message) return ''
    return tErrors(message.replace(/^errors\./, '') as any, values)
  }

  function getAuthErrorMessage(error: unknown) {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
        ? error.message
        : ''

    if (message.toLowerCase().includes('user not found')) {
      return 'Nessun invito trovato per questa email. Chiedi al professionista di invitarti al portale.'
    }

    if (
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('security purposes')
    ) {
      return 'Hai richiesto troppi link in poco tempo. Attendi qualche minuto e riprova.'
    }

    if (message) return message
    return tErrors('serverError')
  }

  function getEmailRedirectUrl() {
    const nextPath = redirectTo ?? `/${locale}`
    return `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(nextPath)}`
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginInput) {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        setError('root', { message: t('error') })
        return
      }

      // Redirect dopo login
      router.push(redirectTo ?? `/${locale}`)
      router.refresh()
    } catch {
      toast.error(tErrors('serverError'))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleMagicLink() {
    const email = getValues('email')?.trim()
    if (!email) {
      setError('email', { message: tErrors('required') })
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
          shouldCreateUser: false,
        },
      })

      if (error) throw error
      toast.success(t('magicLinkSent'))
    } catch (error) {
      const message = getAuthErrorMessage(error)
      setError('root', { message })
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResendConfirmation() {
    const email = getValues('email')?.trim()
    if (!email) {
      setError('email', { message: tErrors('required') })
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
        },
      })

      if (error) throw error
      toast.success(t('confirmationSent'))
    } catch (error) {
      const message = getAuthErrorMessage(error)
      setError('root', { message })
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Errore globale */}
      {(errors.root || initialError) && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.root?.message ?? initialError}
          </p>
        </div>
      )}

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nome@email.com"
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t('password')}</Label>
          <a
            href={`/${locale}/auth/reset-password`}
            className="text-xs text-muted-foreground hover:text-primary"
          >
            {t('forgotPassword')}
          </a>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="pl-10 pr-10"
            disabled={isLoading}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">
            {getFieldError(errors.password.message, { min: 8 })}
          </p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </>
        ) : (
          t('submit')
        )}
      </Button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">oppure</span>
        </div>
      </div>

      {/* Magic Link */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isLoading}
        onClick={handleMagicLink}
      >
        <Mail className="mr-2 h-4 w-4" />
        {t('magicLink')}
      </Button>

      <Button
        type="button"
        variant="link"
        className="w-full"
        disabled={isLoading}
        onClick={handleResendConfirmation}
      >
        {t('resendConfirmation')}
      </Button>
    </form>
  )
}
