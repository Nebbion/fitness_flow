# FitnessFlow — panoramica tecnica e configurazione comunicazioni

Documento aggiornato al 19 ottobre 2026. Descrive lo stato effettivo del codice senza entrare nei dettagli di ogni componente.

## 1. Cos'e il progetto

FitnessFlow e una piattaforma SaaS multi-tenant per professionisti del fitness e del benessere. Ogni studio e un `tenant`; dati e accessi sono separati tramite PostgreSQL Row Level Security.

Stack principale:

- Next.js App Router, React e TypeScript;
- Supabase per database PostgreSQL, autenticazione e file;
- Vercel per il deploy dell'applicazione;
- Stripe per abbonamenti e pagamenti;
- OpenAI per le funzioni AI;
- Supabase Auth e Resend per le email;
- Meta WhatsApp Cloud API per conferme e promemoria;
- n8n opzionale per automazioni esterne.

Le aree gia presenti nel codice comprendono autenticazione e ruoli, onboarding dello studio, clienti, staff, servizi, appuntamenti, portale cliente, schede di allenamento, piani alimentari, progressi, AI, billing e amministrazione globale.

## 2. Architettura in breve

```text
Browser
  -> pagine Next.js e Route Handler /api/*
       -> Supabase Auth (sessioni, inviti, recupero password)
       -> Supabase PostgreSQL (dati applicativi e RLS)
       -> Supabase Storage (documenti e immagini)
       -> Stripe / OpenAI / Meta / n8n

Meta WhatsApp
  -> /api/webhooks/whatsapp

Scheduler esterno, ogni 5 minuti
  -> /api/scheduler/appointment-reminders
       -> Meta WhatsApp Cloud API
```

I ruoli applicativi sono `SUPER_ADMIN`, `TENANT_ADMIN`, `STAFF` e `CLIENT`. Le route del portale e delle dashboard sono protette dal middleware; webhook e job pianificati hanno protezioni proprie.

Le migrazioni SQL sono in `supabase/migrations/`. In particolare, `009_whatsapp_connections.sql` introduce le connessioni WhatsApp e `010_reminders_training.sql` aggiunge consenso, configurazione e coda dei promemoria.

## 3. Configurazione email

### Stato attuale

Nel progetto esistono due sistemi distinti:

1. **Email di autenticazione, attive** — registrazione, invito staff, invito al portale cliente, magic link e recupero password sono inviati da **Supabase Auth**.
2. **Email applicative, predisposte ma non ancora collegate** — `src/lib/resend/emails.ts` contiene il client Resend e i template per benvenuto, conferma, promemoria, follow-up e invito al portale. Al momento `sendEmail()` non e richiamata da route o job, quindi le sole variabili `RESEND_*` non attivano queste email.

Anche la tabella `email_logs` e le regole email in `notification_rules` esistono, ma il flusso applicativo non le aggiorna ancora.

### Configurare le email oggi, in produzione

Il percorso consigliato e usare Resend come SMTP personalizzato di Supabase Auth:

1. In Resend aggiungere e verificare un dominio mittente, configurando nel DNS i record richiesti da Resend (SPF e DKIM).
2. Creare una API key dedicata all'invio.
3. In **Supabase Dashboard > Authentication > Emails > SMTP Settings** abilitare il provider SMTP personalizzato.
4. Impostare:

   | Campo | Valore |
   |---|---|
   | Host | `smtp.resend.com` |
   | Porta | `465` |
   | Username | `resend` |
   | Password | API key Resend |
   | Sender email | un indirizzo del dominio verificato, per esempio `no-reply@auth.example.com` |
   | Sender name | `FitnessFlow` oppure il nome commerciale |

5. In **Authentication > URL Configuration** impostare il dominio pubblico come Site URL e autorizzare almeno:

   ```text
   https://DOMINIO/it/auth/callback
   https://DOMINIO/en/auth/callback
   http://localhost:3000/it/auth/callback
   http://localhost:3000/en/auth/callback
   ```

6. In **Authentication > Email Templates** verificare i template `Confirm signup`, `Invite user`, `Magic link` e `Reset password`. Devono conservare il link/token generato da Supabase.
7. Disabilitare il click tracking del provider sulle email di autenticazione: la riscrittura dei link monouso puo interferire con il callback.
8. Controllare i rate limit Auth prima dell'apertura al pubblico.

Per lo sviluppo con Supabase locale le email vengono intercettate da Mailpit; il suo URL e mostrato da `supabase status`.

Riferimenti ufficiali: [SMTP personalizzato Supabase](https://supabase.com/docs/guides/auth/auth-smtp), [integrazione Supabase/Resend](https://resend.com/supabase), [SMTP Resend](https://resend.com/changelog/smtp-service).

### Variabili Resend dell'applicazione

Serviranno quando verra collegato il flusso delle email applicative:

```dotenv
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=FitnessFlow <no-reply@example.com>
```

Queste variabili vanno salvate solo lato server, per ogni ambiente Vercel, e richiedono un nuovo deploy. `RESEND_FROM_EMAIL` deve appartenere a un dominio verificato. Non sostituiscono la configurazione SMTP di Supabase Auth.

### Test email minimo

- registrare un nuovo account e aprire la conferma nello stesso browser;
- invitare un membro staff;
- invitare un cliente al portale, sia nuovo sia gia esistente;
- richiedere il recupero password;
- verificare Auth Logs in Supabase e Delivery Logs in Resend;
- provare sia italiano sia inglese e controllare i redirect finali.

## 4. Configurazione WhatsApp

### Come funziona

FitnessFlow usa una singola app Meta della piattaforma e **una connessione WhatsApp per ciascun professionista**. Da **Dashboard > Impostazioni > WhatsApp**, il professionista avvia Meta Embedded Signup. Il backend scambia il codice ricevuto con un access token, verifica il numero e salva il token cifrato in `whatsapp_connections`.

Sono implementati:

- conferma immediata quando viene creato un appuntamento;
- promemoria pianificato con anticipo configurabile;
- webhook per stato `sent`, `delivered` e `read`;
- salvataggio dei messaggi in ingresso;
- retry limitato per rate limit e gestione prudente degli esiti incerti.

### Variabili necessarie

```dotenv
# Valori pubblici usati da Meta Embedded Signup nel browser
NEXT_PUBLIC_META_APP_ID=...
NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID=...

# Segreti esclusivamente server-side
META_APP_SECRET=...
META_GRAPH_API_VERSION=v21.0
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_TOKEN_ENCRYPTION_KEY=...
REMINDER_SCHEDULER_SECRET=...

# Facoltativo; default https://graph.facebook.com/v21.0
WHATSAPP_API_URL=https://graph.facebook.com/v21.0

# Facoltativo; sovrascrive il nome template della conferma
WHATSAPP_APPOINTMENT_CONFIRMATION_TEMPLATE=appt_confirmation
```

Generazione dei segreti:

```bash
openssl rand -hex 32
openssl rand -base64 32 | tr -d '\n' | tr '+/' '-_' | tr -d '='
```

Usare il primo valore per verify token o scheduler secret e il secondo per `WHATSAPP_TOKEN_ENCRYPTION_KEY`. La chiave di cifratura deve decodificare esattamente 32 byte e **non deve essere cambiata** dopo il collegamento dei numeri, altrimenti i token gia salvati non saranno piu leggibili.

Le vecchie variabili globali `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_ACCESS_TOKEN` non sono lette dall'implementazione corrente: sono state sostituite dalle connessioni cifrate per professionista.

### Configurazione nell'account Meta

1. Creare/configurare una Meta App di tipo Business e aggiungere il prodotto WhatsApp.
2. Configurare Embedded Signup e copiare App ID e Configuration ID nelle variabili sopra.
3. Abilitare nella configurazione le autorizzazioni necessarie a gestire l'account WhatsApp Business e inviare messaggi.
4. Configurare il webhook:

   ```text
   Callback URL: https://DOMINIO/api/webhooks/whatsapp
   Verify token: lo stesso valore di WHATSAPP_VERIFY_TOKEN
   Campo sottoscritto: messages
   ```

5. Assicurarsi che l'app in produzione, il business e i numeri siano nello stato richiesto da Meta.
6. Salvare le variabili in Vercel Production e ridistribuire.
7. Da ogni account professionista aprire **Impostazioni > WhatsApp** e collegare il proprio numero.

Il webhook `POST` verifica la firma `X-Hub-Signature-256` con `META_APP_SECRET`; il verify token protegge invece l'handshake `GET` iniziale.

### Template da approvare

I nomi e le lingue devono coincidere esattamente con quelli approvati in WhatsApp Manager.

| Uso | Nome atteso di default | Variabili body, in ordine |
|---|---|---|
| Conferma appuntamento | `appt_confirmation` | cliente, studio, data, ora, servizio |
| Promemoria | `appointment_reminder` | cliente, professionista, data, ora, servizio |

La lingua viene inviata come `it` o `en`. Se in Meta e registrato un codice diverso, occorre allineare il template e il codice applicativo/configurato.

Per la conferma, il nome puo essere sovrascritto con `WHATSAPP_APPOINTMENT_CONFIRMATION_TEMPLATE`. Per il promemoria, nome, lingua, anticipo e fuso sono salvati dal pannello WhatsApp del professionista.

### Attivare i promemoria

1. Applicare tutte le migrazioni Supabase, incluse `009` e `010`.
2. Nel cliente salvare un numero internazionale, per esempio `+393331234567`, e attivare il consenso ai promemoria WhatsApp.
3. Nel pannello WhatsApp del professionista abilitare i promemoria e salvare anticipo, template, lingua e fuso.
4. Configurare uno scheduler esterno ogni cinque minuti:

   ```text
   POST https://DOMINIO/api/scheduler/appointment-reminders
   Authorization: Bearer VALORE_REMINDER_SCHEDULER_SECRET
   Cron: */5 * * * *
   Timeout: almeno 60 secondi
   ```

   Anche `GET` e supportato per scheduler che non permettono `POST`.

5. Non basta impostare la variabile: `vercel.json` non contiene un cron a cinque minuti, quindi il job esterno e obbligatorio.

Le conferme immediate richiedono invece una regola attiva `appointment_created`/`whatsapp`, il numero cliente e una connessione attiva del professionista assegnato.

### Test WhatsApp minimo

- verificare che `/api/integrations/whatsapp/status` restituisca `setupReady: true`;
- completare Embedded Signup e controllare numero e nome verificato nel pannello;
- creare in WhatsApp Manager entrambi i template e attendere lo stato approvato;
- creare un appuntamento futuro assegnato al professionista collegato;
- per il promemoria, attivare esplicitamente il consenso del cliente;
- chiamare lo scheduler con il Bearer secret e attendersi HTTP `200`;
- controllare `whatsapp_messages`, `appointment_reminders` e `reminder_attempts`;
- controllare nel webhook il passaggio a `delivered` o `read`: il solo stato locale `sent` non prova la consegna.

La guida operativa piu dettagliata e in [`docs/whatsapp-reminders.md`](./whatsapp-reminders.md).

## 5. Attenzioni e lavoro ancora da completare

- Le email applicative Resend non sono ancora inviate; va implementato il collegamento tra eventi, `notification_rules`, `sendEmail()` ed `email_logs`.
- Il webhook n8n `appointment_created` e gia richiamato alla creazione dell'appuntamento. Se un workflow n8n invia notifiche, evitare duplicati con quelle native.
- La conferma WhatsApp immediata oggi non controlla `whatsapp_reminders_consent`; il consenso e controllato solo per i promemoria. Va definita e applicata la base giuridica desiderata prima della produzione.
- La scadenza del token Meta viene salvata, ma non esiste ancora un job di rinnovo o un avviso automatico.
- La disconnessione marca la connessione come `disconnected`, senza cancellare il token cifrato.
- Il progetto locale contiene ancora nomi di variabili WhatsApp legacy: non considerarli prova che l'Embedded Signup sia configurato.

## 6. Checklist rapida per andare online

- [ ] Dominio applicazione e redirect Supabase configurati.
- [ ] Dominio email verificato in Resend.
- [ ] SMTP Resend collegato a Supabase Auth.
- [ ] Invito, conferma e recupero password testati.
- [ ] Migrazioni Supabase aggiornate.
- [ ] Meta App, Embedded Signup e webhook configurati.
- [ ] Variabili WhatsApp moderne impostate in Vercel.
- [ ] Template `appt_confirmation` e `appointment_reminder` approvati.
- [ ] Ogni professionista ha collegato il proprio numero.
- [ ] Consenso e numero internazionale presenti sui clienti.
- [ ] Scheduler esterno attivo ogni cinque minuti.
- [ ] Log email, WhatsApp e webhook monitorati.

