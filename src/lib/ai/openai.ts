import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export type AIFeature =
  | 'nutrition_plan'
  | 'meal_suggestions'
  | 'workout_plan'
  | 'workout_progression'
  | 'summarize_client'
  | 'draft_whatsapp'
  | 'draft_email'

// Prompts per professione e feature
export function buildSystemPrompt(profession: string, locale: string): string {
  const lang = locale === 'it' ? 'italiano' : 'English'

  const basePrompt = `Sei un assistente AI per professionisti del fitness e del benessere. 
Rispondi sempre in ${lang}. 
Sii professionale, preciso e conciso.
Non includere disclaimer medici a meno che non siano strettamente necessari.`

  const professionContext: Record<string, string> = {
    nutritionist: `Sei specializzato in nutrizione e dietologia. 
Conosci le linee guida LARN, i principi della dieta mediterranea, e le esigenze nutrizionali per diversi obiettivi (dimagrimento, massa muscolare, mantenimento).`,
    personal_trainer: `Sei specializzato in allenamento fisico e fitness. 
Conosci i principi di periodizzazione, progressione del carico, recupero muscolare e prevenzione degli infortuni.`,
    physiotherapist: `Sei specializzato in fisioterapia e riabilitazione. 
Conosci le principali patologie muscolo-scheletriche e i protocolli di recupero.`,
    osteopath: `Sei specializzato in osteopatia e trattamenti manuali.`,
    massage_therapist: `Sei specializzato in massoterapia e tecniche di trattamento corporeo.`,
  }

  return `${basePrompt}\n\n${professionContext[profession] ?? ''}`
}

export function buildUserPrompt(feature: AIFeature, context: AIPromptContext): string {
  const { clientName, clientData, customInstruction } = context

  const prompts: Record<AIFeature, string> = {
    nutrition_plan: `Crea un piano alimentare settimanale per il cliente ${clientName}.
Dati cliente: ${JSON.stringify(clientData, null, 2)}
${customInstruction ? `Istruzioni aggiuntive: ${customInstruction}` : ''}
Includi: obiettivi calorici, distribuzione dei macronutrienti, esempi di pasti per ogni giorno della settimana.`,

    meal_suggestions: `Suggerisci 5 idee pasto per il cliente ${clientName}.
Dati: ${JSON.stringify(clientData, null, 2)}
${customInstruction ? `Nota: ${customInstruction}` : ''}
Per ogni pasto indica: ingredienti, preparazione veloce, valori nutrizionali approssimativi.`,

    workout_plan: `Crea una scheda di allenamento settimanale per ${clientName}.
Dati cliente: ${JSON.stringify(clientData, null, 2)}
${customInstruction ? `Istruzioni: ${customInstruction}` : ''}
Includi: esercizi, serie, ripetizioni, tempi di recupero, note sulla forma.`,

    workout_progression: `Suggerisci una progressione di allenamento per il prossimo mese per ${clientName}.
Dati attuali: ${JSON.stringify(clientData, null, 2)}
${customInstruction ? `Note: ${customInstruction}` : ''}
Fornisci aumenti graduali di carico e volume.`,

    summarize_client: `Riassumi la storia clinica/sportiva del cliente ${clientName}.
Dati disponibili: ${JSON.stringify(clientData, null, 2)}
Fornisci un riassunto conciso in formato bullet point evidenziando: obiettivi, progressi, note importanti, prossimi step.`,

    draft_whatsapp: `Scrivi un messaggio WhatsApp professionale ma cordiale per ${clientName}.
${customInstruction ? `Oggetto del messaggio: ${customInstruction}` : 'Scrivi un messaggio di follow-up generico.'}
Il messaggio deve essere breve (max 3-4 righe), usa emoji con moderazione, usa il tu.`,

    draft_email: `Scrivi un'email professionale per ${clientName}.
${customInstruction ? `Oggetto/contenuto: ${customInstruction}` : 'Scrivi un\'email di follow-up professionale.'}
Includi: oggetto, corpo email formale ma cordiale, firma generica.`,
  }

  return prompts[feature] ?? customInstruction ?? 'Aiuta con questa richiesta.'
}

export interface AIPromptContext {
  clientName?: string
  clientData?: Record<string, any>
  customInstruction?: string
}

// Calcola il costo stimato in USD per i token usati (GPT-4o pricing)
export function calculateCost(promptTokens: number, completionTokens: number): number {
  // GPT-4o: $5/1M input, $15/1M output (al 2025)
  const inputCost = (promptTokens / 1_000_000) * 5
  const outputCost = (completionTokens / 1_000_000) * 15
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}
