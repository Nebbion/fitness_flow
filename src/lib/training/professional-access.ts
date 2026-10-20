import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function getTrainingProfessional() {
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, tenants(profession)')
    .eq('id', user.id)
    .single()

  const tenant = Array.isArray(profile?.tenants) ? profile.tenants[0] : profile?.tenants
  if (!profile?.tenant_id || !['TENANT_ADMIN', 'STAFF'].includes(profile.role)) return null
  if (!['personal_trainer', 'nutritionist'].includes(tenant?.profession ?? '')) return null

  return { user, profile, admin: createAdminClient() as any }
}

export async function getTrainingProfessionalContext(clientId: string) {
  const actor = await getTrainingProfessional()
  if (!actor) return null
  const { user, profile, admin } = actor
  const { data: client } = await admin
    .from('clients')
    .select('id, tenant_id, assigned_staff_id, active')
    .eq('id', clientId)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!client || (profile.role === 'STAFF' && client.assigned_staff_id !== user.id)) return null
  return { user, profile, client, admin }
}
