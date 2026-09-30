'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useTransition } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/index'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

interface ClientsFiltersProps {
  locale: string
  currentFilter: string
  currentSearch?: string
  staffList: { id: string; full_name: string | null }[]
  currentStaff?: string
  role: UserRole
}

const FILTERS = [
  { key: 'all' },
  { key: 'active' },
  { key: 'inactive' },
  { key: 'inactive30Days' },
]

export function ClientsFilters({
  locale,
  currentFilter,
  currentSearch,
  staffList,
  currentStaff,
  role,
}: ClientsFiltersProps) {
  const t = useTranslations('clients.filters')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function updateParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page') // reset pagina
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    // Debounce tramite setTimeout
    const timeout = setTimeout(() => updateParam('q', value || undefined), 300)
    return () => clearTimeout(timeout)
  }

  return (
    <div className="space-y-3">
      {/* Ricerca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('search') || 'Cerca per nome, email o telefono...'}
          defaultValue={currentSearch}
          onChange={handleSearch}
          className="pl-9 pr-8"
        />
        {currentSearch && (
          <button
            onClick={() => updateParam('q', undefined)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filtri stato + staff */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Filtri stato */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => updateParam('filter', f.key === 'all' ? undefined : f.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                currentFilter === f.key || (f.key === 'all' && !currentFilter)
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(f.key as any)}
            </button>
          ))}
        </div>

        {/* Filtro staff (solo TENANT_ADMIN con staff multipli) */}
        {role === 'TENANT_ADMIN' && staffList.length > 1 && (
          <select
            value={currentStaff ?? ''}
            onChange={e => updateParam('staff', e.target.value || undefined)}
            className="text-sm border border-input rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tutto lo staff</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        )}

        {/* Clear filtri */}
        {(currentFilter !== 'all' && currentFilter) || currentStaff ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams()
              if (currentSearch) params.set('q', currentSearch)
              router.push(`${pathname}?${params.toString()}`)
            }}
          >
            <X className="w-3 h-3 mr-1" />
            Rimuovi filtri
          </Button>
        ) : null}
      </div>
    </div>
  )
}
