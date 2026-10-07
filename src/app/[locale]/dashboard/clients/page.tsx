import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientsTable } from '@/components/clients/clients-table'
import { ClientsFilters } from '@/components/clients/clients-filters'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    q?: string
    filter?: string
    page?: string
    staff?: string
  }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'clients' })
  return { title: t('title') }
}

export default async function ClientsPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { q, filter = 'all', page = '1', staff } = await searchParams

  const supabase = await createClient()
  const t = await getTranslations({ locale, namespace: 'clients' })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) redirect(`/${locale}/auth/onboarding`)

  // Recupera tenant per sapere il limite clienti
  const { data: tenant } = await supabase
    .from('tenants')
    .select('max_clients, plan')
    .eq('id', profile.tenant_id)
    .single()

  // Costruisci la query
  const pageNum = Math.max(1, parseInt(page))
  const perPage = 20
  const offset = (pageNum - 1) * perPage

  let query = supabase
    .from('clients')
    .select(`
      id, full_name, email, phone, birth_date, tags,
      active, last_appointment_at, created_at, preferred_language,
      profiles!clients_assigned_staff_id_fkey (id, full_name)
    `, { count: 'exact' })
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  // Filtro per ruolo STAFF — vede solo i propri clienti
  if (profile.role === 'STAFF') {
    query = query.eq('assigned_staff_id', user.id)
  }

  // Ricerca testo
  if (q && q.trim()) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
    )
  }

  // Filtri stato
  if (filter === 'active') query = query.eq('active', true)
  if (filter === 'inactive') query = query.eq('active', false)
  if (filter === 'inactive30Days') {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    query = query
      .eq('active', true)
      .or(`last_appointment_at.lt.${thirtyDaysAgo.toISOString()},last_appointment_at.is.null`)
  }

  // Filtro staff specifico
  if (staff) query = query.eq('assigned_staff_id', staff)

  const { data: clients, count, error } = await query

  // Staff list per filtro (solo TENANT_ADMIN)
  let staffList: any[] = []
  if (profile.role === 'TENANT_ADMIN') {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('tenant_id', profile.tenant_id)
      .in('role', ['TENANT_ADMIN', 'STAFF'])
      .eq('active', true)
    staffList = data ?? []
  }

  const totalPages = Math.ceil((count ?? 0) / perPage)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {count ?? 0} {t('title').toLowerCase()}
            {tenant?.max_clients && tenant.max_clients < 999999 && (
              <span className="text-muted-foreground"> / {tenant.max_clients} max</span>
            )}
          </p>
        </div>
        {profile.role === 'TENANT_ADMIN' && (
          <Button asChild>
            <a href={`/${locale}/dashboard/clients/new`}>
              <Plus className="w-4 h-4 mr-2" />
              {t('newClient')}
            </a>
          </Button>
        )}
      </div>

      {/* Avviso limite clienti */}
      {tenant && count !== null && tenant.max_clients < 999999 &&
        count >= tenant.max_clients * 0.9 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning-foreground flex items-center gap-2">
          <span>⚠️</span>
          <span>
            Hai {count} clienti su {tenant.max_clients} disponibili.{' '}
            <a href={`/${locale}/dashboard/billing`} className="underline font-medium">
              Aggiorna il piano
            </a>{' '}
            per aggiungerne altri.
          </span>
        </div>
      )}

      {/* Filtri */}
      <ClientsFilters
        locale={locale}
        currentFilter={filter}
        currentSearch={q}
        staffList={staffList}
        currentStaff={staff}
        role={profile.role as any}
      />

      {/* Tabella */}
      <ClientsTable
        clients={(clients ?? []).map(client => ({
          ...client,
          tags: client.tags ?? [],
        }))}
        locale={locale}
        role={profile.role as any}
        totalPages={totalPages}
        currentPage={pageNum}
        total={count ?? 0}
      />
    </div>
  )
}
