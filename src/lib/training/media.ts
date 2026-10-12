type ExerciseImage = { path: string; alt?: string; url?: string }
type Exercise = { images?: ExerciseImage[]; [key: string]: unknown }
type Plan = { exercises?: Exercise[]; [key: string]: unknown }

export function ownsExerciseMediaPath(path: string, tenantId: string, professionalId?: string) {
  const expected = professionalId ? `${tenantId}/${professionalId}/` : `${tenantId}/`
  return path.startsWith(expected) && !path.includes('..')
}

export async function withSignedImages(admin: any, images: ExerciseImage[] = []) {
  const paths = images.map(image => image?.path).filter((path): path is string => typeof path === 'string')
  if (!paths.length) return images

  const { data } = await admin.storage.from('exercise-media').createSignedUrls(paths, 60 * 60)
  const urls = new Map((data ?? []).map((item: any) => [item.path, item.signedUrl]))
  return images.map(image => ({
    path: image.path,
    alt: image.alt ?? '',
    ...(urls.get(image.path) ? { url: urls.get(image.path) } : {}),
  }))
}

export async function withSignedExerciseImages(admin: any, rawPlan: unknown) {
  if (!rawPlan || typeof rawPlan !== 'object') return rawPlan
  const plan = rawPlan as Plan
  const exercises = Array.isArray(plan.exercises) ? plan.exercises : []

  return {
    ...plan,
    exercises: await Promise.all(exercises.map(async exercise => ({
      ...exercise,
      images: await withSignedImages(admin, exercise.images ?? []),
    }))),
  }
}
