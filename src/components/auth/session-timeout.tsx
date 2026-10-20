'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSessionIdleRemaining } from '@/lib/auth/session-timeout'

const ACTIVITY_WRITE_INTERVAL_MS = 10_000
const STORAGE_PREFIX = 'fitnessflow:session'
const CHANNEL_NAME = 'fitnessflow-session'

interface SessionTimeoutProps {
  userId: string
  sessionStartedAt: string
  loginPath: string
  locale: string
}

export function SessionTimeout({ userId, sessionStartedAt, loginPath, locale }: SessionTimeoutProps) {
  useEffect(() => {
    const activityKey = `${STORAGE_PREFIX}:activity:${userId}`
    const sessionKey = `${STORAGE_PREFIX}:started:${userId}`
    const expiredKey = `${STORAGE_PREFIX}:expired:${userId}`
    const supabase = createClient()
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME)
    let timer: ReturnType<typeof setTimeout> | undefined
    let signingOut = false
    let lastActivityWrite = 0

    const readActivity = () => {
      try {
        return Number(window.localStorage.getItem(activityKey))
      } catch {
        return lastActivityWrite
      }
    }

    const writeActivity = (timestamp: number) => {
      lastActivityWrite = timestamp
      try {
        window.localStorage.setItem(activityKey, String(timestamp))
      } catch {
        // Il timer continua a funzionare nella scheda corrente anche senza localStorage.
      }
    }

    const redirectToLogin = () => {
      const separator = loginPath.includes('?') ? '&' : '?'
      window.location.replace(`${loginPath}${separator}reason=inactive`)
    }

    const expireSession = async (announce = true) => {
      if (signingOut) return
      signingOut = true
      if (timer) clearTimeout(timer)

      if (announce) {
        channel?.postMessage({ type: 'expired', userId })
        try {
          window.localStorage.setItem(expiredKey, String(Date.now()))
        } catch {
          // La notifica tra schede tramite BroadcastChannel resta disponibile.
        }
      }

      await Promise.allSettled([
        supabase.auth.signOut(),
        fetch(`/api/auth/logout?locale=${encodeURIComponent(locale)}`, {
          method: 'POST',
          credentials: 'same-origin',
        }),
      ])
      redirectToLogin()
    }

    const scheduleExpiry = (lastActivityAt: number) => {
      if (timer) clearTimeout(timer)
      const remaining = getSessionIdleRemaining(lastActivityAt)
      if (remaining === 0) {
        void expireSession()
        return
      }
      timer = setTimeout(() => {
        const sharedActivity = readActivity() || lastActivityAt
        scheduleExpiry(sharedActivity)
      }, remaining)
    }

    const recordActivity = () => {
      if (signingOut) return
      const now = Date.now()
      if (now - lastActivityWrite < ACTIVITY_WRITE_INTERVAL_MS) return
      writeActivity(now)
      scheduleExpiry(now)
    }

    try {
      const storedSession = window.localStorage.getItem(sessionKey)
      if (storedSession !== sessionStartedAt) {
        window.localStorage.setItem(sessionKey, sessionStartedAt)
        writeActivity(Date.now())
      } else {
        const storedActivity = readActivity()
        if (storedActivity > 0) lastActivityWrite = storedActivity
        else writeActivity(Date.now())
      }
    } catch {
      writeActivity(Date.now())
    }

    scheduleExpiry(readActivity() || lastActivityWrite)

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'pointermove',
      'keydown',
      'scroll',
      'touchstart',
    ]
    activityEvents.forEach(event => window.addEventListener(event, recordActivity, { passive: true }))

    const handleStorage = (event: StorageEvent) => {
      if (event.key === activityKey && event.newValue) {
        const timestamp = Number(event.newValue)
        if (Number.isFinite(timestamp)) {
          lastActivityWrite = timestamp
          scheduleExpiry(timestamp)
        }
      }
      if (event.key === expiredKey && event.newValue) void expireSession(false)
    }
    window.addEventListener('storage', handleStorage)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        scheduleExpiry(readActivity() || lastActivityWrite)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    if (channel) {
      channel.onmessage = event => {
        if (event.data?.type === 'expired' && event.data?.userId === userId) {
          void expireSession(false)
        }
      }
    }

    return () => {
      if (timer) clearTimeout(timer)
      activityEvents.forEach(event => window.removeEventListener(event, recordActivity))
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibility)
      channel?.close()
    }
  }, [locale, loginPath, sessionStartedAt, userId])

  return null
}
