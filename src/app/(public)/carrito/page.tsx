import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { CartPageClient } from '@/components/public/cart/CartPageClient'
import { prefixPublicTenantPath } from '@/lib/public/tenant-path'

export const metadata: Metadata = {
  title: 'Carrito',
  description: 'Carrito de compras de la tienda.',
}

export default async function CartPage() {
  const headerStore = await headers()
  const organizationSlug = headerStore.get('x-tenant-slug')
  const prefix = organizationSlug ? `/${organizationSlug}` : ''

  return (
    <CartPageClient
      organizationSlug={organizationSlug}
      productsHref={prefixPublicTenantPath(prefix, '/productos')}
      trackHref={prefixPublicTenantPath(prefix, '/track')}
    />
  )
}
