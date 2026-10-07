export interface WhatsAppTextMessage {
  to: string           // numero in formato internazionale es. +39333...
  body: string
}

export interface WhatsAppTemplateMessage {
  to: string
  templateName: string
  language: string
  components?: any[]
}

export interface WhatsAppConnectionCredentials {
  phoneNumberId: string
  accessToken: string
}

export interface WhatsAppSendResult {
  messageId?: string
  error?: string
  retryable?: boolean
  uncertain?: boolean
}

const BASE_URL = process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v21.0'

function normalizePhoneNumber(phone: string) {
  return phone.replace(/[^\d]/g, '').replace(/^00/, '')
}

async function sendMessage(
  credentials: WhatsAppConnectionCredentials,
  payload: Record<string, unknown>
) : Promise<WhatsAppSendResult> {
  try {
    const res = await fetch(`${BASE_URL}/${credentials.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        error: data.error?.message ?? `WhatsApp API error (${res.status})`,
        retryable: res.status === 429,
        uncertain: res.status === 408 || res.status >= 500,
      }
    }
    const messageId = data.messages?.[0]?.id as string | undefined
    return messageId
      ? { messageId }
      : { error: 'Meta non ha restituito l’ID del messaggio', uncertain: true }
  } catch (error: any) {
    // A network interruption may happen after Meta accepted the request.
    return { error: error.message ?? 'Errore di rete WhatsApp', uncertain: true }
  }
}

// Invia un messaggio di testo libero
export async function sendWhatsAppText(
  msg: WhatsAppTextMessage,
  credentials: WhatsAppConnectionCredentials
): Promise<WhatsAppSendResult> {
  return sendMessage(credentials, {
      recipient_type: 'individual',
      to: normalizePhoneNumber(msg.to),
      type: 'text',
      text: { body: msg.body, preview_url: false },
    })
}

export async function sendWhatsAppTemplate(
  msg: WhatsAppTemplateMessage,
  credentials: WhatsAppConnectionCredentials
): Promise<WhatsAppSendResult> {
  return sendMessage(credentials, {
      to: normalizePhoneNumber(msg.to),
      type: 'template',
      template: {
        name: msg.templateName,
        language: { code: msg.language },
        ...(msg.components ? { components: msg.components } : {}),
      },
    })
}

// Verifica webhook Meta (GET)
export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string
): string | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge
  }
  return null
}

// Interpreta il payload di un messaggio in arrivo
export function parseInboundMessage(body: any): {
  from: string
  messageId: string
  text: string
  timestamp: string
} | null {
  try {
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const message = changes?.value?.messages?.[0]

    if (!message) return null

    return {
      from: message.from,
      messageId: message.id,
      text: message.text?.body ?? '',
      timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
    }
  } catch {
    return null
  }
}
