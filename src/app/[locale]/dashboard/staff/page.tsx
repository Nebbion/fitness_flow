import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserCog } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/index'
import { Badge } from '@/components/ui/index'
import { StaffInviteForm } from '@/components/staff/staff-invite-form'
import { StaffMemberActions } from '@/components/staff/staff-member-actions'
import { getInitials } from '@/lib/utils'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'staff' })
  return { title: t('title') }
}

export default async function StaffPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id, role').eq('id', user.id).single()

  if (!profile?.tenant_id || profile.role !== 'TENANT_ADMIN') redirect(`/${locale}/dashboard`)

  const { data: staffMembers } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, active, created_at')
    .eq('tenant_id', profile.tenant_id)
    .in('role', ['TENANT_ADMIN', 'STAFF'])
    .order('created_at', { ascending: true })

  const t = await getTranslations({ locale, namespace: 'staff' })

  const ROLE_LABELS: Record<string, string> = {
    TENANT_ADMIN: t('roles.TENANT_ADMIN'),
    STAFF: t('roles.STAFF'),
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {staffMembers?.length ?? 0} membri del team
          </p>
        </div>
      </div>

      {/* Lista staff */}
      <div className="space-y-2">
        {staffMembers?.map(member => (
          <Card key={member.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm shrink-0">
                    {member.avatar_url
                      ? <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      : getInitials(member.full_name ?? 'U')
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{member.full_name}</p>
                      {member.id === user.id && (
                        <span className="text-xs text-muted-foreground">(tu)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={member.role === 'TENANT_ADMIN' ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
                        {ROLE_LABELS[member.role] ?? member.role}
                      </Badge>
                      {!member.active && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">Inattivo</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Non mostrare azioni sull'utente corrente */}
                {member.id !== user.id && (
                  <StaffMemberActions
                    memberId={member.id}
                    memberName={member.full_name ?? ''}
                    currentRole={member.role as any}
                    isActive={member.active}
                    locale={locale}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form invito */}
      <Card className="border-dashed">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCog className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{t('invite')}</h2>
          </div>
          <StaffInviteForm locale={locale} />
        </CardContent>
      </Card>
    </div>
  )
}
