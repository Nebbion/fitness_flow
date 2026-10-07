# Attivazione promemoria WhatsApp

Il codice invia messaggi reali tramite WhatsApp Cloud API. Non contiene una modalita simulata. La funzione diventa operativa solo dopo migrazione database, configurazione Meta, deploy e attivazione di uno scheduler esterno.

## Variabili di ambiente

- `NEXT_PUBLIC_META_APP_ID`: ID dell'app Meta.
- `NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID`: configurazione Embedded Signup.
- `META_APP_SECRET`: App Secret; firma e verifica i webhook.
- `META_GRAPH_API_VERSION`: versione Graph, per esempio `v21.0`.
- `WHATSAPP_VERIFY_TOKEN`: valore casuale condiviso con la configurazione webhook Meta.
- `WHATSAPP_TOKEN_ENCRYPTION_KEY`: 32 byte casuali in base64url; non deve cambiare dopo aver collegato i numeri.
- `SUPABASE_SERVICE_ROLE_KEY`: usata esclusivamente nelle API server.
- `REMINDER_SCHEDULER_SECRET`: segreto server-side che protegge `/api/scheduler/appointment-reminders`. Deve essere lungo e casuale e non deve avere prefisso `NEXT_PUBLIC_`.

Generazione consigliata dei segreti:

```bash
openssl rand -base64 32
```

Per `WHATSAPP_TOKEN_ENCRYPTION_KEY` convertire il risultato in base64url oppure generarlo con uno strumento che produca 32 byte in base64url.

## Template Meta

Creare e far approvare un template `appointment_reminder` nella lingua `it`. Il body deve avere cinque variabili, in questo ordine:

1. nome cliente;
2. nome professionista;
3. data appuntamento;
4. ora appuntamento;
5. servizio.

Se si usa un nome o una lingua diversa, ogni professionista deve indicarli in Impostazioni > WhatsApp. Un template non approvato produce un errore reale registrato nel tentativo e nel log messaggi.

## Passaggi esterni

1. Applicare `supabase/migrations/010_reminders_training.sql` al database di staging e poi di produzione.
2. Configurare in Meta il callback HTTPS `/api/webhooks/whatsapp`, il verify token e la sottoscrizione al campo `messages`.
3. Configurare Embedded Signup con le autorizzazioni WhatsApp Business necessarie.
4. Collegare un numero per ciascun professionista dalla sua pagina Impostazioni > WhatsApp.
5. Attivare i promemoria, scegliere anticipo, fuso, template e lingua.
6. Registrare sul cliente il consenso ai promemoria WhatsApp.
7. Configurare `REMINDER_SCHEDULER_SECRET` nelle variabili Production di Vercel e ridistribuire l'applicazione.
8. In uno scheduler esterno creare una chiamata ogni cinque minuti:

   - URL: `https://<dominio-fitnessflow>/api/scheduler/appointment-reminders`
   - metodo: `POST` (oppure `GET` se il provider non supporta `POST`)
   - header: `Authorization: Bearer <REMINDER_SCHEDULER_SECRET>`
   - frequenza cron: `*/5 * * * *`
   - timeout: almeno 60 secondi

Il job non e presente in `vercel.json`, perche Vercel Hobby non accetta questa frequenza. Lo scheduler esterno deve essere configurato separatamente: fino a quel momento i promemoria non partono automaticamente.

## Concorrenza e invii duplicati

La funzione database `claim_appointment_reminders` seleziona i record con `FOR UPDATE SKIP LOCKED`, li marca `claimed` e assegna un `claim_token` univoco. `begin_reminder_send` accetta solo lo stesso token e porta atomicamente il record a `sending`; per appuntamento e versione esiste inoltre un vincolo univoco. Chiamate simultanee dell'endpoint non possono quindi acquisire lo stesso promemoria.

Se il worker si interrompe dopo aver iniziato la richiesta a Meta, il record diventa `unknown` e non viene reinviato automaticamente: l'esito va verificato su Meta. Solo errori esplicitamente retryable vengono rimessi in coda, fino al limite previsto.

## Verifica endpoint

Una richiesta senza header o con un segreto errato deve restituire `401`. Una richiesta autorizzata restituisce `200` con il numero di record elaborati, anche quando e zero:

```bash
curl -i -X POST \
  -H "Authorization: Bearer $REMINDER_SCHEDULER_SECRET" \
  https://<dominio-fitnessflow>/api/scheduler/appointment-reminders
```

## Verifica operativa

Creare un appuntamento reale con un cliente consenziente e numero internazionale valido, assegnarlo al professionista collegato e impostarlo nella finestra di invio. Richiamare l'endpoint con il segreto corretto, verificare in database `appointment_reminders`, `reminder_attempts` e `whatsapp_messages`, poi controllare lo stato consegnato nel webhook Meta. Una risposta simulata o il solo stato `sent` locale non dimostrano la consegna.
