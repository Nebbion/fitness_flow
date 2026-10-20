import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!['it', 'en'].includes(locale)) return new NextResponse(null, { status: 404 })
  return NextResponse.json({
    id: '/fitnessflow-client',
    name: 'FitnessFlow Cliente',
    short_name: 'FitnessFlow',
    description: 'Scheda, allenamenti, storico e appuntamenti FitnessFlow',
    start_url: `/${locale}/portal/training?view=plan`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    categories: ['fitness', 'health'],
    icons: [
      { src: '/icons/fitnessflow-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/fitnessflow-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/fitnessflow-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, { headers: { 'Cache-Control': 'private, no-store', 'Content-Type': 'application/manifest+json' } })
}
