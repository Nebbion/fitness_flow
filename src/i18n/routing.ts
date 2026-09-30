import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  // Lingue supportate
  locales: ['it', 'en'],

  // Lingua di default (italiano)
  defaultLocale: 'it',

  // Strategia prefisso: sempre incluso nel path
  // /it/dashboard, /en/dashboard
  localePrefix: 'always',

  // Nomi path alternativi per lingua (opzionale — utile per SEO)
  pathnames: {
    '/dashboard':             '/dashboard',
    '/dashboard/clients':     '/dashboard/clients',
    '/dashboard/appointments':'/dashboard/appointments',
    '/dashboard/services':    '/dashboard/services',
    '/dashboard/documents':   '/dashboard/documents',
    '/dashboard/staff':       '/dashboard/staff',
    '/dashboard/billing':     '/dashboard/billing',
    '/dashboard/ai':          '/dashboard/ai',
    '/dashboard/settings':    '/dashboard/settings',
    '/portal':                '/portal',
    '/portal/appointments':   '/portal/appointments',
    '/portal/plans':          '/portal/plans',
    '/portal/documents':      '/portal/documents',
    '/portal/progress':       '/portal/progress',
    '/login':                 '/login',
    '/register':              '/register',
    '/onboarding':            '/onboarding',
  }
})

export type Pathnames = keyof typeof routing.pathnames
export type Locale = (typeof routing.locales)[number]
