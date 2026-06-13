import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import OffersPage, { generateMetadata as generateOffersMetadata } from '@/app/(public)/ofertas/page'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'

type Props = {
  params: Promise<{ organizationSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { organizationSlug } = await params
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization) {
    return { title: 'Ofertas no disponibles' }
  }

  return generateOffersMetadata()
}

export default async function OrganizationOffersPage({ params }: Props) {
  const { organizationSlug } = await params
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization) {
    notFound()
  }

  return <OffersPage />
}
