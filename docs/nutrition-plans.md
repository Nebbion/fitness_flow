# Piani alimentari

## Storico e rilevazioni

Applicare anche `016_multiple_client_plans.sql` prima del deploy della versione con piani multipli.
Il selettore **Piani alimentari e storico** apre un piano esistente; **Nuovo piano** crea un piano separato senza sovrascrivere i precedenti.
Le date sono facoltative per conservare i piani esistenti senza inventare periodi. Una data finale richiede una data iniziale e non puo precederla.
Le rilevazioni iniziali e finali appartengono al singolo piano: data, peso, FM, FFM, massa grassa percentuale, massa muscolare, acqua corporea, angolo di fase, resistenza, reattanza, vita e note.
Il cliente puo consultare e stampare ogni piano con periodo e confronto delle rilevazioni. Il salvataggio verifica la versione e segnala modifiche concorrenti.

## Verifica database locale

`supabase/multiple-plans.test.mjs` esegue le migrazioni in un database PGlite temporaneo, senza connessioni al progetto Supabase.
Richiede `@electric-sql/pglite`, disponibile tramite la variabile `PGLITE_MODULE` con percorso al modulo installato, oppure come dipendenza locale di test.
Verifica conservazione dei dati, selezione scheda, isolamento clienti, ruoli, link revocati, storico dei carichi e snapshot delle sessioni.

La funzione e disponibile per tenant con professione `nutritionist`.

1. Applicare `supabase/migrations/013_nutrition_plans.sql` con `npx supabase db push`.
2. Aprire **Dashboard > Alimentazione** e scegliere un cliente.
3. Inserire obiettivo, indicazioni, giorni, pasti e alimenti.
4. Calorie e macronutrienti vengono sommati solo quando sono compilati. Le alternative testuali non entrano nei totali.
5. Dopo il salvataggio il piano appare in **Portale cliente > Alimentazione** ed e stampabile in A4.

Le API verificano autenticazione, ruolo, professione, tenant e assegnazione del cliente. La tabella non e accessibile direttamente dai ruoli `anon` e `authenticated`; le operazioni passano dal server con service role.
