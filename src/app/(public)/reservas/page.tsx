import type { Metadata } from 'next'
import { BookingPageContent, bookingPageMetadata, serviceFromSearchParams } from '@/components/public/agenda/booking-page'
import { resolveRequestStorefrontOrganization } from '@/lib/website/request-storefront-organization'

/**
 * Reserva de turnos para la tienda en su propio subdominio
 * (tienda.dominio.com/reservas). Por /<tienda>/reservas se resuelve en
 * src/app/[organizationSlug]/reservas.
 */
type Props = { searchParams?: Promise<{ servicio?: string | string[] }> }

export async function generateMetadata(): Promise<Metadata> {
  const organization = await resolveRequestStorefrontOrganization()
  return bookingPageMetadata(organization?.slug)
}

export default async function SubdomainReservasPage({ searchParams }: Props) {
  const organization = await resolveRequestStorefrontOrganization()
  return <BookingPageContent slug={organization?.slug} initialServiceId={serviceFromSearchParams(await searchParams)} />
}
