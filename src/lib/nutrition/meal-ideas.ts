import { z } from 'zod'

export const MEAL_IDEA_MEDIA_BUCKET = 'meal-idea-media'
export const MEAL_IDEA_MAX_IMAGES = 6
export const MEAL_IDEA_MAX_IMAGE_BYTES = 5 * 1024 * 1024

export type MealIdeaImage = { path: string; alt: string; url?: string }

const webUrlSchema = z.string().trim().url().max(1000).refine(value => {
  const protocol = new URL(value).protocol
  return protocol === 'http:' || protocol === 'https:'
}, 'Inserisci un link http o https valido')

export const mealIdeaImageSchema = z.object({
  path: z.string().trim().min(1).max(500),
  alt: z.string().trim().max(160).default(''),
})

export const mealIdeaInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().max(80).default(''),
  description: z.string().trim().max(3000).default(''),
  ingredients: z.string().trim().max(5000).default(''),
  instructions: z.string().trim().max(5000).default(''),
  sourceUrl: z.union([webUrlSchema, z.literal('')]).default(''),
  images: z.array(mealIdeaImageSchema).max(MEAL_IDEA_MAX_IMAGES).default([]),
})

export type MealIdeaInput = z.infer<typeof mealIdeaInputSchema>

export function ownsMealIdeaMediaPath(path: string, tenantId: string, professionalId: string) {
  const prefix = `${tenantId}/${professionalId}/`
  return path.startsWith(prefix) && !path.includes('..') && !path.includes('\\')
}

export function ownsMealIdeaMediaPathForIdea(path: string, tenantId: string, professionalId: string, ideaId: string) {
  const prefix = `${tenantId}/${professionalId}/${ideaId}/`
  return path.startsWith(prefix) && !path.includes('..') && !path.includes('\\')
}

export function matchesMealIdeaImageSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === 'image/png') {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  }
  if (mimeType === 'image/gif') {
    const signature = String.fromCharCode(...bytes.slice(0, 6))
    return signature === 'GIF87a' || signature === 'GIF89a'
  }
  return false
}

export async function withSignedMealIdeaImages(admin: any, images: MealIdeaImage[] = []) {
  const paths = images.map(image => image?.path).filter((path): path is string => typeof path === 'string')
  if (!paths.length) return images

  const { data } = await admin.storage.from(MEAL_IDEA_MEDIA_BUCKET).createSignedUrls(paths, 60 * 60)
  const urls = new Map((data ?? []).map((item: any) => [item.path, item.signedUrl]))
  return images.map(image => ({
    path: image.path,
    alt: image.alt ?? '',
    ...(urls.get(image.path) ? { url: urls.get(image.path) } : {}),
  }))
}
