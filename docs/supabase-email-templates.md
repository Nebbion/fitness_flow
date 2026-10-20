# Template email portale cliente

Le email di autenticazione sono inviate da Supabase tramite SMTP Resend. I dati grafici vengono inseriti al momento dell'invito: nome dello studio, nome del professionista, colore primario e colore accento.

## Attivazione

1. Pubblicare la versione dell'app che contiene la route `/auth/confirm`.
2. In Supabase, impostare `https://fitness.nebbion.it` come Site URL e consentire `https://fitness.nebbion.it/**` nei Redirect URLs.
3. In **Authentication > Email Templates > Invite user**, incollare il contenuto di `supabase-invite-email-template.html`.
4. In **Authentication > Email Templates > Magic Link**, incollare il contenuto di `supabase-magic-link-email-template.html`.
5. Conservare le variabili `{{ .TokenHash }}`, `{{ .RedirectTo }}` e il valore corretto di `type` nei rispettivi pulsanti: sono necessarie per verificare il link lato server.
6. Inviare un nuovo invito dal gestionale e verificare che il link apra `/it/auth/reset-password?mode=invite`.

Il template **Invite user** porta alla scelta della password. Il template **Magic Link** e usato per i reinvii: porta al portale per chi ha gia impostato la password e alla scelta password per gli account storici che non l'hanno ancora fatto.

I link sono monouso e gestiti da Supabase. Non sostituire il pulsante con `{{ .ConfirmationURL }}`: quel formato restituisce la sessione nel fragment del browser e non e adatto alla route server-side di conferma dell'app.
