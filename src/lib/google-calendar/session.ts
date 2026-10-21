import { createClient } from '@/lib/supabase/server'

export async function getGoogleCalendarProfessional() {
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id || !['TENANT_ADMIN', 'STAFF'].includes(profile.role)) return null
  return { id: user.id, tenantId: profile.tenant_id as string, role: profile.role as string }
}

