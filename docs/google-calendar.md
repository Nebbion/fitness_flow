# Collegamento Google Calendar

La prima fase dell'integrazione collega un account Google per ogni professionista e permette di scegliere un calendario scrivibile. Gli appuntamenti non vengono ancora importati da Google in questa fase.

## Configurazione Google Cloud

1. Creare o selezionare un progetto in Google Cloud Console.
2. Abilitare **Google Calendar API**.
3. Configurare Google Auth Platform: branding, audience e contatti.
4. Aggiungere gli scope:
   - `https://www.googleapis.com/auth/calendar.events`;
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`.
5. Creare un client OAuth 2.0 di tipo **Web application**.
6. Aggiungere tra gli URI di reindirizzamento autorizzati:

   ```text
   https://<dominio>/api/integrations/google-calendar/callback
   ```

   Per sviluppo locale usare anche:

   ```text
   http://localhost:3000/api/integrations/google-calendar/callback
   ```

Se l'app OAuth e in modalita Testing, aggiungere esplicitamente gli account dei professionisti come test user. Prima dell'uso pubblico potrebbe essere necessaria la verifica OAuth di Google per gli scope richiesti.

## Variabili d'ambiente

```text
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=https://<dominio>/api/integrations/google-calendar/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=
NEXT_PUBLIC_APP_URL=https://<dominio>
```

`GOOGLE_TOKEN_ENCRYPTION_KEY` deve rappresentare esattamente 32 byte casuali in base64url. Non deve essere cambiata dopo il collegamento degli account, altrimenti i refresh token salvati non saranno piu decifrabili.

## Database e verifica

1. Applicare `supabase/migrations/020_google_calendar_connections.sql` e `supabase/migrations/021_google_calendar_attendee_status.sql`.
2. Distribuire l'app con le variabili d'ambiente configurate.
3. Aprire **Impostazioni > Calendario**.
4. Selezionare **Collega Google Calendar** e completare il consenso Google.
5. Scegliere uno dei calendari scrivibili e salvarlo.
6. Verificare che la tabella `google_calendar_connections` contenga una riga per il professionista. Il refresh token deve comparire soltanto nella colonna cifrata e non deve mai essere restituito dalle API browser.

## Sincronizzazione delle risposte

Quando il calendario Appuntamenti e aperto, FitnessFlow controlla Google Calendar all'apertura e poi ogni minuto. La risposta del cliente (`needsAction`, `accepted`, `tentative` o `declined`) viene salvata separatamente dallo stato dell'appuntamento.

- Un invito rifiutato viene evidenziato come tale, ma l'appuntamento resta attivo.
- Se l'organizzatore elimina l'evento dal proprio calendario Google, l'appuntamento viene annullato anche in FitnessFlow.
- La semplice rimozione dell'evento da parte dell'invitato e rilevabile solo quando Google la registra come risposta `declined`.

Il flusso OAuth usa `state` e PKCE, memorizzati temporaneamente in cookie HttpOnly con durata di dieci minuti. La disconnessione elimina la riga e quindi anche il token cifrato locale; gli eventuali eventi gia creati su Google non vengono rimossi.
