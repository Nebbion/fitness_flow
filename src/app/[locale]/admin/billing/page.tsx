import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, CreditCard, Receipt, TrendingUp } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { STRIPE_PLANS } from '@/lib/stripe/client'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { Metadata } from 'next'
import type { TenantPlan, TenantStatus } from '@/types'

interface PageProps {
  params: Promise<{ locale: string }>
}

export const metadata: Metadata = { title: 'Billing - Super Admin' }

type BillingTenantRow = {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  trial_ends_at: string | null
  created_at: string
}

type BillingEventRow = {
  id: string
  tenant_id: string | null
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

const STATUS_BADGE: Record<TenantStatus, any> = {
  active: 'success',
  inactive: 'secondary',
  suspended: 'destructive',
  cancelled: 'outline',
}

const PLAN_PRICE: Record<TenantPlan, number> = {
  trial: 0,
  starter: STRIPE_PLANS.starter.price_monthly,
  professional: STRIPE_PLANS.professional.price_monthly,
  business: STRIPE_PLANS.business.price_monthly,
}

export default async function AdminBillingPage({ params }: PageProps) {
  const { locale } = await params
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

  const [{ data: tenants }, { data: subscriptionEvents }] = await Promise.all([
    admin
      .from('tenants')
      .select('id, name, slug, plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, trial_ends_at, created_at')
      .order('created_at', { ascending: false }),
    admin
      .from('subscription_events')
      .select('id, tenant_id, event_type, processed, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const rows = (tenants ?? []) as BillingTenantRow[]
  const events = (subscriptionEvents ?? []) as BillingEventRow[]
  const activePaidTenants = rows.filter((tenant: BillingTenantRow) => tenant.status === 'active' && tenant.plan !== 'trial')
  const estimatedMrr = activePaidTenants.reduce(
    (sum: number, tenant: BillingTenantRow) => sum + PLAN_PRICE[tenant.plan as TenantPlan],
    0
  )
  const connectedStripe = rows.filter((tenant: BillingTenantRow) => tenant.stripe_customer_id).length
  const activeSubscriptions = rows.filter((tenant: BillingTenantRow) => tenant.stripe_subscription_id).length
  const failedEvents = events.filter((event: BillingEventRow) => event.error_message).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vista globale su piani, Stripe e abbonamenti dei professionisti.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'MRR stimato', value: formatCurrency(estimatedMrr), icon: TrendingUp },
          { label: 'Tenant paganti', value: activePaidTenants.length, icon: CreditCard },
          { label: 'Customer Stripe', value: connectedStripe, icon: Receipt },
          { label: 'Eventi con errore', value: failedEvents, icon: AlertTriangle },
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenant e abbonamenti</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Piano</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stato</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stripe</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trial</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">MRR</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((tenant: BillingTenantRow) => {
                  const planKey = tenant.plan as TenantPlan
                  const statusKey = tenant.status as TenantStatus

                  return (
                    <tr key={tenant.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                      </td>
                      <td className="px-4 py-3">{PLAN_LABELS[planKey] ?? tenant.plan}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[statusKey] ?? 'secondary'}>
                          {STATUS_LABELS[statusKey] ?? tenant.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{tenant.stripe_customer_id ? 'Customer collegato' : 'Customer assente'}</div>
                        <div className="text-xs">{tenant.stripe_subscription_id ? 'Subscription attiva' : 'Subscription assente'}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tenant.trial_ends_at ? formatDateTime(tenant.trial_ends_at, locale === 'it' ? 'it-IT' : 'en-GB') : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatCurrency(tenant.status === 'active' ? PLAN_PRICE[planKey] : 0)}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/${locale}/admin/tenants/${tenant.id}`}>Apri</Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden divide-y divide-border">
            {rows.map((tenant: BillingTenantRow) => {
              const planKey = tenant.plan as TenantPlan
              const statusKey = tenant.status as TenantStatus

              return (
                <div key={tenant.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${locale}/admin/tenants/${tenant.id}`}>Apri</Link>
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{PLAN_LABELS[planKey] ?? tenant.plan}</Badge>
                    <Badge variant={STATUS_BADGE[statusKey] ?? 'secondary'}>
                      {STATUS_LABELS[statusKey] ?? tenant.status}
                    </Badge>
                    <Badge variant={tenant.stripe_customer_id ? 'success' : 'secondary'}>
                      {tenant.stripe_customer_id ? 'Stripe collegato' : 'Stripe assente'}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventi Stripe recenti</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 pt-0">Nessun evento Stripe registrato.</p>
          ) : (
            <div className="divide-y divide-border">
              {events.map((event: BillingEventRow) => (
                <div key={event.id} className="flex items-center justify-between gap-3 px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">{event.event_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.created_at, locale === 'it' ? 'it-IT' : 'en-GB')}
                      {event.error_message ? ` · ${event.error_message}` : ''}
                    </p>
                  </div>
                  <Badge variant={event.error_message ? 'destructive' : event.processed ? 'success' : 'warning'} className="text-xs">
                    {event.error_message ? 'Errore' : event.processed ? 'Processato' : 'In attesa'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        MRR stimato calcolato sui piani attivi nel database. La fonte contabile resta Stripe.
        Subscription attive rilevate: {activeSubscriptions}.
      </p>
    </div>
  )
}
