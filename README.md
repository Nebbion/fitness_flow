# FitnessFlow

Piattaforma SaaS multi-tenant per professionisti del fitness e del benessere.

## Stack Tecnologico

- **Frontend/Backend**: Next.js 15 App Router + TypeScript
- **Database/Auth/Storage**: Supabase (PostgreSQL + RLS)
- **Billing**: Stripe
- **Email**: Resend
- **Automazioni**: n8n (hosting esterno)
- **AI**: OpenAI GPT-4o
- **WhatsApp**: WhatsApp Business API
- **i18n**: next-intl (Italiano + Inglese)
- **Deploy**: Vercel

---

## Setup Iniziale

### 1. Clona e installa dipendenze

```bash
git clone https://github.com/tuo-utente/fitnessflow.git
cd fitnessflow
npm install
```

### 2. Configura le variabili d'ambiente

```bash
cp .env.local.example .env.local
```

Compila tutti i valori in `.env.local` (vedi sezione sotto).

### 3. Setup Supabase

#### Opzione A — Supabase Cloud (consigliato per produzione)

1. Crea un progetto su [supabase.com](https://supabase.com)
2. Copia l'URL del progetto e le API keys in `.env.local`
3. Applica le migrations:

```bash
npx supabase login
npx supabase link --project-ref TUO_PROJECT_REF
npx supabase db push
```

#### Opzione B — Supabase locale (sviluppo)

```bash
npx supabase start
npx supabase db reset  # applica tutte le migrations
```

### 4. Configura JWT Hook in Supabase

Dopo aver applicato le migrations, vai in:
**Supabase Dashboard → Authentication → Hooks**

Aggiungi un hook **"Custom Access Token"**:
- Schema: `public`
- Function: `custom_jwt_claims`

Questo inietta `tenant_id`, `user_role` e `profession` nel JWT.

### 5. Avvia il server di sviluppo

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

---

## Struttura Variabili d'Ambiente

### Supabase
| Variabile | Descrizione |
|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chiave pubblica (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave service role (solo server) |
| `DATABASE_POOL_URL` | Stringa connessione PgBouncer porta 6543 |
| `SUPER_ADMIN_BOOTSTRAP_TOKEN` | Token temporaneo per promuovere il primo super admin |

### Stripe
| Variabile | Descrizione |
|-----------|-------------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chiave pubblica Stripe |
| `STRIPE_SECRET_KEY` | Chiave segreta Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret per verifica webhook |
| `STRIPE_PRICE_STARTER` | Price ID piano Starter |
| `STRIPE_PRICE_PROFESSIONAL` | Price ID piano Professional |
| `STRIPE_PRICE_BUSINESS` | Price ID piano Business |

### OpenAI
| Variabile | Descrizione |
|-----------|-------------|
| `OPENAI_API_KEY` | API key OpenAI |
| `PROGRESS_AI_PROVIDER` | Provider progressi: `openai` o `openai-compatible` |
| `PROGRESS_AI_MODEL` | Modello usato per l'analisi progressi |
| `PROGRESS_AI_API_KEY` | API key dedicata opzionale (fallback a `OPENAI_API_KEY` per OpenAI) |
| `PROGRESS_AI_BASE_URL` | Base URL richiesta per provider OpenAI-compatible |
| `PROGRESS_AI_DAILY_LIMIT` | Analisi per cliente nelle ultime 24 ore (default 5, max 20) |

Configurazione e garanzie di privacy della dashboard: [`docs/training-progress.md`](docs/training-progress.md).

### Resend
| Variabile | Descrizione |
|-----------|-------------|
| `RESEND_API_KEY` | API key Resend |
| `RESEND_FROM_EMAIL` | Email mittente |

### WhatsApp
| Variabile | Descrizione |
|-----------|-------------|
| `WHATSAPP_API_URL` | URL Meta Graph API |
| `WHATSAPP_PHONE_NUMBER_ID` | ID numero WhatsApp Business |
| `WHATSAPP_ACCESS_TOKEN` | Token di accesso permanente |
| `WHATSAPP_VERIFY_TOKEN` | Token per verifica webhook |

## Bootstrap Super Admin

Il ruolo `SUPER_ADMIN` gestisce i professionisti/tenant dalla sezione `/admin`.
Per creare il primo super admin:

1. Registrati normalmente con l'email che dovra diventare super admin.
2. Imposta `SUPER_ADMIN_BOOTSTRAP_TOKEN` nelle variabili d'ambiente.
3. Chiama una sola volta:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/admin/bootstrap" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","token":"VALORE_SUPER_ADMIN_BOOTSTRAP_TOKEN"}'
```

L'endpoint funziona solo se non esiste gia nessun profilo `SUPER_ADMIN`.
Dopo il bootstrap, rimuovi o ruota `SUPER_ADMIN_BOOTSTRAP_TOKEN`.

---

## Struttura Database (Migrations)

Le migrations si trovano in `supabase/migrations/`:

| File | Contenuto |
|------|-----------|
| `001_core_schema.sql` | Tabelle principali (tenants, profiles, clients, services, appointments, documents, progress) |
| `002_automations_billing.sql` | WhatsApp, email, AI logs, Stripe events, trigger functions |
| `003_indexes_rls.sql` | Indici di performance + tutte le RLS policies |
| `004_storage_seed.sql` | Bucket Supabase Storage + funzioni seed per tenant |
| `005_jwt_hook.sql` | Funzione custom JWT claims |
| `010_reminders_training.sql` | Promemoria WhatsApp e area allenamento con link sicuro |
| `011_training_progress_ai.sql` | Note sessione, dashboard progressi e cache AI server-only |

---

## Fasi di Sviluppo

| Fase | Modulo | Stato |
|------|--------|-------|
| 1-2 | Setup + Database | ✅ Completato |
| 3 | i18n (IT + EN) | ✅ Completato |
| 4 | Auth + Middleware | ✅ Completato |
| 5 | Modulo Clienti | 🔄 Prossimo |
| 6 | Appuntamenti + Calendario | ⏳ |
| 7 | Portale Cliente | ⏳ |
| 8 | Stripe Billing | ⏳ |
| 9 | AI Assistant | ⏳ |
| 10 | WhatsApp + Email | ⏳ |

---

## Note Importanti per Vercel

- **Timeout**: le chiamate OpenAI usano streaming per evitare timeout (max 60s su Pro)
- **Database**: usa sempre la stringa `DATABASE_POOL_URL` con porta 6543 (PgBouncer Transaction Mode) per le Route Handlers SSR
- **n8n**: non può girare su Vercel — usa n8n Cloud, Railway o VPS
- **Webhook**: le route `/api/webhooks/*` sono escluse dall'autenticazione middleware
