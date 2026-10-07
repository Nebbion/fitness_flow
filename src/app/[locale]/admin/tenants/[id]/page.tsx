import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CalendarDays, CreditCard, Users } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AdminTenantActions } from '@/components/admin/admin-tenant-actions'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { formatDate, formatDateTime, getInitials } from '@/lib/utils'
import type { Metadata } from 'next'
import type { TenantPlan, TenantStatus } from '@/types'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

export const metadata: Metadata = { title: 'Dettaglio Professionista - Super Admin' }

type TenantDetailRow = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  brand_primary: string | null
  profession: string
  plan: string
  status: string
  max_clients: number
  timezone: string
  locale: string
  trial_ends_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
}

type StaffMemberRow = {
  id: string
  full_name: string | null
  role: string
  active: boolean
  created_at: string
}

type RecentClientRow = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  active: boolean
  created_at: string
  last_appointment_at: string | null
}

type RecentAppointmentRow = {
  id: string
  start_at: string
  end_at: string
  status: string
  created_at: string
}

type AiUsageRow = {
  total_tokens: number | null
  cost_usd: number | null
}

type SubscriptionEventRow = {
  id: string
  event_type: string
  processed: boolean
  error_message: string | null
  created_at: string
}

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

export default async function AdminTenantDetailPage({ params }: PageProps) {
  const { locale, id } = await params
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

  const { data: tenantData, error: tenantError } = await admin
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single()

  if (tenantError || !tenantData) notFound()

  const tenant = tenantData as TenantDetailRow

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { count: totalClients },
    { count: activeClients },
    { count: totalAppointments },
    { data: staffMembers },
    { data: recentClients },
    { data: recentAppointments },
    { data: aiUsage },
    { data: subscriptionEvents },
  ] = await Promise.all([
    admin.from('clients').select('*', { count: 'exact', head: true }).eq('tenant_id', id),
    admin.from('clients').select('*', { count: 'exact', head: true }).eq('tenant_id', id).eq('active', true),
    admin.from('appointments').select('*', { count: 'exact', head: true }).eq('tenant_id', id),
    admin
      .from('profiles')
      .select('id, full_name, role, active, created_at')
      .eq('tenant_id', id)
      .in('role', ['TENANT_ADMIN', 'STAFF'])
      .order('created_at', { ascending: true }),
    admin
      .from('clients')
      .select('id, full_name, email, phone, active, created_at, last_appointment_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(8),
    admin
      .from('appointments')
      .select('id, start_at, end_at, status, created_at')
      .eq('tenant_id', id)
      .order('start_at', { ascending: false })
      .limit(8),
    admin
      .from('ai_usage_logs')
      .select('feature, total_tokens, cost_usd, created_at')
      .eq('tenant_id', id)
      .gte('created_at', thirtyDaysAgo),
    admin
      .from('subscription_events')
      .select('id, event_type, processed, error_message, created_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const staffRows = (staffMembers ?? []) as StaffMemberRow[]
  const clientRows = (recentClients ?? []) as RecentClientRow[]
  const appointmentRows = (recentAppointments ?? []) as RecentAppointmentRow[]
  const aiRows = (aiUsage ?? []) as AiUsageRow[]
  const eventRows = (subscriptionEvents ?? []) as SubscriptionEventRow[]
  const aiTokens = aiRows.reduce((sum: number, row: AiUsageRow) => sum + (row.total_tokens ?? 0), 0)
  const aiCost = aiRows.reduce((sum: number, row: AiUsageRow) => sum + Number(row.cost_usd ?? 0), 0)
  const planKey = tenant.plan as TenantPlan
  const statusKey = tenant.status as TenantStatus
  const owner = staffRows.find((member: StaffMemberRow) => member.role === 'TENANT_ADMIN')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
            <Link href={`/${locale}/admin/tenants`}>
              <ArrowLeft className="w-4 h-4" />
              Professionisti
            </Link>
          </Button>

          <div className="flex items-center gap-4">
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="w-14 h-14 rounded-xl object-cover border border-border shrink-0"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-xl text-white text-base font-semibold flex items-center justify-center shrink-0"
                style={{ backgroundColor: tenant.brand_primary ?? '#2563EB' }}
              >
                {getInitials(tenant.name)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold">{tenant.name}</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {tenant.slug} · {tenant.profession} · creato il {formatDate(tenant.created_at, 'it-IT')}
              </p>
            </div>
          </div>
        </div>

        <AdminTenantActions
          tenantId={tenant.id}
          currentPlan={planKey}
          currentStatus={statusKey}
          logoUrl={tenant.logo_url}
          maxClients={tenant.max_clients}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Clienti attivi', value: `${activeClients ?? 0} / ${tenant.max_clients >= 999999 ? '∞' : tenant.max_clients}`, icon: Users },
          { label: 'Clienti totali', value: totalClients ?? 0, icon: Users },
          { label: 'Appuntamenti', value: totalAppointments ?? 0, icon: CalendarDays },
          { label: 'Costo AI 30gg', value: `$${aiCost.toFixed(4)}`, icon: CreditCard },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-semibold mt-1">{stat.value}</p>
                  </div>
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Profilo tenant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Info label="Admin principale" value={owner?.full_name ?? 'Non assegnato'} />
              <Info label="Timezone" value={tenant.timezone} />
              <Info label="Lingua" value={tenant.locale.toUpperCase()} />
              <Info label="Logo" value={tenant.logo_url ? 'Configurato' : 'Non configurato'} />
              <Info label="Trial termina" value={tenant.trial_ends_at ? formatDate(tenant.trial_ends_at, 'it-IT') : 'Non impostato'} />
              <Info label="Stripe customer" value={tenant.stripe_customer_id ?? 'Non collegato'} />
              <Info label="Stripe subscription" value={tenant.stripe_subscription_id ?? 'Non collegata'} />
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              <Badge variant={PLAN_BADGE[planKey] ?? 'outline'}>{PLAN_LABELS[planKey] ?? tenant.plan}</Badge>
              <Badge variant={STATUS_BADGE[statusKey] ?? 'secondary'}>{STATUS_LABELS[statusKey] ?? tenant.status}</Badge>
              <Badge variant="outline">{aiTokens.toLocaleString('it-IT')} token AI 30gg</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team professionista</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {staffRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun membro staff associato.</p>
            ) : (
              staffRows.map((member: StaffMemberRow) => (
                <div key={member.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{member.full_name ?? 'Senza nome'}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                  <Badge variant={member.active ? 'success' : 'secondary'} className="text-xs">
                    {member.active ? 'Attivo' : 'Inattivo'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clienti recenti</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {clientRows.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 pt-0">Nessun cliente.</p>
            ) : (
              <div className="divide-y divide-border">
                {clientRows.map((client: RecentClientRow) => (
                  <div key={client.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div>
                      <p className="text-sm font-medium">{client.full_name}</p>
                      <p className="text-xs text-muted-foreground">{client.email ?? client.phone ?? 'Contatto non presente'}</p>
                    </div>
                    <Badge variant={client.active ? 'success' : 'secondary'} className="text-xs">
                      {client.active ? 'Attivo' : 'Inattivo'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appuntamenti recenti</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {appointmentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 pt-0">Nessun appuntamento.</p>
            ) : (
              <div className="divide-y divide-border">
                {appointmentRows.map((appointment: RecentAppointmentRow) => (
                  <div key={appointment.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {formatDateTime(appointment.start_at, locale === 'it' ? 'it-IT' : 'en-GB')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Creato il {formatDate(appointment.created_at, 'it-IT')}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">{appointment.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventi billing recenti</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {eventRows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 pt-0">Nessun evento Stripe registrato.</p>
          ) : (
            <div className="divide-y divide-border">
              {eventRows.map((event: SubscriptionEventRow) => (
                <div key={event.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{event.event_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.created_at, locale === 'it' ? 'it-IT' : 'en-GB')}
                      {event.error_message ? ` · ${event.error_message}` : ''}
                    </p>
                  </div>
                  <Badge variant={event.processed ? 'success' : 'warning'} className="text-xs">
                    {event.processed ? 'Processato' : 'In attesa'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  )
}
