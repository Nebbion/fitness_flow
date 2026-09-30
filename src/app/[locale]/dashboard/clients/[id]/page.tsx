import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Mail, Phone, Calendar, Tag } from 'lucide-react'
import { ClientTabs } from '@/components/clients/client-tabs'
import { ClientActions } from '@/components/clients/client-actions'
import { Badge } from '@/components/ui/index'
import { formatDate, calcAge } from '@/lib/utils'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('clients').select('full_name').eq('id', id).single()
  return { title: data?.full_name ?? 'Cliente' }
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { locale, id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect(`/${locale}/auth/onboarding`)

  // Recupera il cliente con relazioni
  const { data: client, error } = await supabase
    .from('clients')
    .select(`
      *,
      assigned_staff:profiles!clients_assigned_staff_id_fkey (id, full_name, avatar_url),
      portal_user:profiles!clients_profile_id_fkey (id, full_name, active)
    `)
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (error || !client) notFound()

  // Se STAFF, verifica che sia il cliente assegnato
  if (profile.role === 'STAFF' && client.assigned_staff_id !== user.id) {
    redirect(`/${locale}/dashboard/clients`)
  }

  // Campi custom definizioni
  const { data: customFieldDefs } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('entity_type', 'client')
    .eq('active', true)
    .order('sort_order')

  // Conteggi per le tab
  const [
    { count: appointmentsCount },
    { count: documentsCount },
    { count: progressCount },
  ] = await Promise.all([
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('progress_entries').select('*', { count: 'exact', head: true }).eq('client_id', id),
  ])

  const t = await getTranslations({ locale, namespace: 'clients' })
  const tDetail = await getTranslations({ locale, namespace: 'clients.detail' })

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <a
            href={`/${locale}/dashboard/clients`}
            className="mt-1 p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold">{client.full_name}</h1>
              {!client.active && (
                <Badge variant="secondary">Non attivo</Badge>
              )}
              {client.portal_user && (
                <Badge variant="outline" className="text-xs">
                  🔗 Portale attivo
                </Badge>
              )}
            </div>

            {/* Info rapide */}
            <div className="flex flex-wrap gap-4 mt-2">
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <Mail className="w-3.5 h-3.5" />
                  {client.email}
                </a>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <Phone className="w-3.5 h-3.5" />
                  {client.phone}
                </a>
              )}
              {client.birth_date && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(client.birth_date, locale === 'it' ? 'it-IT' : 'en-GB')}
                  {' '}({calcAge(client.birth_date)} anni)
                </span>
              )}
            </div>

            {/* Tag */}
            {client.tags && client.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                {client.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Azioni */}
        {profile.role === 'TENANT_ADMIN' && (
          <ClientActions
            clientId={id}
            locale={locale}
            clientName={client.full_name}
            clientEmail={client.email}
            hasPortalAccess={!!client.portal_user}
            isActive={client.active}
          />
        )}
      </div>

      {/* Tabs */}
      <ClientTabs
        client={client}
        locale={locale}
        role={profile.role as any}
        tenantId={profile.tenant_id}
        userId={user.id}
        customFieldDefs={customFieldDefs ?? []}
        counts={{
          appointments: appointmentsCount ?? 0,
          documents: documentsCount ?? 0,
          progress: progressCount ?? 0,
        }}
      />
    </div>
  )
}
