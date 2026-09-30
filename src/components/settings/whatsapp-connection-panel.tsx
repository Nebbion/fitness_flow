'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Link2, Loader2, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'

interface Connection {
  id: string
  display_phone_number: string | null
  verified_name: string | null
  status: 'active' | 'disconnected' | 'error'
  last_error: string | null
  connected_at: string
}

interface SignupData {
  phoneNumberId: string
  whatsappBusinessAccountId: string
}

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void
      login: (callback: (response: any) => void, options: Record<string, unknown>) => void
    }
  }
}

const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID
const metaConfigId = process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID

function loadMetaSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.FB) return resolve()

    const existing = document.getElementById('meta-facebook-sdk')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Impossibile caricare Meta')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'meta-facebook-sdk'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Impossibile caricare Meta'))
    document.body.appendChild(script)
  })
}

export function WhatsAppConnectionPanel() {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [setupReady, setSetupReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const signupDataRef = useRef<SignupData | null>(null)
  const signupResolverRef = useRef<((data: SignupData) => void) | null>(null)

  async function refreshStatus() {
    setLoading(true)
    try {
      const response = await fetch('/api/integrations/whatsapp/status')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Impossibile leggere lo stato WhatsApp')
      setConnection(data.connection)
      setSetupReady(data.setupReady)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshStatus()

    function onMetaMessage(event: MessageEvent) {
      const host = new URL(event.origin).hostname
      if (host !== 'www.facebook.com' && !host.endsWith('.facebook.com')) return

      const data = typeof event.data === 'string'
        ? (() => { try { return JSON.parse(event.data) } catch { return null } })()
        : event.data

      if (data?.type !== 'WA_EMBEDDED_SIGNUP' || data.event !== 'FINISH') return
      const signupData = {
        phoneNumberId: data.data?.phone_number_id,
        whatsappBusinessAccountId: data.data?.waba_id,
      }
      if (!signupData.phoneNumberId || !signupData.whatsappBusinessAccountId) return

      signupDataRef.current = signupData
      signupResolverRef.current?.(signupData)
      signupResolverRef.current = null
    }

    window.addEventListener('message', onMetaMessage)
    return () => window.removeEventListener('message', onMetaMessage)
  }, [])

  async function startConnection() {
    if (!setupReady || !metaAppId || !metaConfigId) {
      toast.error('L’amministratore deve prima configurare l’app Meta di FitnessFlow')
      return
    }

    setConnecting(true)
    signupDataRef.current = null

    try {
      await loadMetaSdk()
      window.FB?.init({ appId: metaAppId, cookie: true, xfbml: false, version: 'v21.0' })

      const setupPromise = new Promise<SignupData>(resolve => {
        signupResolverRef.current = resolve
      })
      const loginResponse = await new Promise<any>(resolve => {
        window.FB?.login(resolve, {
          config_id: metaConfigId,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {} },
        })
      })

      const code = loginResponse?.authResponse?.code
      if (!code) throw new Error('Collegamento annullato prima dell’autorizzazione')

      const signupData = signupDataRef.current ?? await setupPromise
      const response = await fetch('/api/integrations/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, ...signupData }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Collegamento WhatsApp non riuscito')

      toast.success('Numero WhatsApp Business collegato')
      await refreshStatus()
    } catch (error: any) {
      toast.error(error.message ?? 'Collegamento WhatsApp non riuscito')
    } finally {
      signupResolverRef.current = null
      setConnecting(false)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnettere questo numero WhatsApp? Le notifiche automatiche verranno sospese.')) return

    try {
      const response = await fetch('/api/integrations/whatsapp/disconnect', { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Disconnessione non riuscita')
      toast.success('Numero WhatsApp disconnesso')
      await refreshStatus()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  if (loading) {
    return <div className="h-36 rounded-lg bg-muted animate-pulse" />
  }

  const connected = connection?.status === 'active'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">WhatsApp Business</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {connected ? (
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{connection.verified_name ?? 'WhatsApp Business collegato'}</p>
                <p className="text-sm text-muted-foreground">{connection.display_phone_number ?? 'Numero verificato'}</p>
                <p className="text-xs text-muted-foreground mt-2">Le conferme degli appuntamenti usano questo numero.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={disconnect}>
              <Unplug className="w-4 h-4 mr-2" />
              Disconnetti
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Collega il numero WhatsApp Business del tuo studio per inviare conferme e reminder ai clienti.
            </p>
            {!setupReady && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                L’integrazione Meta non è ancora configurata da FitnessFlow.
              </p>
            )}
            {connection?.last_error && (
              <p className="text-sm text-destructive">{connection.last_error}</p>
            )}
            <Button onClick={startConnection} disabled={!setupReady || connecting}>
              {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
              Collega WhatsApp Business
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
