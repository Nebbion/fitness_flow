import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

// Server-side Supabase client (per Server Components e Route Handlers)
// IMPORTANTE: usa la porta 6543 (PgBouncer Transaction Mode) per il pool
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Il metodo setAll viene chiamato da un Server Component.
            // Può essere ignorato se si usa middleware per il refresh delle sessioni.
          }
        },
      },
    }
  )
}

// Admin client con Service Role (bypassa RLS — usare con estrema cautela)
// Solo per operazioni server-side privilegiate (webhook, cron jobs)
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
