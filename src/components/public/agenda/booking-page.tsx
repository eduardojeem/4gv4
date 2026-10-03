import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'
import { PublicBooking } from '@/components/public/agenda/PublicBooking'

/**
 * La página «Reservá tu turno», compartida por /<tienda>/turnos y por la
 * tienda en su propio subdominio (/turnos). Solo existe si la tienda es
 * pública, tiene la agenda y acepta reservas online.
 */
export async function bookingOrganization(slug: string | null | undefined) {
  if (!slug) return null
  const organization = await resolvePublicStorefrontOrganizationBySlug(slug)
  if (!organization || !(await isOrganizationModuleEnabled(organization.id, 'services'))) return null
  const config = await loadAgendaConfig(createAdminSupabase() as unknown as SupabaseClient, organization.id, { onlyActive: true })
  return config?.settings.online_booking ? organization : null
}

export async function bookingPageMetadata(slug: string | null | undefined): Promise<Metadata> {
  const organization = await bookingOrganization(slug)
  return organization
    ? { title: `Reservar turno | ${organization.name}`, description: `Elegí servicio, día y horario en ${organization.name}.` }
    : { title: 'Turnos no disponibles' }
}

/** `servicio` llega desde la carta de la portada para arrancar con ese servicio elegido. */
export function serviceFromSearchParams(params: { servicio?: string | string[] } | undefined) {
  return typeof params?.servicio === 'string' ? params.servicio : undefined
}

export async function BookingPageContent({ slug, initialServiceId }: { slug: string | null | undefined; initialServiceId?: string }) {
  const organization = await bookingOrganization(slug)
  if (!organization || !slug) notFound()
  return (
    <main id="main-content" className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reservá tu turno</h1>
        <p className="text-sm text-muted-foreground">{organization.name}</p>
      </div>
      <PublicBooking slug={slug} initialServiceId={initialServiceId} />
    </main>
  )
}
