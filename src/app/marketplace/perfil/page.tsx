import type { Metadata } from 'next'
import CustomerProfilePage from '@/app/(public)/perfil/page'

/**
 * El mismo perfil, pero dentro del marketplace.
 *
 * Antes el menu del marketplace mandaba a `/perfil`, que vive en el grupo
 * `(public)` y se pinta con la vidriera de la tienda por defecto: nav de
 * `/inicio` y `/productos`, pie con el nombre de esa tienda y ninguna vuelta al
 * marketplace. Los datos eran los correctos —de todas las tiendas, porque no
 * hay tenant—; lo que estaba mal era la cascara.
 *
 * Colgado de `/marketplace` hereda su layout, y `basePath` hace que los enlaces
 * de adentro se queden aca en vez de salir a la vidriera por defecto.
 */
export const metadata: Metadata = {
  title: 'Mi perfil',
  robots: { index: false, follow: false },
}

export default function MarketplaceProfilePage() {
  return <CustomerProfilePage basePath="/marketplace" />
}
