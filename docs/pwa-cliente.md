# PWA area cliente

L'area cliente è disponibile come PWA installabile e usa lo stesso backend Next.js e lo stesso progetto Supabase del gestionale.

## Accesso

- **Senza registrazione:** dalla scheda cliente nel gestionale, aprire **Schede → Link personale cliente → Crea link**. Il token casuale è mostrato solo nell'URL, mentre nel database viene salvato esclusivamente il suo hash. Il link scade dopo 180 giorni, può essere rigenerato e può essere revocato immediatamente.
- **Con account portale:** il cliente può usare il portale esistente; l'installazione parte dalla pagina Scheda.

Le API del link personale verificano scadenza e revoca e applicano sempre insieme `client_id` e `tenant_id`. Le query tramite service role non accettano identificativi dal browser. Le scritture passano per le funzioni SQL esistenti, che verificano proprietario, versione della sessione e `mutationId`.

## Installazione

### iPhone / iPad

1. Aprire il link in Safari.
2. Toccare **Condividi**.
3. Selezionare **Aggiungi alla schermata Home**.
4. Confermare con **Aggiungi**.

### Android

1. Aprire il link in Chrome.
2. Usare il pulsante **Installa app** nell'intestazione; in alternativa aprire il menu `⋮`.
3. Selezionare **Installa app** o **Aggiungi a schermata Home**.

## Salvataggio e interruzioni

Le modifiche vengono salvate automaticamente dopo 900 ms. Prima della richiesta viene conservata localmente una bozza associata alla sessione e una mutazione con UUID stabile. In caso di timeout o perdita di rete, il retry riusa lo stesso UUID; il server restituisce la sessione già aggiornata invece di applicare due volte la stessa mutazione. Lo stato passa a **Salvato** soltanto quando la risposta server contiene lo stesso `last_mutation`.

La bozza viene eliminata dopo la conferma. Se il server contiene una versione più recente e diversa, l'app conserva la bozza ma non sovrascrive automaticamente il server.

Il service worker usa una allowlist limitata a icone e pagina offline neutra. Navigazioni, API, schede, sessioni, storico e appuntamenti non vengono mai inseriti nella sua cache.

## Verifica manuale consigliata

1. Generare un link personale e aprirlo in una finestra privata.
2. Controllare le quattro voci: **Scheda**, **Allenamento**, **Storico**, **Appuntamenti**.
3. Avviare un allenamento, modificare ripetizioni e peso e osservare `Modifiche da salvare → Salvataggio… → Salvato HH:MM`.
4. In DevTools attivare Offline, cambiare un valore, ricaricare, poi ripristinare la rete. La bozza deve ricomparire e il retry deve produrre un solo incremento di versione.
5. Rigenerare o revocare il link dal gestionale e verificare che il vecchio URL risponda `Link scaduto o revocato`.
6. Modificare una scheda dopo aver concluso una sessione e verificare che lo Storico mostri ancora il precedente `plan_snapshot`.
7. Installare su iOS e Android e controllare icona, avvio standalone, safe area e ritorno alla stessa area personale.
