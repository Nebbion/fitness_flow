'use client'

import { useEffect, useState } from 'react'
import { Download, MoreVertical, Share, SquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallHelp({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent))
    const beforeInstall = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const appInstalled = () => { setInstalled(true); setOpen(false); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', appInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', appInstalled)
    }
  }, [])

  async function install() {
    if (!prompt) return setOpen(true)
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setOpen(false)
    setPrompt(null)
  }

  if (installed) return null

  return <>
    <Button type="button" variant="outline" size={compact ? 'icon' : 'sm'} onClick={install}
      aria-label="Installa FitnessFlow" title="Installa FitnessFlow">
      <Download className="h-4 w-4" />{!compact && <span>Installa app</span>}
    </Button>
    {open && <div className="fixed inset-0 z-50 grid items-end bg-black/45 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <section className="w-full rounded-t-2xl bg-background p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="install-title" className="text-lg font-semibold">Installa FitnessFlow</h2>
            <p className="mt-1 text-sm text-muted-foreground">Aprila dalla schermata Home come una normale app.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 hover:bg-muted" aria-label="Chiudi"><X className="h-5 w-5" /></button>
        </div>
        {isIOS ? <ol className="mt-5 space-y-4 text-sm">
          <li className="flex gap-3"><Share className="h-5 w-5 shrink-0 text-primary" /><span>Apri questa pagina in <strong>Safari</strong> e tocca <strong>Condividi</strong>.</span></li>
          <li className="flex gap-3"><SquarePlus className="h-5 w-5 shrink-0 text-primary" /><span>Scorri e scegli <strong>Aggiungi alla schermata Home</strong>.</span></li>
          <li className="flex gap-3"><Download className="h-5 w-5 shrink-0 text-primary" /><span>Conferma con <strong>Aggiungi</strong>.</span></li>
        </ol> : <ol className="mt-5 space-y-4 text-sm">
          <li className="flex gap-3"><MoreVertical className="h-5 w-5 shrink-0 text-primary" /><span>In Chrome apri il menu <strong>⋮</strong>.</span></li>
          <li className="flex gap-3"><Download className="h-5 w-5 shrink-0 text-primary" /><span>Scegli <strong>Installa app</strong> o <strong>Aggiungi a schermata Home</strong>.</span></li>
        </ol>}
        <p className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">Se la voce non compare, usa Safari su iPhone o Chrome su Android e verifica di aver aperto il link in una scheda del browser.</p>
      </section>
    </div>}
  </>
}
