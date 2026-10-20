import type { Metadata } from 'next'
import './globals.css'
import { PwaRegistration } from '@/components/pwa/pwa-registration'

export const metadata: Metadata = {
  title: 'FitnessFlow',
  description: 'Piattaforma SaaS per professionisti del fitness e del benessere',
  manifest: '/manifest.webmanifest',
  applicationName: 'FitnessFlow',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'FitnessFlow' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/fitnessflow-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/fitnessflow-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
        <PwaRegistration />
      </body>
    </html>
  )
}
