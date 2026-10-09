import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Activity, ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ error?: string }>
}

export const metadata: Metadata = {
  title: 'Accesso Super Admin',
  robots: { index: false, follow: false },
}

export default async function SuperAdminLoginPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { error } = await searchParams
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    redirect(profile?.role === 'SUPER_ADMIN' ? `/${locale}/admin` : `/${locale}/dashboard`)
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 grid lg:grid-cols-[minmax(20rem,0.8fr)_minmax(28rem,1.2fr)]">
      <section className="hidden lg:flex border-r border-zinc-800 p-10 xl:p-14 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-red-600 grid place-items-center"><Activity className="h-5 w-5" /></div>
          <div><p className="font-semibold">FitnessFlow</p><p className="text-xs text-zinc-500">Platform Control</p></div>
        </div>

        <div className="max-w-md">
          <ShieldCheck className="h-9 w-9 text-red-500" />
          <h1 className="mt-5 text-3xl font-semibold">Controllo centrale</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">Accesso riservato alla gestione globale di professionisti, piani e utilizzo della piattaforma.</p>
          <div className="mt-8 border-l-2 border-red-600 pl-4 text-xs leading-5 text-zinc-500">
            Le attività amministrative sono separate dagli ambienti dei singoli professionisti.
          </div>
        </div>

        <p className="text-xs text-zinc-600">Ambiente amministrativo riservato</p>
      </section>

      <section className="min-h-screen flex items-center justify-center p-5 sm:p-8 bg-[#f5f6f8] text-zinc-950">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-9 w-9 rounded-md bg-red-600 text-white grid place-items-center"><Activity className="h-5 w-5" /></div>
            <div><p className="font-semibold">FitnessFlow</p><p className="text-xs text-zinc-500">Platform Control</p></div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
            <LockKeyhole className="h-4 w-4" /> ACCESSO RISERVATO
          </div>
          <h2 className="mt-3 text-2xl font-semibold">Super Admin</h2>
          <p className="mt-2 text-sm text-zinc-500">Inserisci le credenziali dell’amministratore della piattaforma.</p>

          <div className="mt-7 border-y border-zinc-200 py-7">
            <LoginForm
              locale={locale}
              redirectTo={`/${locale}/admin`}
              initialError={error}
              requiredRole="SUPER_ADMIN"
              accent="admin"
            />
          </div>

          <Link href={`/${locale}/auth/login`} className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" /> Accesso professionisti e clienti
          </Link>
        </div>
      </section>
    </main>
  )
}
