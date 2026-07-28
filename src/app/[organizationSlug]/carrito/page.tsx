import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { CartPageClient } from '@/components/public/cart/CartPageClient'
import { prefixPublicTenantPath } from '@/lib/public/tenant-path'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'

export const metadata: Metadata = {
  title: 'Carrito',
  description: 'Carrito de compras de la tienda.',
}

export default async function OrganizationCartPage() {
  const headerStore = await headers()
  const organizationSlug = headerStore.get('x-tenant-slug')
  const [organization, settings] = await Promise.all([
    resolvePublicStorefrontOrganizationBySlug(organizationSlug),
    fetchWebsiteSettings(),
  ])

  if (!organization) {
    notFound()
  }

  const prefix = organizationSlug ? `/${organizationSlug}` : ''
  const productsHref = prefixPublicTenantPath(prefix, '/productos')

  if (settings && settings.checkout.commerceMode !== 'cart') {
    redirect(productsHref)
  }

  return (
    <CartPageClient
      organizationSlug={organizationSlug}
      productsHref={productsHref}
      trackHref={prefixPublicTenantPath(prefix, '/track')}
    />
  )
}
