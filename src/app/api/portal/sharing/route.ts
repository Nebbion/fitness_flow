import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

async function context() {
  const supabase = await createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, active').eq('id', user.id).single()
  if (profile?.role !== 'CLIENT' || !profile.active) return null
  const admin = createAdminClient() as any
  const { data: memberships } = await admin.from('clients')
    .select('id, tenant_id, full_name, tenants(name, profession, status)')
    .eq('profile_id', user.id).eq('active', true)
  const activeMemberships = (memberships ?? []).map((item: any) => ({
    ...item,
    tenants: Array.isArray(item.tenants) ? item.tenants[0] ?? null : item.tenants,
  })).filter((item: any) => item.tenants?.status === 'active')
  return { admin, memberships: activeMemberships }
}

export async function GET() {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const ids = ctx.memberships.map((item: any) => item.id)
  const { data, error } = await ctx.admin.from('client_data_shares').select('owner_client_id, recipient_client_id, scope')
    .in('owner_client_id', ids).in('recipient_client_id', ids)
  if (error) return NextResponse.json({ error: 'Impossibile caricare le condivisioni' }, { status: 500 })
  return NextResponse.json({ memberships: ctx.memberships, shares: data ?? [] })
}

export async function POST(request: NextRequest) {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const ownerId = typeof body?.ownerClientId === 'string' ? body.ownerClientId : ''
  const recipientId = typeof body?.recipientClientId === 'string' ? body.recipientClientId : ''
  const scope = body?.scope
  const enabled = body?.enabled === true
  if (!ownerId || !recipientId || ownerId === recipientId || !['training', 'nutrition'].includes(scope)) {
    return NextResponse.json({ error: 'Condivisione non valida' }, { status: 422 })
  }
  const ids = new Set(ctx.memberships.map((item: any) => item.id))
  if (!ids.has(ownerId) || !ids.has(recipientId)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const query = enabled
    ? ctx.admin.from('client_data_shares').upsert({ owner_client_id: ownerId, recipient_client_id: recipientId, scope }, { onConflict: 'owner_client_id,recipient_client_id,scope' })
    : ctx.admin.from('client_data_shares').delete().eq('owner_client_id', ownerId).eq('recipient_client_id', recipientId).eq('scope', scope)
  const { error } = await query
  if (error) return NextResponse.json({ error: 'Impossibile salvare la condivisione' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
