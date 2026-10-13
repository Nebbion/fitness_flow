# Piani alimentari

La funzione e disponibile per tenant con professione `nutritionist`.

1. Applicare `supabase/migrations/013_nutrition_plans.sql` con `npx supabase db push`.
2. Aprire **Dashboard > Alimentazione** e scegliere un cliente.
3. Inserire obiettivo, indicazioni, giorni, pasti e alimenti.
4. Calorie e macronutrienti vengono sommati solo quando sono compilati. Le alternative testuali non entrano nei totali.
5. Dopo il salvataggio il piano appare in **Portale cliente > Alimentazione** ed e stampabile in A4.

Le API verificano autenticazione, ruolo, professione, tenant e assegnazione del cliente. La tabella non e accessibile direttamente dai ruoli `anon` e `authenticated`; le operazioni passano dal server con service role.
