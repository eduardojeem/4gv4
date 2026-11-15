import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { getActivePublicServices } from '@/lib/website/services'
import {
  ServicesPageClient,
  type ServicesPageAgendaService,
  type ServicesPageProfessional,
} from './ServicesPageClient'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { resolveRequestStorefrontOrganization } from '@/lib/website/request-storefront-organization'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'
import type { Service } from '@/types/website-settings'
import { inventoryServicesForWebsite, mergeInventoryServices, type InventoryServiceRow } from '@/lib/website/inventory-services'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const company = settings?.company_info
  const name = company?.name || 'Tienda'

  return {
    title: `Servicios | ${name}`,
    description: `Servicios profesionales ofrecidos por ${name}. Consultá precios, duración y reservá tu turno.`,
  }
}

interface ServicesPageProps {
  organizationId?: string
  organizationName?: string
  businessVertical?: string | null
  bookingHref?: string
  onlineBookingEnabled?: boolean
  agendaServices?: ServicesPageAgendaService[]
  professionals?: ServicesPageProfessional[]
  currency?: string
}

export default async function ServicesPage({
  organizationId,
  organizationName,
  businessVertical,
  bookingHref,
  onlineBookingEnabled,
  agendaServices,
  professionals,
  currency,
}: ServicesPageProps = {}) {
  const [settings, requestOrg] = await Promise.all([
    fetchWebsiteSettings(),
    organizationId ? Promise.resolve(null) : resolveRequestStorefrontOrganization(),
  ])

  const effectiveOrgId = organizationId || requestOrg?.id
  const effectiveVertical = businessVertical ?? requestOrg?.business_vertical ?? null

  if (effectiveOrgId && !(await isOrganizationModuleEnabled(effectiveOrgId, 'services'))) {
    notFound()
  }

  if (settings?.company_info?.servicesPageEnabled === false) {
    notFound()
  }

  let services: Service[] = getActivePublicServices(settings?.services).map((s) => ({
    ...s,
    source: s.source || 'catalog',
  }))

  let resolvedOnlineBooking = onlineBookingEnabled
  let resolvedBookingHref = bookingHref
  let resolvedAgendaServices = agendaServices
  let resolvedProfessionals = professionals
  let resolvedCurrency = currency

  // Servicios de la organización desde la tabla products: solo los activos y
  // marcados para la página web, con su portada.
  if (effectiveOrgId) {
    try {
      const supabase = createAdminSupabase()
      const [{ data: dbServices }, loadedAgenda] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, description, sale_price, hide_price, visibility, is_active, image_url, images, category:categories(name)')
          .eq('organization_id', effectiveOrgId)
          .eq('visibility', 'public')
          .eq('is_active', true)
          .or('unit_measure.eq.servicio,name.ilike.%servicio%'),
        resolvedAgendaServices === undefined
          ? loadAgendaConfig(supabase as unknown as SupabaseClient, effectiveOrgId, { onlyActive: true })
          : Promise.resolve(null),
      ])

      if (dbServices && dbServices.length > 0) {
        services = mergeInventoryServices(
          services,
          inventoryServicesForWebsite(dbServices as InventoryServiceRow[], {
            businessVertical: effectiveVertical,
          }),
        )
      }

      if (loadedAgenda) {
        resolvedOnlineBooking = resolvedOnlineBooking ?? Boolean(loadedAgenda.settings.online_booking)
        resolvedBookingHref = resolvedBookingHref ?? (requestOrg?.slug ? `/${requestOrg.slug}/turnos` : '/turnos')
        resolvedCurrency = resolvedCurrency ?? loadedAgenda.currency
        resolvedAgendaServices = loadedAgenda.services.map((srv) => ({
          productId: srv.product_id,
          name: srv.name,
          price: srv.price,
          hidePrice: srv.hide_price,
          durationMinutes: srv.duration_minutes,
          online: srv.online,
          catalogVisible: srv.catalog_visible !== false,
          imageUrl: srv.image_url,
        }))
        resolvedProfessionals = loadedAgenda.professionals
          .filter((pro) => pro.is_active && pro.online_visible !== false)
          .map((pro) => ({
            id: pro.id,
            name: pro.name,
            specialty: pro.specialty,
            photoUrl: pro.photo_url,
            color: pro.color,
            serviceIds: pro.service_ids ?? [],
          }))
      }
    } catch (e) {
      console.error('Error fetching org DB services:', e)
    }
  }

  const companyName = organizationName || requestOrg?.name || settings?.company_info?.name || 'Nuestra empresa'
  const phone = settings?.company_info?.phone || ''
  const whatsapp = settings?.company_info?.whatsapp || phone

  return (
    <ServicesPageClient
      services={services}
      companyName={companyName}
      whatsapp={whatsapp}
      sectionText={settings?.services_section}
      businessVertical={effectiveVertical}
      onlineBookingEnabled={Boolean(resolvedOnlineBooking)}
      bookingHref={resolvedBookingHref}
      agendaServices={resolvedAgendaServices}
      professionals={resolvedProfessionals}
      currency={resolvedCurrency}
    />
  )
}
