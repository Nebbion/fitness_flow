import { NextRequest, NextResponse } from 'next/server'
import { getProfessionalClientContext } from '@/lib/training/professional-access'

interface Params { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getProfessionalClientContext(id)
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data: shares, error } = await ctx.admin.from('client_data_shares')
    .select('owner_client_id, scope').eq('recipient_client_id', id)
  if (error) return NextResponse.json({ error: 'Impossibile caricare le condivisioni' }, { status: 500 })
  const trainingIds = (shares ?? []).filter((item: any) => item.scope === 'training').map((item: any) => item.owner_client_id)
  const nutritionIds = (shares ?? []).filter((item: any) => item.scope === 'nutrition').map((item: any) => item.owner_client_id)
  const ownerIds = [...new Set([...trainingIds, ...nutritionIds])]
  if (!ownerIds.length) return NextResponse.json({ training: [], nutrition: [] })

  const [{ data: owners }, { data: training }, { data: nutrition }] = await Promise.all([
    ctx.admin.from('clients').select('id, tenant_id, tenants(name, profession)').in('id', ownerIds),
    trainingIds.length ? ctx.admin.from('training_plans').select('id, client_id, title, exercises, updated_at').in('client_id', trainingIds).order('updated_at', { ascending: false }) : Promise.resolve({ data: [] }),
    nutritionIds.length ? ctx.admin.from('nutrition_plans').select('id, client_id, title, objective, target_calories, days, updated_at').in('client_id', nutritionIds).order('updated_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ])
  const ownerNames = new Map((owners ?? []).map((owner: any) => {
    const tenant = Array.isArray(owner.tenants) ? owner.tenants[0] : owner.tenants
    return [owner.id, tenant?.name ?? 'Professionista']
  }))
  return NextResponse.json({
    training: (training ?? []).map((item: any) => ({ ...item, ownerName: ownerNames.get(item.client_id) })),
    nutrition: (nutrition ?? []).map((item: any) => ({ ...item, ownerName: ownerNames.get(item.client_id) })),
  })
}
