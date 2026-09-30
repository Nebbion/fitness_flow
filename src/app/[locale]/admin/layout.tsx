import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Activity, LayoutDashboard, Users, CreditCard, LogOut } from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params
  const supabase = await createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()

  if (profile?.role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`)

  const navItems = [
    { href: `/${locale}/admin`,         label: 'Dashboard',      icon: LayoutDashboard },
    { href: `/${locale}/admin/tenants`, label: 'Professionisti', icon: Users },
    { href: `/${locale}/admin/billing`, label: 'Billing',        icon: CreditCard },
  ]

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar admin */}
      <aside className="w-56 border-r border-border bg-card flex flex-col shrink-0">
        <div className="flex items-center gap-2 h-16 px-4 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-destructive flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold">FitnessFlow</p>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted-foreground truncate px-2">{profile.full_name}</p>
          <form action={`/api/auth/logout?locale=${locale}`} method="POST">
            <button type="submit" className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground w-full mt-1">
              <LogOut className="w-3.5 h-3.5" />
              Esci
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
