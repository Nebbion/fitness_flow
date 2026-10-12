import assert from 'node:assert/strict'
import test from 'node:test'
import { ownsExerciseMediaPath, withSignedImages } from './media.ts'

test('exercise media paths cannot cross tenant or professional boundaries', () => {
  assert.equal(ownsExerciseMediaPath('tenant-a/pro-a/exercise/image.webp', 'tenant-a', 'pro-a'), true)
  assert.equal(ownsExerciseMediaPath('tenant-a/pro-b/exercise/image.webp', 'tenant-a', 'pro-a'), false)
  assert.equal(ownsExerciseMediaPath('tenant-b/pro-a/exercise/image.webp', 'tenant-a'), false)
  assert.equal(ownsExerciseMediaPath('tenant-a/../tenant-b/image.webp', 'tenant-a'), false)
})

test('signed URLs are attached without replacing persistent paths', async () => {
  const admin = { storage: { from: () => ({
    createSignedUrls: async (paths: string[]) => ({ data: paths.map(path => ({ path, signedUrl: `signed:${path}` })) }),
  }) } }
  const images = await withSignedImages(admin, [{ path: 'tenant/pro/exercise/a.webp', alt: 'Vista laterale' }])
  assert.deepEqual(images, [{ path: 'tenant/pro/exercise/a.webp', alt: 'Vista laterale', url: 'signed:tenant/pro/exercise/a.webp' }])
})
