import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'
import { PublicBooking } from '@/components/public/agenda/PublicBooking'

type Props = { params: Promise<{ organizationSlug: string }> }

async function bookingOrganization(slug: string) {
  const organization = await resolvePublicStorefrontOrganizationBySlug(slug)
  if (!organization || !(await isOrganizationModuleEnabled(organization.id, 'services'))) return null
  const config = await loadAgendaConfig(createAdminSupabase() as unknown as SupabaseClient, organization.id, { onlyActive: true })
  return config?.settings.online_booking ? organization : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { organizationSlug } = await params
  const organization = await bookingOrganization(organizationSlug)
  return organization
    ? { title: `Reservar turno | ${organization.name}`, description: `Elegí servicio, día y horario en ${organization.name}.` }
    : { title: 'Turnos no disponibles' }
}

export default async function BookingPage({ params }: Props) {
  const { organizationSlug } = await params
  const organization = await bookingOrganization(organizationSlug)
  if (!organization) notFound()
  return (
    <main id="main-content" className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reservá tu turno</h1>
        <p className="text-sm text-muted-foreground">{organization.name}</p>
      </div>
      <PublicBooking slug={organizationSlug} />
    </main>
  )
}
