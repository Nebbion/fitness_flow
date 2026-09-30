'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard, Users, Calendar, Briefcase,
  UserCog, CreditCard, Sparkles, Settings, ChevronLeft,
  ChevronRight, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { UserRole, Tenant } from '@/types'

interface SidebarProps {
  locale: string
  role: UserRole
  tenant: Tenant | null
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

interface NavItem {
  key: string
  href: string
  icon: React.ElementType
  roles: UserRole[]
  badge?: string
}

function getNavItems(locale: string): NavItem[] {
  return [
    {
      key: 'dashboard',
      href: `/${locale}/dashboard`,
      icon: LayoutDashboard,
      roles: ['TENANT_ADMIN', 'STAFF'],
    },
    {
      key: 'clients',
      href: `/${locale}/dashboard/clients`,
      icon: Users,
      roles: ['TENANT_ADMIN', 'STAFF'],
    },
    {
      key: 'appointments',
      href: `/${locale}/dashboard/appointments`,
      icon: Calendar,
      roles: ['TENANT_ADMIN', 'STAFF'],
    },
    {
      key: 'services',
      href: `/${locale}/dashboard/services`,
      icon: Briefcase,
      roles: ['TENANT_ADMIN'],
    },
    {
      key: 'staff',
      href: `/${locale}/dashboard/staff`,
      icon: UserCog,
      roles: ['TENANT_ADMIN'],
    },
    {
      key: 'ai',
      href: `/${locale}/dashboard/ai`,
      icon: Sparkles,
      roles: ['TENANT_ADMIN', 'STAFF'],
    },
    {
      key: 'billing',
      href: `/${locale}/dashboard/billing`,
      icon: CreditCard,
      roles: ['TENANT_ADMIN'],
    },
    {
      key: 'settings',
      href: `/${locale}/dashboard/settings`,
      icon: Settings,
      roles: ['TENANT_ADMIN'],
    },
  ]
}

export function Sidebar({ locale, role, tenant, user }: SidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = getNavItems(locale).filter(item => item.roles.includes(role))

  const isActive = (href: string) => {
    if (href === `/${locale}/dashboard`) {
      return pathname === `/${locale}/dashboard`
    }
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full border-r border-border bg-card transition-all duration-200 ease-in-out shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo + nome tenant */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-border gap-3 overflow-hidden',
        collapsed && 'justify-center px-0'
      )}>
        {tenant?.logo_url ? (
          <img
            src={tenant.logo_url}
            alt={tenant.name}
            className="w-8 h-8 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: tenant?.brand_primary ?? '#2563EB' }}
          >
            <Activity className="w-4 h-4 text-white" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{tenant?.name ?? 'FitnessFlow'}</p>
            <p className="text-xs text-muted-foreground capitalize">{tenant?.plan ?? 'trial'}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.key}
              href={item.href}
              title={collapsed ? t(item.key as any) : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                collapsed && 'justify-center px-0'
              )}
            >
              <Icon className={cn('shrink-0', active ? 'w-5 h-5' : 'w-5 h-5')} />
              {!collapsed && <span>{t(item.key as any)}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className={cn(
        'border-t border-border p-3 flex items-center gap-3 overflow-hidden',
        collapsed && 'justify-center'
      )}>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            getInitials(user.full_name ?? 'U')
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{user.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{role.toLowerCase().replace('_', ' ')}</p>
          </div>
        )}
      </div>

      {/* Toggle collapse */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-border bg-background flex items-center justify-center shadow-sm hover:bg-accent transition-colors z-10"
        aria-label={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
    </aside>
  )
}
