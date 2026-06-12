import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductsPage, { generateMetadata as generateProductsMetadata } from '@/app/(public)/productos/page'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'

export const revalidate = 60

type Props = {
  params: Promise<{ organizationSlug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: { params: Promise<{ organizationSlug: string }> }): Promise<Metadata> {
  const { organizationSlug } = await params
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization) {
    return { title: 'Catalogo no disponible' }
  }

  return generateProductsMetadata()
}

export default async function OrganizationProductsPage(props: Props) {
  const { organizationSlug } = await props.params
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization) {
    notFound()
  }

  return <ProductsPage searchParams={props.searchParams} />
}
