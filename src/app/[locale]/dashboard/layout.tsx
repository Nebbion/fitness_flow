import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  // Recupera profilo + tenant in un'unica query
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id, role, full_name, avatar_url,
      tenants (
        id, name, slug, logo_url, brand_primary, brand_accent,
        profession, plan, status, max_clients
      )
    `)
    .eq('id', user.id)
    .single()

  if (!profile) redirect(`/${locale}/auth/login`)

  // CLIENT non può accedere alla dashboard
  if (profile.role === 'CLIENT') redirect(`/${locale}/portal`)

  const tenant = Array.isArray(profile.tenants) ? profile.tenants[0] : profile.tenants

  // Tenant sospeso → pagina di errore billing
  if (tenant?.status === 'suspended') {
    redirect(`/${locale}/dashboard/billing?suspended=true`)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        locale={locale}
        role={profile.role as any}
        tenant={tenant as any}
        user={{
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <DashboardHeader
          locale={locale}
          user={{
            id: profile.id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            role: profile.role as any,
          }}
          tenant={tenant as any}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-7xl mx-auto p-6 page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
