# Cliente con piu professionisti

Un cliente puo essere collegato a piu studi/professionisti usando lo stesso indirizzo email. Ogni professionista mantiene un proprio record cliente: appuntamenti, documenti, misurazioni e piani creati nello studio restano isolati e visibili soltanto al relativo professionista.

## Collegamento

1. Il professionista crea il cliente nel proprio studio.
2. Invia l'invito al portale allo stesso indirizzo email gia usato dal cliente.
3. Il cliente usa lo stesso account e trova nel portale la scheda allenamento e/o il piano alimentare assegnati dai diversi professionisti.

Il portale aggrega soltanto i record cliente collegati all'account autenticato. Un professionista non acquisisce automaticamente accesso ai dati dell'altro.

## Condivisione facoltativa

Quando sono presenti almeno due professionisti, il cliente trova la pagina `Condivisioni` nel portale. Per ogni direzione puo autorizzare, oppure revocare, la consultazione in sola lettura di:

- schede allenamento;
- piani alimentari.

La condivisione e esplicita, puo essere revocata in qualsiasi momento e non abilita modifiche. Il professionista destinatario trova i dati autorizzati nella tab `Condivisi` del cliente.

## Migrazione richiesta

Applicare le migrazioni Supabase in ordine, inclusa `supabase/migrations/017_multi_professional_clients.sql`. La migrazione crea `client_data_shares`, abilita RLS e introduce la funzione server-side usata per le sessioni di allenamento multi-professionista.
