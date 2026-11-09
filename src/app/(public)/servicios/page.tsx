import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import {
  getActivePublicServices,
} from '@/lib/website/services'
import { ServicesPageClient } from './ServicesPageClient'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import type { Service } from '@/types/website-settings'
import { inventoryServicesForWebsite, mergeInventoryServices, type InventoryServiceRow } from '@/lib/website/inventory-services'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const company = settings?.company_info
  const name = company?.name || 'Tienda'

  return {
    title: `Servicios | ${name}`,
    description: `Servicios profesionales ofrecidos por ${name}. Consulta precios y promociones.`,
  }
}

interface ServicesPageProps {
  organizationId?: string
  organizationName?: string
}

export default async function ServicesPage({ organizationId, organizationName }: ServicesPageProps = {}) {
  const settings = await fetchWebsiteSettings()

  let services: Service[] = getActivePublicServices(settings?.services).map(s => ({
    ...s,
    source: s.source || 'catalog',
  }))

  // Servicios de la organización desde la tabla products: solo los activos y
  // marcados para la página web, con su portada.
  if (organizationId) {
    try {
      const supabase = createAdminSupabase()
      const { data: dbServices } = await supabase
        .from('products')
        .select('id, name, description, sale_price, hide_price, visibility, is_active, image_url, images, category:categories(name)')
        .eq('organization_id', organizationId)
        .eq('visibility', 'public')
        .eq('is_active', true)
        .or('unit_measure.eq.servicio,name.ilike.%servicio%')

      if (dbServices && dbServices.length > 0) {
        services = mergeInventoryServices(services, inventoryServicesForWebsite(dbServices as InventoryServiceRow[]))
      }
    } catch (e) {
      console.error('Error fetching org DB services:', e)
    }
  }

  const companyName = organizationName || settings?.company_info?.name || 'Nuestra empresa'
  const phone = settings?.company_info?.phone || ''
  const whatsapp = settings?.company_info?.whatsapp || phone

  if (organizationId && !(await isOrganizationModuleEnabled(organizationId, 'services'))) {
    notFound()
  }

  if (settings?.company_info?.servicesPageEnabled === false) {
    notFound()
  }

  return (
    <ServicesPageClient
      services={services}
      companyName={companyName}
      whatsapp={whatsapp}
      sectionText={settings?.services_section}
    />
  )
}
