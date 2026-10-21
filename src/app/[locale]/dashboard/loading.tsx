import { Loader2 } from 'lucide-react'

export default function DashboardLoading() {
  return <div className="grid min-h-[55vh] place-items-center" role="status" aria-live="polite">
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      Caricamento pagina...
    </div>
  </div>
}
