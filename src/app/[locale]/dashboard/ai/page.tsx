import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AIAssistant } from '@/components/ai/ai-assistant'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'ai' })
  return { title: t('title') }
}

export default async function AIPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id, role').eq('id', user.id).single()

  if (!profile?.tenant_id) redirect(`/${locale}/auth/onboarding`)

  const { data: tenant } = await supabase
    .from('tenants').select('profession, plan').eq('id', profile.tenant_id).single()

  // Ultimi 20 clienti per il selettore
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, email')
    .eq('tenant_id', profile.tenant_id)
    .eq('active', true)
    .order('full_name', { ascending: true })
    .limit(100)

  // Usage AI del mese corrente
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: usageStats } = await supabase
    .from('ai_usage_logs')
    .select('total_tokens, cost_usd, feature')
    .eq('tenant_id', profile.tenant_id)
    .gte('created_at', startOfMonth.toISOString())

  const totalTokens = usageStats?.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0) ?? 0
  const totalCost = usageStats?.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assistente AI</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Genera contenuti personalizzati per i tuoi clienti con GPT-4o
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Token usati questo mese</p>
          <p className="text-lg font-semibold">{totalTokens.toLocaleString('it-IT')}</p>
        </div>
      </div>

      <AIAssistant
        locale={locale}
        profession={tenant?.profession ?? 'other'}
        clients={clients ?? []}
        plan={tenant?.plan ?? 'trial'}
      />
    </div>
  )
}
