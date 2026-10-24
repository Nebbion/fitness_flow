# Billing Stripe

FitnessFlow usa Stripe Checkout per il primo abbonamento, il Customer Portal per metodo di pagamento/cambio piano e i webhook come unica fonte attendibile dello stato dell’abbonamento.

## 1. Prodotti e prezzi

Nel catalogo prodotti Stripe crea tre prezzi ricorrenti mensili in EUR:

| Piano | Prezzo | Variabile ambiente |
|---|---:|---|
| Starter | 29 €/mese | `STRIPE_PRICE_STARTER` |
| Professional | 59 €/mese | `STRIPE_PRICE_PROFESSIONAL` |
| Business | 99 €/mese | `STRIPE_PRICE_BUSINESS` |

Inserisci nelle variabili il Price ID (`price_...`), non il Product ID (`prod_...`). Test e produzione hanno ID e chiavi differenti.

## 2. Variabili server

```dotenv
NEXT_PUBLIC_APP_URL=https://app.example.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_BUSINESS=price_...
```

`STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` devono esistere solo sul server. L’attuale Checkout ospitato non richiede la publishable key nel browser.

## 3. Customer Portal

Nel Dashboard Stripe attiva il Customer Portal e configura:

- aggiornamento del metodo di pagamento;
- storico fatture;
- cancellazione dell’abbonamento;
- cambio tra i tre prezzi mensili, se si vuole consentire upgrade e downgrade autonomi.

Quando esiste già una subscription, il pulsante del piano apre il portale per evitare abbonamenti duplicati.

## 4. Webhook

Registra questo endpoint pubblico:

```text
https://app.example.com/api/webhooks/stripe
```

Eventi richiesti:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Il webhook verifica la firma sul body raw, registra ogni evento e ignora in modo idempotente le consegne duplicate. Il piano nel database viene aggiornato solo dal webhook, non dal redirect di successo del browser.

Per lo sviluppo locale:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copia il `whsec_...` stampato dalla CLI in `STRIPE_WEBHOOK_SECRET` e usa chiavi/Price ID di test.

## 5. Deploy

1. Applica le migrazioni Supabase con `npm run db:push`.
2. Configura le variabili ambiente sul provider di hosting.
3. Esegui il deploy dell’app.
4. Configura il webhook Stripe sull’URL di produzione.
5. Completa un checkout in modalità test e verifica sia il tenant sia `subscription_events`.

## Trial e quote

Il trial è interno a FitnessFlow: dura 30 giorni, consente 10 clienti e non crea una trial subscription Stripe. Al checkout parte subito il piano a pagamento.

Le quote commerciali, inclusi clienti e AI, vivono in `src/lib/billing/plans.ts`. Le quote AI mensili predefinite sono 10, 100, 500 e 2.000 generazioni; ogni richiesta viene prenotata atomicamente prima di contattare il provider AI.
