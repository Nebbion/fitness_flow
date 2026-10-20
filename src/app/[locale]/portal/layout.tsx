import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Activity, CalendarDays, Dumbbell, ClipboardList, History, LogOut } from 'lucide-react'
import { SessionTimeout } from '@/components/auth/session-timeout'
import { PwaInstallHelp } from '@/components/pwa/pwa-install-help'

interface PortalLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return { manifest: `/${locale}/portal/manifest.webmanifest`, appleWebApp: { capable: true, statusBarStyle: 'default', title: 'FitnessFlow' } }
}

export default async function PortalLayout({ children, params }: PortalLayoutProps) {
  const { locale } = await params
  const supabase = await createClient()
  const t = await getTranslations({ locale, namespace: 'nav' })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'CLIENT') redirect(`/${locale}/dashboard`)

  // Recupera il tenant del cliente (tramite clients)
  const { data: clientRecord } = await supabase
    .from('clients')
    .select('id, full_name, tenants(name, logo_url, brand_primary, profession)')
    .eq('profile_id', user.id)
    .single()

  const tenant = Array.isArray(clientRecord?.tenants)
    ? clientRecord.tenants[0]
    : clientRecord?.tenants

  const portalNav = [
    { href: `/${locale}/portal/training?view=plan`, label: 'Scheda', icon: ClipboardList },
    { href: `/${locale}/portal/training?view=workout`, label: 'Allenamento', icon: Dumbbell },
    { href: `/${locale}/portal/training?view=history`, label: 'Storico', icon: History },
    { href: `/${locale}/portal/appointments`, label: t('appointments'), icon: CalendarDays },
  ]

  return (
    <div className="min-h-screen bg-background">
      <SessionTimeout
        userId={user.id}
        sessionStartedAt={user.last_sign_in_at ?? user.id}
        loginPath={`/${locale}/auth/login`}
        locale={locale}
      />
      {/* Top navigation */}
      <header className="border-b border-border bg-card sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo studio */}
          <div className="flex items-center gap-2">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: tenant?.brand_primary ?? '#2563EB' }}
              >
                <Activity className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="font-semibold text-sm">{tenant?.name ?? 'FitnessFlow'}</span>
          </div>

          {/* Nav links */}
          <nav className="hidden lg:flex items-center gap-1">
            {portalNav.map(item => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile.full_name?.split(' ')[0]}
            </span>
            <PwaInstallHelp compact />
            <form action={`/api/auth/logout?locale=${locale}`} method="POST">
              <button
                type="submit"
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title={t('logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="safe-bottom lg:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-30 print:hidden">
        <div className="grid grid-cols-4">
          {portalNav.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="min-w-0 flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon className="w-5 h-5" />
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 sm:pb-6 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  )
}
