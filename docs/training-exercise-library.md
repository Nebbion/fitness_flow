# Libreria esercizi e stampa scheda

## Flusso

1. Il professionista crea l'esercizio da **Dashboard > Esercizi**.
2. Configura serie e ripetizioni predefinite, istruzioni e fino a 6 immagini.
3. Nella scheda del cliente seleziona l'esercizio dalla libreria; nome, istruzioni e immagini vengono copiati nella scheda.
4. Quando il cliente avvia una sessione, la scheda completa viene salvata in `plan_snapshot`. Modifiche successive alla libreria non alterano sessioni o schede già salvate.
5. La scheda è disponibile sia dal link personale senza account sia da **Portale cliente > Scheda** e può essere stampata in formato A4.

Gli esercizi della libreria mantengono un ID stabile: selezionare lo stesso esercizio in schede successive permette di confrontare correttamente i carichi nei progressi.

## Immagini e sicurezza

- Bucket Supabase `exercise-media` privato.
- Formati consentiti: JPG, PNG, WebP e GIF.
- Limite: 5 MB per immagine e 6 immagini per esercizio.
- Upload e modifica richiedono un professionista autenticato e sono isolati per tenant e proprietario.
- Il link cliente riceve URL firmati temporanei solo per i percorsi presenti nella propria scheda.
- La rimozione di un esercizio dalla libreria non elimina subito i file, per non rompere gli snapshot storici che li utilizzano.

## Attivazione

Applicare la migrazione:

```bash
npx supabase db push
```

La migrazione `012_training_exercise_media.sql` crea la libreria e il bucket privato. Non sono richieste nuove variabili ambiente.
