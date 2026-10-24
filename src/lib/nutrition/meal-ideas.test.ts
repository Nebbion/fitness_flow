import test from 'node:test'
import assert from 'node:assert/strict'
import {
  matchesMealIdeaImageSignature,
  mealIdeaInputSchema,
  ownsMealIdeaMediaPathForIdea,
} from './meal-ideas.ts'

test('le immagini Idee Pasti restano isolate per singola idea', () => {
  assert.equal(ownsMealIdeaMediaPathForIdea('tenant/pro/idea/file.jpg', 'tenant', 'pro', 'idea'), true)
  assert.equal(ownsMealIdeaMediaPathForIdea('tenant/pro/altra/file.jpg', 'tenant', 'pro', 'idea'), false)
})

test('accetta solo firme immagine coerenti', () => {
  assert.equal(matchesMealIdeaImageSignature(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg'), true)
  assert.equal(matchesMealIdeaImageSignature(new TextEncoder().encode('not-an-image'), 'image/jpeg'), false)
})

test('i link delle idee pasto accettano solo http e https', () => {
  assert.equal(mealIdeaInputSchema.safeParse({ title: 'Ricetta', sourceUrl: 'https://example.com' }).success, true)
  assert.equal(mealIdeaInputSchema.safeParse({ title: 'Ricetta', sourceUrl: 'javascript:alert(1)' }).success, false)
})
