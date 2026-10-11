import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarketplaceProductCarousel } from '@/components/public/MarketplaceProductCarousel'
import { MarketplaceBusinessPromoShowcase } from '@/components/public/MarketplaceBusinessPromoShowcase'
import type { MarketplaceOrganization, MarketplaceProduct } from '@/lib/public/marketplace'

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/marketplace' }))
const product = { id: 'p1', name: 'Variant fixture', sku: 'SKU', sale_price: 200, stock_quantity: 3,
  in_stock: true, image: '/placeholder-product.svg', organization_id: 'org1', organization_name: 'Store', organization_slug: 'store',
  catalog_summary: { stockQuantity: 3, price: 80, originalPrice: 100, priceFrom: true, hasOffer: true, representativeVariantId: null, promotionName: null },
} as MarketplaceProduct

describe('effective starting prices in marketplace cards', () => {
  it('renders the available starting price and matching discount in a carousel', () => {
    render(<MarketplaceProductCarousel products={[product]} autoPlay={false} />)
    expect(screen.getByText(/Desde/)).toBeInTheDocument()
    expect(screen.getByText(/20%/)).toBeInTheDocument()
  })
  it('does not add Desde when available prices are equal', () => {
    render(<MarketplaceProductCarousel products={[{ ...product, catalog_summary: { ...product.catalog_summary!, priceFrom: false } }]} autoPlay={false} />)
    expect(screen.queryByText(/Desde/)).not.toBeInTheDocument()
  })
  it('shows consultation instead of a numeric hidden price in business showcases', () => {
    const hidden = { ...product, hide_price: true, catalog_summary: { ...product.catalog_summary!, price: null, originalPrice: null, hasOffer: false, priceFrom: false } }
    const organization = { id: 'org1', name: 'Store', slug: 'store', products_count: 1,
      featured_products: [hidden], whatsapp: '0981123456' } as unknown as MarketplaceOrganization
    render(<MarketplaceBusinessPromoShowcase organizations={[organization]} />)
    expect(screen.getByText(/Consultar precio/)).toBeInTheDocument()
    expect(screen.queryByText(/200/)).not.toBeInTheDocument()
  })
})
