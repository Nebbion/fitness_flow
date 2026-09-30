'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { formatDate, getInitials } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Phone, Mail, MoreHorizontal, Eye, UserX, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/index'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { UserRole } from '@/types'
import { cn } from '@/lib/utils'

interface Client {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
  tags: string[]
  active: boolean
  last_appointment_at: string | null
  created_at: string
  preferred_language: string
  profiles?: { id: string; full_name: string | null } | null
}

interface ClientsTableProps {
  clients: Client[]
  locale: string
  role: UserRole
  totalPages: number
  currentPage: number
  total: number
}

export function ClientsTable({
  clients,
  locale,
  role,
  totalPages,
  currentPage,
  total,
}: ClientsTableProps) {
  const t = useTranslations('clients')
  const tTable = useTranslations('clients.table')
  const router = useRouter()
  const searchParams = useSearchParams()

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`?${params.toString()}`)
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">{t('common.noResults')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{tTable('name')}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{tTable('email')}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">{tTable('phone')}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">{tTable('lastAppointment')}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">{tTable('tags')}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{tTable('status')}</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clients.map(client => (
              <tr
                key={client.id}
                className="hover:bg-accent/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/${locale}/dashboard/clients/${client.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                      {getInitials(client.full_name)}
                    </div>
                    <div>
                      <p className="font-medium">{client.full_name}</p>
                      {client.preferred_language && (
                        <p className="text-xs text-muted-foreground uppercase">{client.preferred_language}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{client.email ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{client.phone ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                  {client.last_appointment_at
                    ? formatDate(client.last_appointment_at, locale === 'it' ? 'it-IT' : 'en-GB')
                    : '—'}
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {client.tags?.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs bg-secondary px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                    {(client.tags?.length ?? 0) > 3 && (
                      <span className="text-xs text-muted-foreground">+{client.tags.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={client.active ? 'success' : 'secondary'}>
                    {client.active ? 'Attivo' : 'Inattivo'}
                  </Badge>
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/${locale}/dashboard/clients/${client.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizza
                      </DropdownMenuItem>
                      {role === 'TENANT_ADMIN' && (
                        <DropdownMenuItem onClick={() => router.push(`/${locale}/dashboard/clients/${client.id}/edit`)}>
                          Modifica
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {clients.map(client => (
          <a
            key={client.id}
            href={`/${locale}/dashboard/clients/${client.id}`}
            className="block bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                  {getInitials(client.full_name)}
                </div>
                <div>
                  <p className="font-medium text-sm">{client.full_name}</p>
                  <p className="text-xs text-muted-foreground">{client.email ?? client.phone ?? '—'}</p>
                </div>
              </div>
              <Badge variant={client.active ? 'success' : 'secondary'} className="text-xs">
                {client.active ? 'Attivo' : 'Inattivo'}
              </Badge>
            </div>
            {client.last_appointment_at && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <span>Ultimo appuntamento:</span>
                <span>{formatDate(client.last_appointment_at, 'it-IT')}</span>
              </p>
            )}
          </a>
        ))}
      </div>

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Pagina {currentPage} di {totalPages} · {total} totali
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
