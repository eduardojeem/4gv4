import type { Metadata } from 'next'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { ServicesPageClient } from './ServicesPageClient'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const company = settings?.company_info
  const name = company?.name || 'Tienda'

  return {
    title: `Servicios | ${name}`,
    description: `Servicios profesionales ofrecidos por ${name}. Consulta precios y promociones.`,
  }
}

export default async function ServicesPage() {
  const settings = await fetchWebsiteSettings()

  const services = Array.isArray(settings?.services) ? settings.services : []
  const companyName = settings?.company_info?.name || 'Nuestra empresa'
  const phone = settings?.company_info?.phone || ''
  const whatsapp = settings?.company_info?.whatsapp || phone

  return (
    <ServicesPageClient
      services={services}
      companyName={companyName}
      whatsapp={whatsapp}
    />
  )
}
