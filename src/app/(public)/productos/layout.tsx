import type { Metadata } from 'next'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const companyName = settings?.company_info?.name || '4G Celulares'

  return {
    title: `Catálogo de Productos | ${companyName}`,
    description: 'Encuentra accesorios, repuestos y dispositivos para celulares. Amplio catálogo con precios competitivos y stock actualizado.',
    keywords: 'accesorios celular, repuestos celular, fundas, protectores, cargadores, auriculares',
    openGraph: {
      title: `Catálogo de Productos | ${companyName}`,
      description: 'Encuentra accesorios, repuestos y dispositivos para celulares',
      type: 'website',
    },
  }
}

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
