import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ClientForm } from '@/components/clients/client-form'
import type { Metadata } from 'next'
import { normalizeCustomFieldDefinition } from '@/lib/custom-fields'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'clients' })
  return { title: t('newClient') }
}

export default async function NewClientPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect(`/${locale}/auth/onboarding`)
  if (profile.role === 'STAFF') redirect(`/${locale}/dashboard/clients`)

  // Controllo limite clienti
  const { count } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id)
    .eq('active', true)

  const { data: tenant } = await supabase
    .from('tenants')
    .select('max_clients')
    .eq('id', profile.tenant_id)
    .single()

  if (tenant && count !== null && count >= tenant.max_clients) {
    redirect(`/${locale}/dashboard/clients?limit=true`)
  }

  // Staff list per assegnazione
  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('tenant_id', profile.tenant_id)
    .in('role', ['TENANT_ADMIN', 'STAFF'])
    .eq('active', true)

  // Campi custom del tenant
  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('entity_type', 'client')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  const t = await getTranslations({ locale, namespace: 'clients' })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <a
          href={`/${locale}/dashboard/clients`}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </a>
        <div>
          <h1 className="text-2xl font-semibold">{t('newClient')}</h1>
          <p className="text-muted-foreground text-sm">{t('form.title')}</p>
        </div>
      </div>

      <ClientForm
        locale={locale}
        tenantId={profile.tenant_id}
        staffList={staffList ?? []}
        customFields={(customFields ?? []).map(normalizeCustomFieldDefinition)}
      />
    </div>
  )
}
