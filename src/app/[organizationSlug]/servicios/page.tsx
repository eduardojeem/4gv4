import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ServicesPage, { generateMetadata as generateServicesMetadata } from '@/app/(public)/servicios/page'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'

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

  return <ServicesPage organizationId={organization.id} organizationName={organization.name} />
}
