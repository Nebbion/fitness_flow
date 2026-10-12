import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getTrainingProfessional } from '@/lib/training/professional-access'

interface Params { params: Promise<{ id: string }> }
const allowedTypes: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getTrainingProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data: exercise } = await ctx.admin.from('training_exercise_library').select('id, images')
    .eq('id', id).eq('tenant_id', ctx.profile.tenant_id).eq('professional_id', ctx.user.id).maybeSingle()
  if (!exercise) return NextResponse.json({ error: 'Esercizio non trovato' }, { status: 404 })
  if ((exercise.images?.length ?? 0) >= 6) return NextResponse.json({ error: 'Limite di 6 immagini raggiunto' }, { status: 409 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File) || !allowedTypes[file.type]) {
    return NextResponse.json({ error: 'Formato supportato: JPG, PNG, WebP o GIF' }, { status: 422 })
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Ogni immagine deve essere inferiore a 5 MB' }, { status: 422 })
  }

  const path = `${ctx.profile.tenant_id}/${ctx.user.id}/${id}/${crypto.randomUUID()}.${allowedTypes[file.type]}`
  const { error } = await ctx.admin.storage.from('exercise-media').upload(
    path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: '3600', upsert: false }
  )
  if (error) return NextResponse.json({ error: 'Caricamento immagine non riuscito' }, { status: 500 })
  const image = { path, alt: '' }
  const { error: appendError } = await ctx.admin.rpc('training_exercise_append_image', {
    p_id: id,
    p_tenant: ctx.profile.tenant_id,
    p_professional: ctx.user.id,
    p_image: image,
  })
  if (appendError) {
    await ctx.admin.storage.from('exercise-media').remove([path])
    const limitReached = appendError.message?.includes('image_limit')
    return NextResponse.json({ error: limitReached ? 'Limite di 6 immagini raggiunto' : 'Impossibile associare l’immagine' }, { status: limitReached ? 409 : 500 })
  }
  const { data } = await ctx.admin.storage.from('exercise-media').createSignedUrl(path, 60 * 60)
  return NextResponse.json({ image: { ...image, url: data?.signedUrl } }, { status: 201 })
}
