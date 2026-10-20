import { createAdminClient } from '@/lib/supabase/server'

export type PortalClientMembership = {
  id: string
  tenant_id: string
  full_name: string
  tenants: { name: string; logo_url: string | null; brand_primary: string | null; profession: string; status: string } | null
}

export async function getPortalClientMemberships(userId: string) {
  const admin = createAdminClient() as any
  const { data, error } = await admin.from('clients')
    .select('id, tenant_id, full_name, tenants(name, logo_url, brand_primary, profession, status)')
    .eq('profile_id', userId).eq('active', true).order('created_at')
  if (error) throw error
  return (data ?? []).map((client: any) => ({
    ...client,
    tenants: Array.isArray(client.tenants) ? client.tenants[0] ?? null : client.tenants,
  })).filter((client: PortalClientMembership) => client.tenants?.status === 'active') as PortalClientMembership[]
}
