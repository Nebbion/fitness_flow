import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ClientProgressPanel } from '@/components/clients/client-progress-panel'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function PortalProgressPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()
  const t = await getTranslations({ locale, namespace: 'portal.progress' })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: client } = await supabase
    .from('clients')
    .select('id, tenant_id')
    .eq('profile_id', user.id)
    .single()

  if (!client) redirect(`/${locale}/auth/login`)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <ClientProgressPanel
        clientId={client.id}
        tenantId={client.tenant_id}
        locale={locale}
        role="CLIENT"
      />
    </div>
  )
}
