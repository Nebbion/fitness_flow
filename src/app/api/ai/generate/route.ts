import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai, buildSystemPrompt, buildUserPrompt, calculateCost } from '@/lib/ai/openai'
import type { AIFeature } from '@/lib/ai/openai'

// Usa Edge runtime per supportare lo streaming senza timeout Vercel
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Non autenticato', { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) return new Response('Tenant non trovato', { status: 404 })

    // Recupera la professione del tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('profession, plan')
      .eq('id', profile.tenant_id)
      .single()

    const body = await request.json()
    const { feature, clientId, customInstruction, locale = 'it' } = body as {
      feature: AIFeature
      clientId?: string
      customInstruction?: string
      locale?: string
    }

    // Recupera dati cliente se fornito
    let clientData: Record<string, any> = {}
    let clientName = 'il cliente'

    if (clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('full_name, birth_date, gender, custom_fields, notes, tags')
        .eq('id', clientId)
        .eq('tenant_id', profile.tenant_id)
        .single()

      if (client) {
        clientName = client.full_name
        clientData = {
          nome: client.full_name,
          data_nascita: client.birth_date,
          sesso: client.gender,
          note: client.notes,
          tag: client.tags,
          ...client.custom_fields,
        }

        // Recupera ultimi progressi
        const { data: lastProgress } = await supabase
          .from('progress_entries')
          .select('weight_kg, body_fat_pct, muscle_mass_kg, recorded_at')
          .eq('client_id', clientId)
          .order('recorded_at', { ascending: false })
          .limit(3)

        if (lastProgress?.length) {
          clientData.progressi = lastProgress
        }
      }
    }

    const systemPrompt = buildSystemPrompt(tenant?.profession ?? 'other', locale)
    const userPrompt = buildUserPrompt(feature, { clientName, clientData, customInstruction })

    // Stream response da OpenAI
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
      stream: true,
    })

    // Traccia usage in background (non blocca lo stream)
    let totalPromptTokens = 0
    let totalCompletionTokens = 0

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? ''
            if (text) {
              controller.enqueue(encoder.encode(text))
            }
            // Accumula token usage dall'ultimo chunk
            if (chunk.usage) {
              totalPromptTokens = chunk.usage.prompt_tokens
              totalCompletionTokens = chunk.usage.completion_tokens
            }
          }
        } finally {
          controller.close()

          // Log usage (fire and forget)
          const cost = calculateCost(totalPromptTokens, totalCompletionTokens)
          fetch('/api/ai/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              feature,
              prompt_tokens: totalPromptTokens,
              completion_tokens: totalCompletionTokens,
              cost_usd: cost,
            }),
          }).catch(() => {})
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err: any) {
    console.error('AI generate error:', err)
    return new Response(err.message ?? 'Errore AI', { status: 500 })
  }
}
