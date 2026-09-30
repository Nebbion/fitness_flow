import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, Clock, Euro, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/index'
import { ServiceForm } from '@/components/services/service-form'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'services' })
  return { title: t('title') }
}

export default async function ServicesPage({ params }: PageProps) {
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
  if (profile.role === 'STAFF') redirect(`/${locale}/dashboard`)

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('name', { ascending: true })

  const t = await getTranslations({ locale, namespace: 'services' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{services?.length ?? 0} servizi configurati</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista servizi */}
        <div className="lg:col-span-2 space-y-3">
          {!services?.length ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground text-sm">{t('noServices')}</p>
            </div>
          ) : (
            services.map(service => (
              <Card key={service.id} className={!service.active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-10 rounded-full shrink-0"
                        style={{ background: service.color ?? '#2563EB' }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{service.name}</p>
                          {!service.active && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                              Non attivo
                            </span>
                          )}
                        </div>
                        {service.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{service.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />{service.duration_min} min
                          </span>
                          {service.price && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Euro className="w-3 h-3" />{service.price}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ServiceForm
                      locale={locale}
                      tenantId={profile.tenant_id}
                      service={service}
                      trigger={
                        <Button variant="ghost" size="sm">Modifica</Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Form nuovo servizio */}
        <div>
          <ServiceForm
            locale={locale}
            tenantId={profile.tenant_id}
            trigger={
              <Button className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                {t('newService')}
              </Button>
            }
          />
        </div>
      </div>
    </div>
  )
}
