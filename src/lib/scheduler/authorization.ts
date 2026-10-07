import crypto from 'node:crypto'

export function isSchedulerAuthorized(
  authorization: string | null,
  secret = process.env.REMINDER_SCHEDULER_SECRET
) {
  if (!secret || !authorization?.startsWith('Bearer ')) return false

  const supplied = authorization.slice('Bearer '.length)
  const suppliedBuffer = Buffer.from(supplied)
  const secretBuffer = Buffer.from(secret)

  return suppliedBuffer.length === secretBuffer.length
    && crypto.timingSafeEqual(suppliedBuffer, secretBuffer)
}
