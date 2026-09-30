'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Moon, Sun, LogOut, User, Settings, Globe } from 'lucide-react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { UserRole, Tenant } from '@/types'

interface DashboardHeaderProps {
  locale: string
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
    role: UserRole
  }
  tenant: Tenant | null
}

export function DashboardHeader({ locale, user, tenant }: DashboardHeaderProps) {
  const t = useTranslations('nav')
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push(`/${locale}/auth/login`)
    router.refresh()
  }

  function switchLocale() {
    const newLocale = locale === 'it' ? 'en' : 'it'
    const currentPath = window.location.pathname
    const newPath = currentPath.replace(`/${locale}/`, `/${newLocale}/`)
    router.push(newPath)
  }

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
      {/* Left: breadcrumb placeholder */}
      <div />

      {/* Right: actions */}
      <div className="flex items-center gap-2">

        {/* Switcher lingua */}
        <Button
          variant="ghost"
          size="icon"
          onClick={switchLocale}
          title={locale === 'it' ? 'Switch to English' : 'Passa all\'italiano'}
        >
          <Globe className="h-4 w-4" />
        </Button>

        {/* Toggle dark mode */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  getInitials(user.full_name ?? 'U')
                )}
              </div>
              <span className="text-sm font-medium hidden sm:block">
                {user.full_name?.split(' ')[0]}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              {user.full_name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={`/${locale}/dashboard/settings`} className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                {t('profile')}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/${locale}/dashboard/settings`} className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                {t('settings')}
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
