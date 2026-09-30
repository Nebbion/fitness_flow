'use client'

import { useTranslations } from 'next-intl'
import { FileText, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/index'
import { formatDate, formatCurrency } from '@/lib/utils'

interface BillingInvoicesProps {
  invoices: any[]
  locale: string
}

export function BillingInvoices({ invoices, locale }: BillingInvoicesProps) {
  const t = useTranslations('billing')
  const dateLocale = locale === 'it' ? 'it-IT' : 'en-GB'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('invoices')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {invoices.map(invoice => (
            <div key={invoice.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {formatDate(new Date(invoice.created * 1000).toISOString(), dateLocale)}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{invoice.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {formatCurrency(invoice.amount_paid / 100, invoice.currency.toUpperCase())}
                </span>
                {invoice.invoice_pdf && (
                  <a
                    href={invoice.invoice_pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
