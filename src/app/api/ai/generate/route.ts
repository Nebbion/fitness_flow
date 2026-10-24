import { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getOpenAIClient, buildSystemPrompt, buildUserPrompt, calculateCost, isAIFeature } from '@/lib/ai/openai'
import type { AIFeature } from '@/lib/ai/openai'
import { getCurrentUtcMonthStart, getPlanDefinition, hasSubscriptionAccess } from '@/lib/billing/plans'

// Usa Edge runtime per supportare lo streaming senza timeout Vercel
export const runtime = 'edge'

const AI_MODEL = 'gpt-4o'

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

    // Recupera professione e diritti del tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('profession, plan, status, trial_ends_at')
      .eq('id', profile.tenant_id)
      .single()

    if (!tenant) return new Response('Tenant non trovato', { status: 404 })
    if (!hasSubscriptionAccess(tenant)) {
      return new Response('Abbonamento non attivo. Scegli un piano per continuare.', { status: 402 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return new Response('Richiesta non valida', { status: 400 })
    const { feature, clientId, customInstruction, locale = 'it' } = body as {
      feature: AIFeature
      clientId?: string
      customInstruction?: string
      locale?: string
    }
    if (!isAIFeature(feature)) return new Response('Funzionalità AI non valida', { status: 400 })
    if (clientId != null && typeof clientId !== 'string') return new Response('Cliente non valido', { status: 400 })
    if (customInstruction != null && (typeof customInstruction !== 'string' || customInstruction.length > 4_000)) {
      return new Response('Istruzioni non valide o troppo lunghe', { status: 400 })
    }

    const plan = getPlanDefinition(tenant.plan)
    const admin = createAdminClient() as any
    const { data: usageId, error: reservationError } = await admin.rpc('reserve_ai_usage', {
      p_tenant_id: profile.tenant_id,
      p_user_id: user.id,
      p_feature: feature,
      p_model: AI_MODEL,
      p_monthly_limit: plan.aiMonthlyRequests,
    })

    if (reservationError) {
      console.error('AI usage reservation error:', reservationError)
      return new Response('Impossibile verificare la quota AI', { status: 500 })
    }
    if (!usageId) {
      return new Response('Hai raggiunto il limite AI mensile del tuo piano.', { status: 429 })
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
        const customFields = client.custom_fields
        const customFieldValues = customFields && typeof customFields === 'object' && !Array.isArray(customFields)
          ? customFields as Record<string, unknown>
          : {}
        clientData = {
          nome: client.full_name,
          data_nascita: client.birth_date,
          sesso: client.gender,
          note: client.notes,
          tag: client.tags,
          ...customFieldValues,
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

    const systemPrompt = buildSystemPrompt(tenant.profession ?? 'other', locale)
    const userPrompt = buildUserPrompt(feature, { clientName, clientData, customInstruction })

    // Stream response da OpenAI. Se la richiesta non parte, libera la prenotazione.
    let stream
    try {
      stream = await getOpenAIClient().chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: plan.aiMaxOutputTokens,
        temperature: 0.7,
        stream: true,
        stream_options: { include_usage: true },
      })
    } catch (error) {
      await admin.from('ai_usage_logs').delete().eq('id', usageId)
      throw error
    }

    // Traccia usage in background (non blocca lo stream)
    let totalPromptTokens = 0
    let totalCompletionTokens = 0

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let streamFailed = false
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
        } catch (error) {
          streamFailed = true
          controller.error(error)
        } finally {
          // Completa la prenotazione con i token effettivi. Anche una risposta
          // interrotta conta, perché può avere già generato costo sul provider.
          const cost = calculateCost(totalPromptTokens, totalCompletionTokens)
          await admin.from('ai_usage_logs').update({
            prompt_tokens: totalPromptTokens,
            completion_tokens: totalCompletionTokens,
            cost_usd: cost,
          }).eq('id', usageId)

          if (!streamFailed) controller.close()
        }
      },
    })

    const { count: usageCount } = await admin
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .gte('created_at', getCurrentUtcMonthStart().toISOString())

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Content-Type-Options': 'nosniff',
        'X-AI-Monthly-Limit': String(plan.aiMonthlyRequests),
        'X-AI-Monthly-Remaining': String(Math.max(0, plan.aiMonthlyRequests - (usageCount ?? 1))),
      },
    })
  } catch (err: any) {
    console.error('AI generate error:', err)
    return new Response(err.message ?? 'Errore AI', { status: 500 })
  }
}
