import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getNutritionProfessional } from '@/lib/training/professional-access'
import {
  MEAL_IDEA_MAX_IMAGE_BYTES,
  MEAL_IDEA_MAX_IMAGES,
  MEAL_IDEA_MEDIA_BUCKET,
  matchesMealIdeaImageSignature,
} from '@/lib/nutrition/meal-ideas'

interface Params { params: Promise<{ id: string }> }
const allowedTypes: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const ctx = await getNutritionProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data: idea } = await ctx.admin.from('meal_ideas').select('id, images')
    .eq('id', id).eq('tenant_id', ctx.profile.tenant_id).eq('professional_id', ctx.user.id).maybeSingle()
  if (!idea) return NextResponse.json({ error: 'Idea pasto non trovata' }, { status: 404 })
  if ((idea.images?.length ?? 0) >= MEAL_IDEA_MAX_IMAGES) {
    return NextResponse.json({ error: `Limite di ${MEAL_IDEA_MAX_IMAGES} immagini raggiunto` }, { status: 409 })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File) || !allowedTypes[file.type]) {
    return NextResponse.json({ error: 'Formato supportato: JPG, PNG, WebP o GIF' }, { status: 422 })
  }
  if (file.size <= 0 || file.size > MEAL_IDEA_MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Ogni immagine deve essere inferiore a 5 MB' }, { status: 422 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!matchesMealIdeaImageSignature(bytes, file.type)) {
    return NextResponse.json({ error: 'Il contenuto non corrisponde al formato immagine dichiarato' }, { status: 422 })
  }

  const path = `${ctx.profile.tenant_id}/${ctx.user.id}/${id}/${crypto.randomUUID()}.${allowedTypes[file.type]}`
  const { error } = await ctx.admin.storage.from(MEAL_IDEA_MEDIA_BUCKET).upload(
    path, Buffer.from(bytes), { contentType: file.type, cacheControl: '3600', upsert: false }
  )
  if (error) return NextResponse.json({ error: 'Caricamento immagine non riuscito' }, { status: 500 })

  const image = { path, alt: '' }
  const { error: appendError } = await ctx.admin.rpc('meal_idea_append_image', {
    p_id: id,
    p_tenant: ctx.profile.tenant_id,
    p_professional: ctx.user.id,
    p_image: image,
  })
  if (appendError) {
    await ctx.admin.storage.from(MEAL_IDEA_MEDIA_BUCKET).remove([path])
    const limitReached = appendError.message?.includes('image_limit')
    return NextResponse.json({ error: limitReached ? `Limite di ${MEAL_IDEA_MAX_IMAGES} immagini raggiunto` : 'Impossibile associare l’immagine' }, { status: limitReached ? 409 : 500 })
  }

  const { data } = await ctx.admin.storage.from(MEAL_IDEA_MEDIA_BUCKET).createSignedUrl(path, 60 * 60)
  return NextResponse.json({ image: { ...image, url: data?.signedUrl } }, { status: 201 })
}
