import type { Metadata } from 'next'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const companyName = settings?.company_info?.name || '4G Celulares'

  return {
    title: `Mis Reparaciones | ${companyName}`,
    description: 'Seguí el estado de tus reparaciones y consultá tu historial de órdenes.',
    robots: {
      index: false,   // página privada — no indexar
      follow: false,
    },
  }
}

export default function MisReparacionesLayout({ children }: { children: React.ReactNode }) {
  return children
}
