import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MealIdeasLibrary } from '@/components/nutrition/meal-ideas-library'
import { getNutritionProfessional } from '@/lib/training/professional-access'

export const metadata: Metadata = { title: 'Idee Pasti' }

export default async function MealIdeasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!await getNutritionProfessional()) redirect(`/${locale}/dashboard`)

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Idee Pasti</h1>
      <p className="mt-1 text-sm text-muted-foreground">Crea una libreria personale di ricette, descrizioni, immagini e link da riutilizzare.</p></div>
    <MealIdeasLibrary />
  </div>
}
