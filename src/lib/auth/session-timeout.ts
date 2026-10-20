export const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000

export function getSessionIdleRemaining(lastActivityAt: number, now = Date.now()) {
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return 0
  return Math.max(0, SESSION_IDLE_TIMEOUT_MS - (now - lastActivityAt))
}
