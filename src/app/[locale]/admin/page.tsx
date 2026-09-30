import { getTranslations } from 'next-intl/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { Badge } from '@/components/ui/index'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
}

export const metadata: Metadata = { title: 'Super Admin — FitnessFlow' }

export default async function AdminPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`)

  // Statistiche globali piattaforma
  const [
    { count: totalTenants },
    { count: activeTenants },
    { count: totalClients },
    { count: totalAppointments },
    { data: recentTenants },
    { data: aiUsage },
  ] = await Promise.all([
    admin.from('tenants').select('*', { count: 'exact', head: true }),
    admin.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('clients').select('*', { count: 'exact', head: true }),
    admin.from('appointments').select('*', { count: 'exact', head: true }),
    admin.from('tenants')
      .select('id, name, slug, plan, status, profession, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    admin.from('ai_usage_logs')
      .select('total_tokens, cost_usd')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
  ])

  const totalAiTokens = aiUsage?.reduce((s, r) => s + (r.total_tokens ?? 0), 0) ?? 0
  const totalAiCost = aiUsage?.reduce((s, r) => s + (r.cost_usd ?? 0), 0) ?? 0

  const PLAN_BADGE: Record<string, any> = {
    trial: 'secondary',
    starter: 'outline',
    professional: 'default',
    business: 'success',
  }

  const STATUS_BADGE: Record<string, any> = {
    active: 'success',
    inactive: 'secondary',
    suspended: 'destructive',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Super Admin</h1>
        <p className="text-muted-foreground text-sm mt-1">Panoramica piattaforma FitnessFlow</p>
      </div>

      {/* Stats globali */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tenant totali',     value: totalTenants ?? 0,     color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/20' },
          { label: 'Tenant attivi',     value: activeTenants ?? 0,    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/20' },
          { label: 'Clienti totali',    value: totalClients ?? 0,     color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/20' },
          { label: 'Appuntamenti',      value: totalAppointments ?? 0,color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950/20' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-semibold mt-1">{stat.value.toLocaleString('it-IT')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Usage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Token AI (ultimi 30gg)</p>
            <p className="text-2xl font-semibold mt-1">{totalAiTokens.toLocaleString('it-IT')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Costo AI (ultimi 30gg)</p>
            <p className="text-2xl font-semibold mt-1">${totalAiCost.toFixed(4)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant recenti */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenant recenti</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {recentTenants?.map(tenant => (
              <div key={tenant.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium">{tenant.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tenant.slug} · {tenant.profession} · {formatDate(tenant.created_at, 'it-IT')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={PLAN_BADGE[tenant.plan] ?? 'outline'} className="text-xs capitalize">
                    {tenant.plan}
                  </Badge>
                  <Badge variant={STATUS_BADGE[tenant.status] ?? 'secondary'} className="text-xs">
                    {tenant.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
