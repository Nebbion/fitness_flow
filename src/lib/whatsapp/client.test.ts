import test from 'node:test'
import assert from 'node:assert/strict'
import { sendWhatsAppTemplate } from './client.ts'

const message = { to: '+39 333 1234567', templateName: 'appointment_reminder', language: 'it' }
const credentials = { phoneNumberId: '123', accessToken: 'secret' }

test('explicit Meta throttling is retryable', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Too many requests' } }), { status: 429 })
  try {
    const result = await sendWhatsAppTemplate(message, credentials)
    assert.equal(result.retryable, true)
    assert.equal(result.uncertain, false)
  } finally { globalThis.fetch = previous }
})

test('network interruption is uncertain and must not be retried automatically', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('connection reset') }
  try {
    const result = await sendWhatsAppTemplate(message, credentials)
    assert.equal(result.uncertain, true)
    assert.equal(result.retryable, undefined)
  } finally { globalThis.fetch = previous }
})

test('server errors are treated as uncertain to prevent duplicate delivery', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response('{}', { status: 503 })
  try {
    const result = await sendWhatsAppTemplate(message, credentials)
    assert.equal(result.uncertain, true)
    assert.equal(result.retryable, false)
  } finally { globalThis.fetch = previous }
})
