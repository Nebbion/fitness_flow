# Attivazione recupero password

Il flusso usa Supabase Auth e non richiede credenziali aggiuntive nell'applicazione.

Nel progetto Supabase, in Authentication > URL Configuration:

1. impostare il Site URL del deploy;
2. aggiungere agli URL di redirect consentiti `https://DOMINIO/it/auth/callback` e `https://DOMINIO/en/auth/callback`;
3. per lo sviluppo aggiungere anche gli equivalenti URL localhost;
4. verificare che il template email “Reset password” contenga il link di conferma generato da Supabase.

Il link porta prima al callback dell'applicazione, che scambia il codice monouso per una sessione e inoltra alla pagina di scelta della nuova password. Con il flusso PKCE deve essere aperto nello stesso browser usato per la richiesta. La risposta alla richiesta è sempre generica per non rivelare l'esistenza di un account.
