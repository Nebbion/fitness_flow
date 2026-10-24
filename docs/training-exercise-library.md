# Libreria esercizi e stampa scheda

## Flusso

1. Il professionista crea manualmente un esercizio da **Dashboard > Esercizi** oppure importa foto/PDF di una scheda con l'AI.
2. Prima dell'importazione definitiva, controlla e corregge nome, serie, ripetizioni, carico, isometria e note di ogni esercizio rilevato.
3. Gli esercizi confermati vengono aggiunti alla libreria del professionista; quelli con lo stesso nome di un esercizio esistente vengono ignorati per evitare duplicati.
4. Configura serie e ripetizioni predefinite, istruzioni e fino a 6 immagini.
5. Nella scheda del cliente seleziona l'esercizio dalla libreria; nome, istruzioni e immagini vengono copiati nella scheda.
6. Quando il cliente avvia una sessione, la scheda completa viene salvata in `plan_snapshot`. Modifiche successive alla libreria non alterano sessioni o schede già salvate.
7. La scheda è disponibile sia dal link personale senza account sia da **Portale cliente > Scheda** e può essere stampata in formato A4.

Gli esercizi della libreria mantengono un ID stabile: selezionare lo stesso esercizio in schede successive permette di confrontare correttamente i carichi nei progressi.

## Immagini e sicurezza

- Bucket Supabase `exercise-media` privato.
- Formati consentiti: JPG, PNG, WebP e GIF.
- Limite: 5 MB per immagine e 6 immagini per esercizio.
- Upload e modifica richiedono un professionista autenticato e sono isolati per tenant e proprietario.
- Il link cliente riceve URL firmati temporanei solo per i percorsi presenti nella propria scheda.
- La rimozione di un esercizio dalla libreria non elimina subito i file, per non rompere gli snapshot storici che li utilizzano.

## Importazione AI

- Input supportati: JPG, PNG, WebP e PDF, fino a 6 file, 8 MB ciascuno e 20 MB complessivi.
- Le foto molto grandi vengono ridimensionate nel browser prima del caricamento.
- I file sorgente usano il bucket privato `training-imports` e vengono eliminati subito dopo l'analisi.
- L'output OpenAI usa uno schema strutturato ed e sempre sottoposto alla conferma del professionista prima di modificare la libreria.
- I valori illeggibili vengono evidenziati nell'anteprima; serie e ripetizioni mancanti ricevono valori predefiniti chiaramente indicati.
- Il limite predefinito e 10 analisi per professionista al giorno, configurabile con `EXERCISE_IMPORT_AI_DAILY_LIMIT`.

## Attivazione

Applicare la migrazione:

```bash
npx supabase db push
```

La migrazione `012_training_exercise_media.sql` crea la libreria e il bucket delle immagini; `022_training_imports.sql` crea il bucket temporaneo per i documenti sorgente.

L'importazione richiede `OPENAI_API_KEY`. Facoltativamente si possono configurare `EXERCISE_IMPORT_AI_MODEL` e `EXERCISE_IMPORT_AI_DAILY_LIMIT`.
