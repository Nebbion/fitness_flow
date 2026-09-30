'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate, formatBytes } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const DOC_ICONS: Record<string, string> = {
  nutrition_plan: '🥗', workout_plan: '💪', report: '📊',
  medical: '🏥', image: '🖼️', other: '📄',
}

export default function PortalDocumentsPage({ params }: { params: { locale: string } }) {
  const { locale } = params
  const t = useTranslations('portal.documents')
  const tTypes = useTranslations('documents.types')
  const supabase = createClient()

  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: client } = await supabase
        .from('clients').select('id').eq('profile_id', user.id).single()
      if (!client) return

      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', client.id)
        .eq('visible_to_client', true)
        .order('created_at', { ascending: false })

      setDocs(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleDownload(doc: any) {
    const { data } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : !docs.length ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('noDocuments')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-4 rounded-xl border border-border">
              <span className="text-2xl">{DOC_ICONS[doc.type] ?? '📄'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {tTypes(doc.type as any)}
                  {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ''}
                  {' · '}{formatDate(doc.created_at, locale === 'it' ? 'it-IT' : 'en-GB')}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleDownload(doc)}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
