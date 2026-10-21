import { createAdminClient, createClient } from '@/lib/supabase/server'
import { hasPracticeModule } from '@/lib/practice-modules'

export async function getProfessional() {
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, tenants(profession, enabled_modules)')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id || !['TENANT_ADMIN', 'STAFF'].includes(profile.role)) return null
  return { user, profile, admin: createAdminClient() as any }
}

export async function getTrainingProfessional() {
  const actor = await getProfessional()
  if (!actor) return null
  const tenant = Array.isArray(actor.profile?.tenants) ? actor.profile.tenants[0] : actor.profile?.tenants
  if (!hasPracticeModule(tenant, 'training')) return null
  return actor
}

export async function getProfessionalClientContext(clientId: string) {
  const actor = await getProfessional()
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
