import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getStripeClient, isStripeConfigured, STRIPE_PLANS } from '@/lib/stripe/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { BillingPlans } from '@/components/billing/billing-plans'
import { BillingInvoices } from '@/components/billing/billing-invoices'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ success?: string; suspended?: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'billing' })
  return { title: t('title') }
}

export default async function BillingPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { success, suspended } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id, role').eq('id', user.id).single()

  if (!profile?.tenant_id) redirect(`/${locale}/auth/onboarding`)
  if (profile.role !== 'TENANT_ADMIN') redirect(`/${locale}/dashboard`)

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', profile.tenant_id)
    .single()

  if (!tenant) redirect(`/${locale}/auth/onboarding`)

  // Recupera dati abbonamento da Stripe
  let subscription: any = null
  let invoices: any[] = []

  if (tenant.stripe_subscription_id && isStripeConfigured()) {
    try {
      const stripe = getStripeClient()
      subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id)
      const inv = await stripe.invoices.list({
        customer: tenant.stripe_customer_id!,
        limit: 10,
      })
      invoices = inv.data
    } catch (err) {
      console.error('Stripe error:', err)
    }
  }

  const t = await getTranslations({ locale, namespace: 'billing' })

  const currentPlan = STRIPE_PLANS[tenant.plan as keyof typeof STRIPE_PLANS]
  const { count: clientCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('active', true)

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestisci il tuo abbonamento FitnessFlow</p>
      </div>

      {/* Alert sospensione */}
      {suspended && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm">
          <p className="font-medium text-destructive">Account sospeso</p>
          <p className="text-muted-foreground mt-1">
            Il tuo account è stato sospeso per mancato pagamento. Aggiorna il metodo di pagamento per ripristinare l'accesso.
          </p>
        </div>
      )}

      {/* Alert successo */}
      {success && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-sm">
          <p className="font-medium text-green-700 dark:text-green-400">Abbonamento attivato!</p>
          <p className="text-muted-foreground mt-1">Grazie per aver sottoscritto FitnessFlow. Tutte le funzionalità sono ora disponibili.</p>
        </div>
      )}

      {/* Piano attuale */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('currentPlan')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold capitalize">{tenant.plan}</span>
                {tenant.plan === 'trial' && (
                  <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
                    Prova gratuita
                  </span>
                )}
              </div>
              {tenant.plan === 'trial' && tenant.trial_ends_at && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t('trialEnds', { date: formatDate(tenant.trial_ends_at, locale === 'it' ? 'it-IT' : 'en-GB') })}
                </p>
              )}
              {subscription?.current_period_end && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t('nextBilling', {
                    date: formatDate(
                      new Date(subscription.current_period_end * 1000).toISOString(),
                      locale === 'it' ? 'it-IT' : 'en-GB'
                    ),
                  })}
                </p>
              )}
            </div>

            {/* Utilizzo clienti */}
            <div className="text-right">
              <p className="text-2xl font-semibold">{clientCount ?? 0} / {tenant.max_clients >= 999999 ? '∞' : tenant.max_clients}</p>
              <p className="text-xs text-muted-foreground">clienti attivi</p>
              {tenant.max_clients < 999999 && (
                <div className="mt-2 w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((clientCount ?? 0) / tenant.max_clients) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Azioni abbonamento */}
          {tenant.stripe_customer_id && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <form action="/api/billing/portal" method="POST">
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors font-medium"
                >
                  {t('manageSubscription')}
                </button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Piani disponibili */}
      <BillingPlans
        locale={locale}
        tenantId={tenant.id}
        currentPlan={tenant.plan}
        stripeCustomerId={tenant.stripe_customer_id}
      />

      {/* Fatture */}
      {invoices.length > 0 && (
        <BillingInvoices invoices={invoices} locale={locale} />
      )}
    </div>
  )
}
