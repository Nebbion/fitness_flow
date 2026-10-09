import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Activity, LayoutDashboard, Users, CreditCard, LogOut, ShieldCheck } from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params
  const supabase = await createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/superadmin/login`)

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()

  if (profile?.role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`)

  const navItems = [
    { href: `/${locale}/admin`,         label: 'Dashboard',      icon: LayoutDashboard },
    { href: `/${locale}/admin/tenants`, label: 'Professionisti', icon: Users },
    { href: `/${locale}/admin/billing`, label: 'Billing',        icon: CreditCard },
  ]

  return (
    <div
      className="flex h-screen overflow-hidden bg-[#f5f6f8] dark:bg-zinc-950"
      style={{ '--primary': '0 72% 51%', '--ring': '0 72% 51%' } as React.CSSProperties}
    >
      {/* Sidebar admin */}
      <aside className="w-20 md:w-60 border-r border-zinc-800 bg-zinc-950 text-zinc-100 flex flex-col shrink-0">
        <div className="flex items-center gap-3 h-16 px-4 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-md bg-red-600 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div className="hidden md:block min-w-0">
            <p className="text-sm font-semibold">FitnessFlow</p>
            <p className="text-xs text-zinc-400">Platform Control</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex h-10 items-center justify-center md:justify-start gap-3 px-3 rounded-md text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-zinc-800">
          <p className="hidden md:block text-xs text-zinc-400 truncate px-2">{profile.full_name}</p>
          <form action={`/api/auth/logout?locale=${locale}`} method="POST">
            <button type="submit" aria-label="Esci" className="flex h-9 items-center justify-center md:justify-start gap-2 px-2 text-xs text-zinc-400 hover:text-white w-full mt-1">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Esci</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-4 w-4 text-red-600 shrink-0" />
            <span className="text-sm font-medium truncate">Controllo piattaforma</span>
          </div>
          <span className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded dark:bg-red-950/30 dark:border-red-900 dark:text-red-300">
            SUPER ADMIN
          </span>
        </header>
        <div className="container max-w-7xl mx-auto p-4 md:p-6 page-enter">
          {children}
        </div>
      </main>
    </div>
  )
}
