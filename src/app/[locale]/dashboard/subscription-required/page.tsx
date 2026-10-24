import { CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function SubscriptionRequiredPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }

  return (
    <div className="mx-auto max-w-xl rounded-xl border bg-card p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
        <CreditCard className="h-5 w-5 text-amber-600" />
      </span>
      <h1 className="mt-4 text-xl font-semibold">Abbonamento non attivo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Il periodo di prova o l’abbonamento dello studio è terminato. Contatta il titolare dello studio per riattivare FitnessFlow.
      </p>
      {profile?.role === 'TENANT_ADMIN' && (
        <a className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href="./billing">
          Scegli un piano
        </a>
      )}
    </div>
  )
}
