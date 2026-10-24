import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getNutritionProfessional } from '@/lib/training/professional-access'
import {
  NUTRITION_IMPORT_BUCKET,
  NUTRITION_IMPORT_MAX_FILE_BYTES,
  NUTRITION_IMPORT_MAX_FILES,
  nutritionImportMimeTypes,
  ownsNutritionImportPath,
} from '@/lib/nutrition/import'

export const runtime = 'nodejs'

const uploadSchema = z.object({
  name: z.string().trim().min(1).max(180),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  size: z.number().int().positive().max(NUTRITION_IMPORT_MAX_FILE_BYTES),
})

const discardSchema = z.object({
  paths: z.array(z.string().trim().min(1).max(500)).min(1).max(NUTRITION_IMPORT_MAX_FILES),
})

export async function POST(request: NextRequest) {
  const ctx = await getNutritionProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Importazione AI non configurata' }, { status: 503 })
  }

  const parsed = uploadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'File non valido o superiore a 12 MB' }, { status: 422 })
  }

  const extension = nutritionImportMimeTypes[parsed.data.mimeType]
  const path = `${ctx.profile.tenant_id}/${ctx.user.id}/${crypto.randomUUID()}.${extension}`
  const { data, error } = await ctx.admin.storage.from(NUTRITION_IMPORT_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json({ error: 'Impossibile preparare il caricamento' }, { status: 500 })
  }

  return NextResponse.json({
    upload: { path, token: data.token, ...parsed.data },
  })
}

export async function DELETE(request: NextRequest) {
  const ctx = await getNutritionProfessional()
  if (!ctx) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const parsed = discardSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || parsed.data.paths.some(path =>
    !ownsNutritionImportPath(path, ctx.profile.tenant_id, ctx.user.id)
  )) {
    return NextResponse.json({ error: 'Percorso non valido' }, { status: 422 })
  }

  await ctx.admin.storage.from(NUTRITION_IMPORT_BUCKET).remove(parsed.data.paths)
  return NextResponse.json({ ok: true })
}
