'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function NavigationFeedback() {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)

  useEffect(() => { setPending(false) }, [pathname])

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const element = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!element || element.getAttribute('target') === '_blank' || element.hasAttribute('download')) return
      const href = element.getAttribute('href')
      if (!href || href.startsWith('#')) return
      const next = new URL(href, window.location.href)
      if (next.origin === window.location.origin && (next.pathname !== window.location.pathname || next.search !== window.location.search)) setPending(true)
    }
    document.addEventListener('click', onDocumentClick, true)
    return () => document.removeEventListener('click', onDocumentClick, true)
  }, [])

  if (!pending) return null
  return <div className="fixed right-5 top-5 z-50 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium shadow-lg" role="status" aria-live="polite">
    <Loader2 className="h-4 w-4 animate-spin text-primary" />
    Caricamento
  </div>
}
