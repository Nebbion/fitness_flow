import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Utensils } from 'lucide-react'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/index'

interface PageProps { params: Promise<{ locale: string }> }

export default async function NutritionDashboardPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single()
  if (!profile?.tenant_id || !['TENANT_ADMIN', 'STAFF'].includes(profile.role)) redirect(`/${locale}/dashboard`)

  const admin = createAdminClient() as any
  const { data: tenant } = await admin.from('tenants').select('profession').eq('id', profile.tenant_id).single()
  if (tenant?.profession !== 'nutritionist') redirect(`/${locale}/dashboard`)

  let clientsQuery = admin.from('clients').select('id, full_name, email, assigned_staff_id, nutrition_plans(title, updated_at)')
    .eq('tenant_id', profile.tenant_id).eq('active', true).order('full_name')
  if (profile.role === 'STAFF') clientsQuery = clientsQuery.eq('assigned_staff_id', user.id)
  const { data: clients, error } = await clientsQuery
  if (error) throw new Error('Impossibile caricare i piani alimentari')

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Alimentazione</h1><p className="mt-1 text-sm text-muted-foreground">Crea e aggiorna i piani alimentari assegnati ai clienti.</p></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {(clients ?? []).map((client: any) => {
        const plans = Array.isArray(client.nutrition_plans) ? [...client.nutrition_plans].sort((a: any, b: any) => b.updated_at.localeCompare(a.updated_at)) : []
        const plan = plans[0]
        return <Link key={client.id} href={`/${locale}/dashboard/clients/${client.id}?tab=nutrition`}>
          <Card className="h-full transition-colors hover:border-primary/40"><CardContent className="flex items-start gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"><Utensils className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="font-medium">{client.full_name}</p><p className="truncate text-xs text-muted-foreground">{client.email || 'Email non inserita'}</p>
              <p className="mt-1 text-xs">{plans.length} piani salvati</p>
              <p className="mt-2 text-xs">{plan ? <><span className="font-medium">{plan.title}</span><span className="block text-muted-foreground">Aggiornato il {new Date(plan.updated_at).toLocaleDateString(locale)}</span></> : <span className="text-muted-foreground">Piano da creare</span>}</p>
            </div>
          </CardContent></Card>
        </Link>
      })}
    </div>
    {(clients ?? []).length === 0 && <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nessun cliente attivo.</p>}
  </div>
}
