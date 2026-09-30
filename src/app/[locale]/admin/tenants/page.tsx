import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Eye, Search } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AdminTenantActions } from '@/components/admin/admin-tenant-actions'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent, Input } from '@/components/ui/index'
import { formatDate, getInitials } from '@/lib/utils'
import type { Metadata } from 'next'
import type { TenantPlan, TenantStatus } from '@/types'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    q?: string
    status?: string
    plan?: string
    page?: string
  }>
}

export const metadata: Metadata = { title: 'Professionisti - Super Admin' }

type AdminTenantRow = {
  id: string
  name: string
  slug: string
  brand_primary: string | null
  profession: string
  plan: string
  status: string
  max_clients: number
  created_at: string
}

type TenantOwnerRow = {
  id: string
  tenant_id: string | null
  full_name: string | null
  active: boolean
  created_at: string
}

type AiUsageRow = {
  total_tokens: number | null
  cost_usd: number | null
}

const TENANT_STATUSES: TenantStatus[] = ['active', 'inactive', 'suspended', 'cancelled']
const TENANT_PLANS: TenantPlan[] = ['trial', 'starter', 'professional', 'business']

const PLAN_LABELS: Record<TenantPlan, string> = {
  trial: 'Trial',
  starter: 'Starter',
  professional: 'Professional',
  business: 'Business',
}

const STATUS_LABELS: Record<TenantStatus, string> = {
  active: 'Attivo',
  inactive: 'Inattivo',
  suspended: 'Sospeso',
  cancelled: 'Cancellato',
}

const PLAN_BADGE: Record<TenantPlan, any> = {
  trial: 'secondary',
  starter: 'outline',
  professional: 'default',
  business: 'success',
}

const STATUS_BADGE: Record<TenantStatus, any> = {
  active: 'success',
  inactive: 'secondary',
  suspended: 'destructive',
  cancelled: 'outline',
}

function isTenantStatus(value?: string): value is TenantStatus {
  return TENANT_STATUSES.includes(value as TenantStatus)
}

function isTenantPlan(value?: string): value is TenantPlan {
  return TENANT_PLANS.includes(value as TenantPlan)
}

function cleanSearch(value?: string) {
  return value?.trim().replace(/[%,()]/g, '') ?? ''
}

function pageHref(locale: string, page: number, filters: { q?: string; status?: string; plan?: string }) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.status) params.set('status', filters.status)
  if (filters.plan) params.set('plan', filters.plan)
  params.set('page', String(page))
  return `/${locale}/admin/tenants?${params.toString()}`
}

export default async function AdminTenantsPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { q, status, plan, page = '1' } = await searchParams

  const supabase = await createClient() as any
  const admin = createAdminClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'SUPER_ADMIN') redirect(`/${locale}/dashboard`)

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1)
  const perPage = 20
  const offset = (pageNum - 1) * perPage
  const searchTerm = cleanSearch(q)
  const statusFilter = isTenantStatus(status) ? status : undefined
  const planFilter = isTenantPlan(plan) ? plan : undefined

  let tenantQuery = admin
    .from('tenants')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (searchTerm) {
    tenantQuery = tenantQuery.or(`name.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%`)
  }
  if (statusFilter) tenantQuery = tenantQuery.eq('status', statusFilter)
  if (planFilter) tenantQuery = tenantQuery.eq('plan', planFilter)

  const [
    { data: tenants, count, error },
    { count: totalTenants },
    { count: activeTenants },
    { count: trialTenants },
    { count: suspendedTenants },
  ] = await Promise.all([
    tenantQuery,
    admin.from('tenants').select('*', { count: 'exact', head: true }),
    admin.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('tenants').select('*', { count: 'exact', head: true }).eq('plan', 'trial'),
    admin.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
  ])

  if (error) throw error

  const tenantRows = (tenants ?? []) as AdminTenantRow[]
  const tenantIds = tenantRows.map((tenant: AdminTenantRow) => tenant.id)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: tenantAdmins } = tenantIds.length
    ? await admin
      .from('profiles')
      .select('id, tenant_id, full_name, active, created_at')
      .in('tenant_id', tenantIds)
      .eq('role', 'TENANT_ADMIN')
      .order('created_at', { ascending: true })
    : { data: [] }

  const tenantAdminRows = (tenantAdmins ?? []) as TenantOwnerRow[]
  const ownersByTenant = new Map<string, TenantOwnerRow>()
  tenantAdminRows.forEach((owner: TenantOwnerRow) => {
    if (owner.tenant_id && !ownersByTenant.has(owner.tenant_id)) {
      ownersByTenant.set(owner.tenant_id, owner)
    }
  })

  const statsEntries = await Promise.all(tenantRows.map(async (tenant: AdminTenantRow) => {
    const [clients, activeClients, staff, appointments, aiUsage] = await Promise.all([
      admin.from('clients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      admin.from('clients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('active', true),
      admin.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).in('role', ['TENANT_ADMIN', 'STAFF']),
      admin.from('appointments').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
      admin.from('ai_usage_logs').select('total_tokens, cost_usd').eq('tenant_id', tenant.id).gte('created_at', thirtyDaysAgo),
    ])

    const aiRows = (aiUsage.data ?? []) as AiUsageRow[]
    const aiTokens = aiRows.reduce((sum: number, row: AiUsageRow) => sum + (row.total_tokens ?? 0), 0)
    const aiCost = aiRows.reduce((sum: number, row: AiUsageRow) => sum + Number(row.cost_usd ?? 0), 0)

    return [tenant.id, {
      clients: clients.count ?? 0,
      activeClients: activeClients.count ?? 0,
      staff: staff.count ?? 0,
      appointments: appointments.count ?? 0,
      aiTokens,
      aiCost,
    }] as const
  }))

  const statsByTenant = Object.fromEntries(statsEntries)
  const totalPages = Math.ceil((count ?? 0) / perPage)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Professionisti</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestione globale dei tenant e degli account professionista.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tenant totali', value: totalTenants ?? 0 },
          { label: 'Attivi', value: activeTenants ?? 0 },
          { label: 'Trial', value: trialTenants ?? 0 },
          { label: 'Sospesi', value: suspendedTenants ?? 0 },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold mt-1">{stat.value.toLocaleString('it-IT')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <form className="flex flex-col lg:flex-row gap-3 rounded-xl border border-border bg-card p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input name="q" defaultValue={q ?? ''} placeholder="Cerca per nome studio o slug" className="pl-9" />
        </div>
        <select
          name="status"
          defaultValue={statusFilter ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Tutti gli stati</option>
          {TENANT_STATUSES.map(item => (
            <option key={item} value={item}>{STATUS_LABELS[item]}</option>
          ))}
        </select>
        <select
          name="plan"
          defaultValue={planFilter ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Tutti i piani</option>
          {TENANT_PLANS.map(item => (
            <option key={item} value={item}>{PLAN_LABELS[item]}</option>
          ))}
        </select>
        <Button type="submit">Filtra</Button>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/admin/tenants`}>Reset</Link>
        </Button>
      </form>

      {tenantRows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Nessun professionista trovato.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="hidden xl:block rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Studio</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Piano</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stato</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Uso</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Creato</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gestione</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenantRows.map((tenant: AdminTenantRow) => {
                  const owner = ownersByTenant.get(tenant.id)
                  const stats = statsByTenant[tenant.id]
                  const planKey = tenant.plan as TenantPlan
                  const statusKey = tenant.status as TenantStatus

                  return (
                    <tr key={tenant.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: tenant.brand_primary ?? '#2563EB' }}
                          >
                            {getInitials(tenant.name)}
                          </div>
                          <div>
                            <p className="font-medium">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {tenant.slug} · {tenant.profession}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Admin: {owner?.full_name ?? 'non assegnato'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={PLAN_BADGE[planKey] ?? 'outline'}>
                          {PLAN_LABELS[planKey] ?? tenant.plan}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[statusKey] ?? 'secondary'}>
                          {STATUS_LABELS[statusKey] ?? tenant.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{stats.activeClients} / {tenant.max_clients >= 999999 ? '∞' : tenant.max_clients} clienti attivi</div>
                        <div className="text-xs">{stats.staff} staff · {stats.appointments} appuntamenti</div>
                        <div className="text-xs">{stats.aiTokens.toLocaleString('it-IT')} token AI 30gg</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(tenant.created_at, 'it-IT')}
                      </td>
                      <td className="px-4 py-3">
                        <AdminTenantActions
                          tenantId={tenant.id}
                          currentPlan={planKey}
                          currentStatus={statusKey}
                          maxClients={tenant.max_clients}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/${locale}/admin/tenants/${tenant.id}`} aria-label={`Apri ${tenant.name}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="xl:hidden space-y-3">
            {tenantRows.map((tenant: AdminTenantRow) => {
              const owner = ownersByTenant.get(tenant.id)
              const stats = statsByTenant[tenant.id]
              const planKey = tenant.plan as TenantPlan
              const statusKey = tenant.status as TenantStatus

              return (
                <Card key={tenant.id}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">{tenant.slug} · {tenant.profession}</p>
                        <p className="text-xs text-muted-foreground">Admin: {owner?.full_name ?? 'non assegnato'}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/${locale}/admin/tenants/${tenant.id}`}>Dettaglio</Link>
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={PLAN_BADGE[planKey] ?? 'outline'}>{PLAN_LABELS[planKey] ?? tenant.plan}</Badge>
                      <Badge variant={STATUS_BADGE[statusKey] ?? 'secondary'}>{STATUS_LABELS[statusKey] ?? tenant.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>{stats.activeClients} / {tenant.max_clients >= 999999 ? '∞' : tenant.max_clients} clienti</div>
                      <div>{stats.staff} staff</div>
                      <div>{stats.appointments} appuntamenti</div>
                      <div>{stats.aiTokens.toLocaleString('it-IT')} token AI</div>
                    </div>
                    <AdminTenantActions
                      tenantId={tenant.id}
                      currentPlan={planKey}
                      currentStatus={statusKey}
                      maxClients={tenant.max_clients}
                    />
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Pagina {pageNum} di {totalPages} · {count ?? 0} totali
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pageNum <= 1} asChild={pageNum > 1}>
                  {pageNum > 1
                    ? <Link href={pageHref(locale, pageNum - 1, { q: searchTerm, status: statusFilter, plan: planFilter })}>Precedente</Link>
                    : <span>Precedente</span>}
                </Button>
                <Button variant="outline" size="sm" disabled={pageNum >= totalPages} asChild={pageNum < totalPages}>
                  {pageNum < totalPages
                    ? <Link href={pageHref(locale, pageNum + 1, { q: searchTerm, status: statusFilter, plan: planFilter })}>Successiva</Link>
                    : <span>Successiva</span>}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
