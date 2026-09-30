import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

// Client-side Supabase client (per Client Components)
// Usa le variabili pubbliche NEXT_PUBLIC_*
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
