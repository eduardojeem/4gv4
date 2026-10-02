import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ServicesPage, { generateMetadata as generateServicesMetadata } from '@/app/(public)/servicios/page'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CalendarCheck2 } from 'lucide-react'
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

  // Con la reserva online activa, el primer paso del cliente es pedir turno.
  const agenda = await loadAgendaConfig(createAdminSupabase() as unknown as SupabaseClient, organization.id, { onlyActive: true })

  return (
    <>
      {agenda?.settings.online_booking && (
        <div className="mx-auto mt-6 max-w-6xl px-4">
          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border bg-primary/5 p-4 sm:flex-row sm:items-center">
            <p className="text-sm"><b>¿Querés venir?</b> Elegí servicio, día y horario y reservá tu turno en un minuto.</p>
            <Link href={`/${organizationSlug}/turnos`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <CalendarCheck2 className="h-4 w-4" /> Reservar turno
            </Link>
          </div>
        </div>
      )}
      <ServicesPage organizationId={organization.id} organizationName={organization.name} />
    </>
  )
}
