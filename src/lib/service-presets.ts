export type ServicePreset = {
  name: string
  description: string
  duration_min: number
  color: string
}

export const MASSAGE_SERVICE_PRESETS: ServicePreset[] = [
  { name: 'Massaggio total body', description: 'Trattamento completo del corpo.', duration_min: 60, color: '#0F766E' },
  { name: 'Massaggio Upper Body', description: 'Trattamento mirato a schiena, spalle, collo e braccia.', duration_min: 45, color: '#2563EB' },
  { name: 'Massaggio Lower Body', description: 'Trattamento mirato a gambe, glutei e piedi.', duration_min: 45, color: '#7C3AED' },
  { name: 'Terapia Hot Stones', description: 'Trattamento con pietre calde.', duration_min: 60, color: '#EA580C' },
  { name: 'Terapia Coppettazione', description: 'Trattamento con coppette.', duration_min: 45, color: '#BE123C' },
]
