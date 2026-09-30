'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { cn } from '@/lib/utils'

interface BillingPlansProps {
  locale: string
  tenantId: string
  currentPlan: string
  stripeCustomerId: string | null
}

const PLANS = [
  {
    key: 'starter',
    price: 29,
    clients: '50',
    features: ['50 clienti', 'Appuntamenti illimitati', 'Messaggi WhatsApp', 'Storage 5GB', 'Assistente AI'],
    popular: false,
  },
  {
    key: 'professional',
    price: 59,
    clients: '250',
    features: ['250 clienti', 'Appuntamenti illimitati', 'Messaggi WhatsApp illimitati', 'Storage 20GB', 'Assistente AI avanzato', 'Google Calendar sync'],
    popular: true,
  },
  {
    key: 'business',
    price: 99,
    clients: '∞',
    features: ['Clienti illimitati', 'Appuntamenti illimitati', 'WhatsApp illimitato', 'Storage 100GB', 'AI illimitata', 'Staff illimitato', 'Supporto prioritario'],
    popular: false,
  },
]

export function BillingPlans({ locale, tenantId, currentPlan, stripeCustomerId }: BillingPlansProps) {
  const t = useTranslations('billing')
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(planKey: string) {
    setLoading(planKey)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, locale }),
      })

      if (!res.ok) throw new Error((await res.json()).error)

      const { url } = await res.json()
      window.location.href = url
    } catch (err: any) {
      toast.error(err.message ?? 'Errore durante il reindirizzamento a Stripe')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Cambia piano</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.key
          const isPopular = plan.popular

          return (
            <Card
              key={plan.key}
              className={cn(
                'relative',
                isPopular && 'border-primary shadow-md shadow-primary/10',
                isCurrent && 'bg-muted/30'
              )}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                    Più popolare
                  </span>
                </div>
              )}
              <CardHeader className="pt-6">
                <CardTitle className="flex items-center justify-between">
                  <span className="capitalize">{plan.key}</span>
                  {isCurrent && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-normal">
                      Attuale
                    </span>
                  )}
                </CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">€{plan.price}</span>
                  <span className="text-muted-foreground text-sm">/mese</span>
                </div>
                <p className="text-sm text-muted-foreground">fino a {plan.clients} clienti</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : isPopular ? 'default' : 'outline'}
                  disabled={isCurrent || loading === plan.key}
                  onClick={() => !isCurrent && handleUpgrade(plan.key)}
                >
                  {loading === plan.key ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrent ? (
                    'Piano attuale'
                  ) : (
                    t('upgrade')
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
