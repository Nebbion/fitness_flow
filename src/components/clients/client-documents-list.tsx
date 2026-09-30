'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, FileText, Download, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatBytes, formatDate } from '@/lib/utils'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface ClientDocumentsListProps {
  clientId: string
  locale: string
  role: UserRole
  tenantId: string
}

const DOC_ICONS: Record<string, string> = {
  nutrition_plan: '🥗',
  workout_plan: '💪',
  report: '📊',
  medical: '🏥',
  image: '🖼️',
  other: '📄',
}

export function ClientDocumentsList({
  clientId, locale, role, tenantId,
}: ClientDocumentsListProps) {
  const t = useTranslations('documents')
  const supabase = createSupabaseClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  async function loadDocuments() {
    const { data } = await supabase
      .from('documents')
      .select('*, profiles!documents_uploaded_by_fkey(full_name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setDocuments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadDocuments() }, [clientId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const storagePath = `${tenantId}/${clientId}/${Date.now()}_${file.name}`

      // Upload su Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(storagePath, file, { upsert: false })

      if (uploadError) throw uploadError

      // Salva record nel DB
      const { error: dbError } = await supabase.from('documents').insert({
        client_id: clientId,
        tenant_id: tenantId,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
        type: 'other',
        name: file.name,
        storage_path: storagePath,
        size_bytes: file.size,
        mime_type: file.type,
        visible_to_client: true,
      })

      if (dbError) throw dbError

      toast.success(t('uploadSuccess'))
      await loadDocuments()
    } catch (err: any) {
      toast.error(err.message ?? 'Errore caricamento file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(doc: any) {
    const { data } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(doc.storage_path, 60)

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  async function handleDelete(doc: any) {
    if (!confirm(t('deleteConfirm', { name: doc.name }))) return

    await supabase.storage.from('client-documents').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    toast.success(t('deleteSuccess'))
    await loadDocuments()
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{documents.length} documenti</p>
        {role !== 'CLIENT' && (
          <>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading
                ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                : <Upload className="w-3.5 h-3.5 mr-1.5" />
              }
              {t('upload')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              onChange={handleUpload}
            />
          </>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t('noDocuments')}</p>
          {role !== 'CLIENT' && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Carica il primo documento
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-muted-foreground/30 transition-colors"
            >
              <span className="text-2xl shrink-0">{DOC_ICONS[doc.type] ?? '📄'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(`types.${doc.type}`)}
                  {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ''}
                  {' · '}{formatDate(doc.created_at, locale === 'it' ? 'it-IT' : 'en-GB')}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
                {role === 'TENANT_ADMIN' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(doc)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
