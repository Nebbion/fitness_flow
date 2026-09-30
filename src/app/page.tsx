import { redirect } from 'next/navigation'

// La root "/" redirige sempre al locale di default
export default function RootPage() {
  redirect('/it')
}
