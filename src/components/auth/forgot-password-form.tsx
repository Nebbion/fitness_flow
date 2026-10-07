'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ForgotPasswordForm({ locale, initialError }: { locale: string; initialError?: string }) {
  const t = useTranslations('auth.passwordRecovery')
  const tErrors = useTranslations('errors')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [requestError, setRequestError] = useState(initialError ?? '')
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function onSubmit(values: ForgotPasswordInput) {
    setLoading(true)
    setRequestError('')
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(`/${locale}/auth/reset-password`)}`
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, { redirectTo })
      if (error) throw error
      // The same response is shown whether or not the address exists.
      setSent(true)
    } catch (caught: any) {
      const message = String(caught?.message ?? '')
      setRequestError(message.toLowerCase().includes('rate limit')
        ? (locale === 'it' ? 'Troppe richieste. Attendi qualche minuto e riprova.' : 'Too many requests. Wait a few minutes and try again.')
        : tErrors('serverError'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) return <div className="space-y-6 text-center">
    <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
    <div><h1 className="text-xl font-semibold">{t('sentTitle')}</h1><p className="mt-2 text-sm text-muted-foreground">{t('sentMessage')}</p></div>
    <Button asChild variant="outline" className="w-full"><Link href={`/${locale}/auth/login`}><ArrowLeft />{t('backToLogin')}</Link></Button>
  </div>

  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
    {requestError && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{requestError}</div>}
    <div className="space-y-2"><Label htmlFor="recovery-email">{t('email')}</Label>
      <div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="recovery-email" type="email" autoComplete="email" className="pl-10" disabled={loading} {...register('email')} />
      </div>
      {errors.email && <p className="text-xs text-destructive">{tErrors(errors.email.message?.replace('errors.', '') as any)}</p>}
    </div>
    <Button type="submit" className="w-full" disabled={loading}>
      {loading ? <><Loader2 className="animate-spin" />{t('sending')}</> : <><Mail />{t('send')}</>}
    </Button>
    <Button asChild variant="link" className="w-full"><Link href={`/${locale}/auth/login`}><ArrowLeft />{t('backToLogin')}</Link></Button>
  </form>
}
