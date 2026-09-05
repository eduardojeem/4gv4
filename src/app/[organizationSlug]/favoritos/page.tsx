import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FavoritesPage } from '@/components/public/FavoritesPage'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'

type Props = {
  params: Promise<{ organizationSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { organizationSlug } = await params
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization) {
    return { title: 'Favoritos no disponibles' }
  }

  return {
    title: `Mis favoritos en ${organization.name}`,
    description: `Tus productos favoritos guardados en la tienda ${organization.name}`,
    robots: { index: false, follow: false },
  }
}

export default async function OrganizationFavoritesPage({ params }: Props) {
  const { organizationSlug } = await params
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization) {
    notFound()
  }

  return (
    <FavoritesPage
      scopedStoreSlug={organization.slug}
      scopedStoreName={organization.name}
    />
  )
}
