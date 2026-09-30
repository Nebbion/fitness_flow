import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey() {
  const value = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY
  if (!value) throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY non configurata')

  const key = Buffer.from(value, 'base64url')
  if (key.length !== 32) {
    throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY deve contenere 32 byte casuali in base64url')
  }

  return key
}

export function encryptWhatsAppToken(token: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv, tag, ciphertext].map(value => value.toString('base64url')).join('.')
}

export function decryptWhatsAppToken(value: string) {
  const [ivValue, tagValue, ciphertextValue] = value.split('.')
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Token WhatsApp cifrato non valido')
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
