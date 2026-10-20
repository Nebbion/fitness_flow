import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/fitnessflow-client',
    name: 'FitnessFlow Cliente',
    short_name: 'FitnessFlow',
    description: 'Scheda, allenamenti, storico e appuntamenti FitnessFlow',
    start_url: '/it/portal',
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
  }
}
