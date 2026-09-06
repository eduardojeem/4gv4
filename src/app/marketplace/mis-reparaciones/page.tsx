import type { Metadata } from 'next'
import MisReparacionesPage from '@/app/(public)/mis-reparaciones/page'

/**
 * La misma lista, dentro del marketplace. `basePath` es lo que mantiene los
 * filtros y el paginado en `/marketplace/mis-reparaciones`: con el prefijo del
 * tenant vacio, cada filtro devolvia a la vidriera por defecto.
 *
 * Los enlaces al detalle no: esos van a `/{tienda}/mis-reparaciones/{ticket}`,
 * porque el detalle se autoriza contra la organizacion duena.
 */
export const metadata: Metadata = {
  title: 'Mis reparaciones',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function MarketplaceRepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>
}) {
  return <MisReparacionesPage searchParams={searchParams} basePath="/marketplace" />
}
