import { Share2 } from 'lucide-react'
import { SharingControls } from '@/components/portal/sharing-controls'

export default function PortalSharingPage() {
  return <div className="space-y-5"><div><div className="flex items-center gap-2"><Share2 className="h-5 w-5 text-primary" /><h1 className="text-2xl font-semibold">Condivisioni</h1></div>
    <p className="mt-1 text-sm text-muted-foreground">Decidi quali dati i professionisti collegati possono consultare.</p></div><SharingControls /></div>
}
