import type { Metadata } from 'next'
import { MaintenancePage } from '@/components/public/MaintenancePage'

export const metadata: Metadata = {
  title: 'En mantenimiento',
  robots: { index: false, follow: false },
}

/**
 * Página que muestra el proxy cuando la plataforma está en mantenimiento
 * (Superadmin → Configuración). El mantenimiento de una sola tienda usa la
 * misma pantalla desde su propio sitio.
 */
export default function PlatformMaintenancePage() {
  return (
    <MaintenancePage
      maintenanceMode={{
        enabled: true,
        title: 'Estamos haciendo mejoras',
        message: 'La plataforma está en mantenimiento por unos minutos. Volvé a intentar en un rato.',
      }}
    />
  )
}
