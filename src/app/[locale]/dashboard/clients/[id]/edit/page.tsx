import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ClientForm } from '@/components/clients/client-form'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

export default async function EditClientPage({ params }: PageProps) {
  const { locale, id } = await params
  const supabase = await createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect(`/${locale}/auth/onboarding`)
  if (profile.role === 'STAFF') redirect(`/${locale}/dashboard/clients/${id}`)

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!client) notFound()

  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('tenant_id', profile.tenant_id)
    .in('role', ['TENANT_ADMIN', 'STAFF'])
    .eq('active', true)

  const { data: customFields } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('entity_type', 'client')
    .eq('active', true)
    .order('sort_order')

  const t = await getTranslations({ locale, namespace: 'clients' })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <a
          href={`/${locale}/dashboard/clients/${id}`}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </a>
        <div>
          <h1 className="text-2xl font-semibold">{t('detail.editClient')}</h1>
          <p className="text-muted-foreground text-sm">{client.full_name}</p>
        </div>
      </div>

      <ClientForm
        locale={locale}
        tenantId={profile.tenant_id}
        staffList={staffList ?? []}
        customFields={customFields ?? []}
        clientId={id}
        defaultValues={{
          full_name: client.full_name,
          email: client.email ?? '',
          phone: client.phone ?? '',
          birth_date: client.birth_date ?? '',
          gender: client.gender ?? '',
          notes: client.notes ?? '',
          tags: client.tags ?? [],
          assigned_staff_id: client.assigned_staff_id ?? '',
          preferred_language: client.preferred_language ?? 'it',
          whatsapp_reminders_consent: (client as any).whatsapp_reminders_consent ?? false,
          custom_fields: client.custom_fields ?? {},
        }}
      />
    </div>
  )
}
