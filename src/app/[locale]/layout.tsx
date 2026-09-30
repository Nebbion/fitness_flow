import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { QueryProvider } from '@/components/layout/query-provider'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/routing'

interface LocaleLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })

  return {
    title: {
      default: 'FitnessFlow',
      template: '%s | FitnessFlow',
    },
    description:
      locale === 'it'
        ? 'Piattaforma SaaS per nutrizionisti, personal trainer e professionisti del benessere'
        : 'SaaS platform for nutritionists, personal trainers and wellness professionals',
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? 'https://fitnessflow.app'
    ),
  }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params

  // Valida il locale
  if (!routing.locales.includes(locale as Locale)) {
    notFound()
  }

  // Carica i messaggi i18n lato server
  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <QueryProvider>
          {children}
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  )
}
