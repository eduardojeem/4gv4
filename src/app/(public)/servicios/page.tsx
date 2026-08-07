import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import {
  getActivePublicServices,
  isPublicServicesPageAvailable,
} from '@/lib/website/services'
import { ServicesPageClient } from './ServicesPageClient'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { Service } from '@/types/website-settings'

// La relación categories(name) de Supabase puede venir como objeto o como
// array de un elemento según cómo infiera la cardinalidad sin codegen de
// tipos; esto cubre ambos casos sin recurrir a `any`.
function extractCategoryName(raw: unknown): string | undefined {
  if (!raw) return undefined
  if (Array.isArray(raw)) return (raw[0] as { name?: string } | undefined)?.name
  return (raw as { name?: string }).name
}

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

  const services = getActivePublicServices(settings?.services)

  // Cargar servicios dinámicos de la organización desde la tabla products.
  // Heurística: no hay una columna is_service en products, así que se
  // detectan por unit_measure='servicio' o por nombre. Un producto físico
  // que contenga "servicio" en el nombre (ej. "Kit de servicio técnico")
  // podría colarse acá — vale la pena una columna dedicada si esto da falsos
  // positivos en la práctica.
  if (organizationId) {
    try {
      const supabase = createAdminSupabase()
      const { data: dbServices } = await supabase
        .from('products')
        .select('id, name, description, sale_price, visibility, category:categories(name)')
        .eq('organization_id', organizationId)
        .eq('visibility', 'public')
        .or('unit_measure.eq.servicio,name.ilike.%servicio%')

      if (dbServices && dbServices.length > 0) {
        const converted: Service[] = dbServices.map(s => ({
          id: s.id,
          title: s.name,
          description: s.description || '',
          price: s.sale_price || 0,
          icon: 'wrench',
          color: 'blue',
          benefits: ['Garantía escrita', 'Atención rápida'],
          category: extractCategoryName(s.category) || 'Servicios',
          active: true
        }))

        const existingTitles = new Set(services.map(s => (s.title || '').toLowerCase()))
        for (const conv of converted) {
          if (!existingTitles.has(conv.title.toLowerCase())) {
            services.push(conv)
          }
        }
      }
    } catch (e) {
      console.error('Error fetching org DB services:', e)
    }
  }

  const companyName = organizationName || settings?.company_info?.name || 'Nuestra empresa'
  const phone = settings?.company_info?.phone || ''
  const whatsapp = settings?.company_info?.whatsapp || phone

  if (services.length === 0 && !isPublicServicesPageAvailable(settings?.company_info?.servicesPageEnabled, settings?.services)) {
    notFound()
  }

  return (
    <ServicesPageClient
      services={services}
      companyName={companyName}
      whatsapp={whatsapp}
    />
  )
}
