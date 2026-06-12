import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CartPageClient } from '@/components/public/cart/CartPageClient'
import { prefixPublicTenantPath } from '@/lib/public/tenant-path'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'

export const metadata: Metadata = {
  title: 'Carrito',
  description: 'Carrito de compras de la tienda.',
}

export default async function OrganizationCartPage() {
  const headerStore = await headers()
  const organizationSlug = headerStore.get('x-tenant-slug')
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)

  if (!organization) {
    notFound()
  }

  const prefix = organizationSlug ? `/${organizationSlug}` : ''

  return (
    <CartPageClient
      organizationSlug={organizationSlug}
      productsHref={prefixPublicTenantPath(prefix, '/productos')}
      trackHref={prefixPublicTenantPath(prefix, '/track')}
    />
  )
}
