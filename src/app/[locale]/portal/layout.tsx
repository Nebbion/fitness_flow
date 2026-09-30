import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Activity, Calendar, FileText, TrendingUp, LogOut, Globe } from 'lucide-react'

interface PortalLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function PortalLayout({ children, params }: PortalLayoutProps) {
  const { locale } = await params
  const supabase = await createClient()
  const t = await getTranslations({ locale, namespace: 'nav' })
  const tPortal = await getTranslations({ locale, namespace: 'portal' })

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
    .select('id, full_name, tenants(name, logo_url, brand_primary)')
    .eq('profile_id', user.id)
    .single()

  const tenant = Array.isArray(clientRecord?.tenants)
    ? clientRecord.tenants[0]
    : clientRecord?.tenants

  const portalNav = [
    { href: `/${locale}/portal`, label: 'Dashboard', icon: Activity, exact: true },
    { href: `/${locale}/portal/appointments`, label: t('appointments'), icon: Calendar },
    { href: `/${locale}/portal/documents`, label: t('documents'), icon: FileText },
    { href: `/${locale}/portal/progress`, label: 'Progressi', icon: TrendingUp },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
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
          <nav className="hidden sm:flex items-center gap-1">
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
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-10">
        <div className="flex">
          {portalNav.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        {children}
      </main>
    </div>
  )
}
