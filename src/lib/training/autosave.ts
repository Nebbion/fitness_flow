export type PendingMutationIdentity = { mutationId: string; version: number }
export type SessionMutationState = { last_mutation?: string | null; version: number; completed_at?: string | null }

export type PendingResolution = 'confirmed' | 'retry' | 'conflict'

export function reconcilePendingMutation(
  session: SessionMutationState,
  pending: PendingMutationIdentity,
): PendingResolution {
  if (session.last_mutation === pending.mutationId) return 'confirmed'
  if (!session.completed_at && session.version === pending.version) return 'retry'
  return 'conflict'
}

export function isMutationConfirmed(session: SessionMutationState | null | undefined, mutationId: string) {
  return session?.last_mutation === mutationId
}
