import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import ProductDetailPage, { generateMetadata as generateProductMetadata } from '@/app/(public)/productos/[id]/page'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'

export const revalidate = 120

type Props = {
  params: Promise<{ organizationSlug: string; id: string }>
}

export async function generateMetadata(props: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const params = await props.params
  const organization = await resolvePublicStorefrontOrganizationBySlug(params.organizationSlug)

  if (!organization) {
    return { title: 'Producto no disponible' }
  }

  return generateProductMetadata({ params: Promise.resolve({ id: params.id }) }, parent)
}

export default async function OrganizationProductDetailPage({ params }: Props) {
  const resolvedParams = await params
  const organization = await resolvePublicStorefrontOrganizationBySlug(resolvedParams.organizationSlug)

  if (!organization) {
    notFound()
  }

  return <ProductDetailPage params={Promise.resolve({ id: resolvedParams.id })} />
}
