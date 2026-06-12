import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import HomePage, { generateMetadata as generateHomeMetadata } from '@/app/(public)/inicio/page'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'

type Props = {
  params: Promise<{ organizationSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { organizationSlug } = await params
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization) {
    return { title: 'Sitio no disponible' }
  }

  return generateHomeMetadata()
}

export default async function OrganizationHomePage({ params }: Props) {
  const { organizationSlug } = await params
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization) {
    notFound()
  }

  return <HomePage />
}
