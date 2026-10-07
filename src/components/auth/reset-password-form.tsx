'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema, type ResetPasswordInput } from '@/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ResetPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations('auth.passwordRecovery')
  const tErrors = useTranslations('errors')
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [validSession, setValidSession] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [requestError, setRequestError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setValidSession(Boolean(data.user))
      setChecking(false)
    })
  }, [])

  async function onSubmit(values: ResetPasswordInput) {
    setLoading(true)
    setRequestError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: values.password })
      if (error) throw error
      await supabase.auth.signOut()
      router.replace(`/${locale}/auth/login?reset=success`)
      router.refresh()
    } catch (caught: any) {
      setRequestError(caught?.message ?? tErrors('serverError'))
      setLoading(false)
    }
  }

  if (checking) return <div className="grid h-32 place-items-center"><Loader2 className="animate-spin text-primary" /></div>
  if (!validSession) return <div className="space-y-5 text-center">
    <p className="text-sm text-muted-foreground">{t('invalidLink')}</p>
    <Button asChild className="w-full"><Link href={`/${locale}/auth/forgot-password`}>{t('requestNewLink')}</Link></Button>
  </div>

  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
    {requestError && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{requestError}</div>}
    <div className="space-y-2"><Label htmlFor="new-password">{t('password')}</Label>
      <div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="pl-10 pr-10" disabled={loading} {...register('password')} />
        <button type="button" aria-label={showPassword ? 'Nascondi password' : 'Mostra password'} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {showPassword ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {errors.password && <p className="text-xs text-destructive">{tErrors(errors.password.message?.replace('errors.', '') as any, { min: 8, max: 72 })}</p>}
    </div>
    <div className="space-y-2"><Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
      <Input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" disabled={loading} {...register('password_confirm')} />
      {errors.password_confirm && <p className="text-xs text-destructive">{tErrors(errors.password_confirm.message?.replace('errors.', '') as any)}</p>}
    </div>
    <Button type="submit" className="w-full" disabled={loading}>
      {loading ? <><Loader2 className="animate-spin" />{t('updating')}</> : t('update')}
    </Button>
  </form>
}
