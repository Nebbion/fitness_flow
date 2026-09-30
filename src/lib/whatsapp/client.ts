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

const BASE_URL = process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v21.0'
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN

// Invia un messaggio di testo libero
export async function sendWhatsAppText(
  msg: WhatsAppTextMessage
): Promise<{ messageId?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: msg.to.replace(/\s/g, ''),
        type: 'text',
        text: { body: msg.body, preview_url: false },
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? 'WhatsApp API error')

    return { messageId: data.messages?.[0]?.id }
  } catch (err: any) {
    return { error: err.message }
  }
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
