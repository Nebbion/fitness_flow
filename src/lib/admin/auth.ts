import { createClient } from '@/lib/supabase/server'

export async function requireSuperAdminApi() {
  const supabase = await createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, user: null, error: 'Non autenticato', status: 401 as const }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || profile?.role !== 'SUPER_ADMIN') {
    return { supabase, user, error: 'Non autorizzato', status: 403 as const }
  }

  return { supabase, user, error: null, status: 200 as const }
}
