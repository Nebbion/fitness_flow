import crypto from 'node:crypto'

export const TRAINING_TOKEN_MIN_LENGTH = 40
export const TRAINING_TOKEN_MAX_LENGTH = 100

export function isValidTrainingToken(token: string) {
  return token.length >= TRAINING_TOKEN_MIN_LENGTH
    && token.length <= TRAINING_TOKEN_MAX_LENGTH
    && /^[A-Za-z0-9_-]+$/.test(token)
}

export function hashTrainingToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export type TrainingAccessScope = { client_id: string; tenant_id: string }

/** Applies both ownership dimensions to every service-role query. */
export function scopeToTrainingAccess<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  access: TrainingAccessScope,
) {
  return query.eq('client_id', access.client_id).eq('tenant_id', access.tenant_id)
}

export async function resolveTrainingAccess(admin: any, token: string) {
  if (!isValidTrainingToken(token)) return null

  const { data, error } = await admin
    .from('training_access')
    .select('client_id, tenant_id, expires_at, revoked_at')
    .eq('token_hash', hashTrainingToken(token))
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  return error ? null : data
}
