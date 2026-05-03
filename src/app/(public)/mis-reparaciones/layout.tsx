import type { Metadata } from 'next'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const companyName = settings?.company_info?.name || '4G Celulares'

  return {
    title: `Rastrear Reparación | ${companyName}`,
    description: `Rastrea el estado de tu reparación en tiempo real. Ingresa tu número de ticket y contacto para ver el progreso de tu dispositivo.`,
    keywords: 'rastrear reparación, estado reparación, seguimiento reparación, ticket reparación',
    robots: {
      index: true,
      follow: false,
    },
    openGraph: {
      title: `Rastrear Reparación | ${companyName}`,
      description: 'Rastrea el estado de tu reparación en tiempo real',
      type: 'website',
    },
  }
}

export default function MisReparacionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
