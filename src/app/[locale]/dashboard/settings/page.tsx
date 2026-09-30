import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'settings' })
  return { title: t('title') }
}

export default async function SettingsPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id, role, full_name').eq('id', user.id).single()

  if (!profile?.tenant_id || profile.role !== 'TENANT_ADMIN') redirect(`/${locale}/dashboard`)

  const [{ data: tenant }, { data: customFields }, { data: notifRules }] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', profile.tenant_id).single(),
    supabase.from('custom_field_definitions')
      .select('*').eq('tenant_id', profile.tenant_id)
      .eq('entity_type', 'client').eq('active', true).order('sort_order'),
    supabase.from('notification_rules')
      .select('*').eq('tenant_id', profile.tenant_id).order('event_trigger'),
  ])

  const t = await getTranslations({ locale, namespace: 'settings' })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestisci le impostazioni del tuo studio</p>
      </div>
      <SettingsTabs
        locale={locale}
        tenant={tenant}
        adminAccount={{
          email: user.email ?? '',
          fullName: profile.full_name ?? user.user_metadata?.full_name ?? null,
        }}
        customFields={customFields ?? []}
        notifRules={notifRules ?? []}
      />
    </div>
  )
}
