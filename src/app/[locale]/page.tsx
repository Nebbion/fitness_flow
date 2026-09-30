import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function LocaleHomePage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${locale}/auth/login`)
  }

  // Recupera il ruolo dal profilo
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'CLIENT'

  switch (role) {
    case 'SUPER_ADMIN':
      redirect(`/${locale}/admin`)
    case 'TENANT_ADMIN':
    case 'STAFF':
      redirect(`/${locale}/dashboard`)
    case 'CLIENT':
      redirect(`/${locale}/portal`)
    default:
      redirect(`/${locale}/auth/login`)
  }
}
