import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
export function AppointmentStoreNavigation({slug,name}:{slug:string|null|undefined;name:string}) {
 if (!slug) return null
 return <Link href={'/'+encodeURIComponent(slug)+'/inicio'} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"><ArrowLeft aria-hidden="true" className="h-4 w-4"/>Volver a la página de {name}</Link>
}
