import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import ServicesPage, { generateMetadata as generateServicesMetadata } from '@/app/(public)/servicios/page'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'

type Props = {
  params: Promise<{ organizationSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { organizationSlug } = await params
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization || !(await isOrganizationModuleEnabled(organization.id, 'services'))) {
    return { title: 'Servicios no disponibles' }
  }

  return generateServicesMetadata()
}

export default async function OrganizationServicesPage({ params }: Props) {
  const { organizationSlug } = await params
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization || !(await isOrganizationModuleEnabled(organization.id, 'services'))) {
    notFound()
  }

  // Cargar configuración de agenda y profesionales para integrar reserva directa en cada servicio.
  const agenda = await loadAgendaConfig(createAdminSupabase() as unknown as SupabaseClient, organization.id, { onlyActive: true })

  return (
    <ServicesPage
      organizationId={organization.id}
      organizationName={organization.name}
      businessVertical={organization.business_vertical}
      bookingHref={`/${organizationSlug}/turnos`}
      onlineBookingEnabled={Boolean(agenda?.settings.online_booking)}
      currency={agenda?.currency}
      agendaServices={agenda?.services.map((srv) => ({
        productId: srv.product_id,
        name: srv.name,
        price: srv.price,
        hidePrice: srv.hide_price,
        durationMinutes: srv.duration_minutes,
        online: srv.online,
        catalogVisible: srv.catalog_visible !== false,
        imageUrl: srv.image_url,
      }))}
      professionals={agenda?.professionals
        .filter((pro) => pro.is_active && pro.online_visible !== false)
        .map((pro) => ({
          id: pro.id,
          name: pro.name,
          specialty: pro.specialty,
          photoUrl: pro.photo_url,
          color: pro.color,
          serviceIds: pro.service_ids ?? [],
        }))}
    />
  )
}
