# I miei progressi

## Implementato

- L'area mobile usa lo stesso link personale della scheda: `/{locale}/train/{token}`.
- Il token casuale non viene salvato in chiaro. Il server cerca solo il relativo hash, verifica scadenza e revoca e applica sempre insieme `client_id` e `tenant_id` alle query.
- Ogni sessione salva una copia della scheda in `plan_snapshot`; modificare la scheda corrente non cambia le sessioni concluse.
- Sessioni, esercizi, serie, ripetizioni, kg, note di serie, note esercizio e note sessione restano persistenti.
- Il professionista vede lo storico (fino alle 100 sessioni più recenti) con tutte le note dalla scheda cliente.
- La dashboard offre filtri 1/3/6/12/24 mesi, stati di caricamento/errore/storico insufficiente e limita a 500 sessioni per richiesta dichiarando quando il risultato è parziale.

### Definizione metriche

- **Allenamenti**: sessioni completate nel periodo selezionato.
- **Serie registrate**: serie con almeno ripetizioni, kg o nota compilati.
- **Volume (kg·rip)**: somma di `ripetizioni × kg`; una serie priva di uno dei due valori non entra nel volume.
- **Carico esercizio**: massimo valore in kg registrato per quello specifico ID esercizio nella sessione. Esercizi con ID diversi non vengono accorpati, anche se hanno lo stesso nome.
- **Variazione**: differenza percentuale tra primo e ultimo carico disponibile; non viene calcolata con meno di due osservazioni o con valore iniziale zero.

Non vengono stimati o completati dati mancanti.

## Analisi AI

La route interattiva è `/api/training/{token}/progress`; n8n non è coinvolto.

Il server calcola prima le statistiche e invia al provider soltanto periodo, totali, qualità dei dati e serie aggregate per esercizio. Token, client ID, tenant ID, session ID e note libere non vengono inviati. La chiave API resta server-side.

La cache dipende da cliente, intervallo, provider, modello e hash delle versioni delle sessioni. Una nuova sessione o un nuovo salvataggio concluso cambia l'hash e invalida il risultato. Un vincolo univoco impedisce due elaborazioni concorrenti dello stesso insieme di dati. Le richieste vengono inoltre limitate per cliente nelle ultime 24 ore; il valore predefinito è 5.

Variabili server-side:

| Variabile | Necessaria | Descrizione |
|---|---:|---|
| `PROGRESS_AI_PROVIDER` | sì | `openai` oppure `openai-compatible` |
| `PROGRESS_AI_MODEL` | sì | Modello abilitato presso il provider scelto |
| `PROGRESS_AI_API_KEY` | sì | Chiave dedicata; per `openai` può essere sostituita da `OPENAI_API_KEY` |
| `PROGRESS_AI_BASE_URL` | solo provider compatibile | Base URL API compatibile OpenAI |
| `PROGRESS_AI_DAILY_LIMIT` | no | Intero 1-20, predefinito 5 |

Se la configurazione è assente o incompleta, l'interfaccia mostra **Analisi non attiva** e non prova a contattare alcun provider.

## Attivazione

1. Applicare in ordine le migrazioni `010_reminders_training.sql` e `011_training_progress_ai.sql` con `npx supabase db push`.
2. Configurare le variabili AI nell'ambiente server Vercel e ridistribuire l'app, solo se si desidera attivare l'analisi.
3. Creare o rigenerare dalla scheda cliente il link personale e aprirlo su mobile.

La migrazione `011` aggiunge le note di sessione, aggiorna la funzione atomica `training_session_write` e crea la cache AI con RLS attiva e accesso revocato ai ruoli `anon` e `authenticated`.

## Verifica locale

```bash
npm test
npm run build
```

I test coprono validazione e hashing del token, filtri di revoca/scadenza, calcoli di volume/carico, separazione per ID esercizio, esclusione di record non validi e assenza di identificativi/note nel payload AI.

Non è possibile validare una chiamata reale al modello senza una chiave e un modello attivi: questa rimane una verifica esterna successiva alla configurazione.
