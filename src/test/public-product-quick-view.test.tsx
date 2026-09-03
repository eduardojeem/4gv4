import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProductCard } from '@/components/public/ProductCard'
import type { PublicProduct } from '@/types/public'
import { MarketplaceProductModal } from '@/components/public/MarketplaceProductModal'
import type { MarketplaceProduct } from '@/lib/public/marketplace'
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))

const { addProduct } = vi.hoisted(() => ({ addProduct: vi.fn(() => ({ limited: false })) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/tienda-demo/productos' }))
vi.mock('@/hooks/use-public-cart', () => ({ usePublicCart: () => ({ addProduct }) }))
vi.mock('@/hooks/useWebsiteSettings', () => ({ useWebsiteSettings: () => ({ settings: { checkout: { commerceMode: 'cart' }, company_info: {} }, isLoading: false }) }))

describe('detalle público compacto', () => {
  it('permite elegir cantidad y conserva la ruta de la tienda', () => {
    const product = { id: 'p1', name: 'Remera', sale_price: 50000, in_stock: true, stock_quantity: 2, description: 'Algodón', images: [], brand: 'Marca', category: { name: 'Ropa' } } as unknown as PublicProduct
    render(<ProductCard product={product} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vista rápida de Remera' }))
    const modal = within(screen.getByRole('dialog'))
    expect(modal.getByText('Algodón').closest('details')).not.toHaveAttribute('open')
    fireEvent.click(modal.getByRole('button', { name: 'Aumentar cantidad' }))
    expect(modal.getByRole('button', { name: 'Aumentar cantidad' })).toBeDisabled()
    expect(modal.getByRole('link', { name: /Ver detalle completo/ })).toHaveAttribute('href', '/tienda-demo/productos/p1')
    fireEvent.click(modal.getByRole('button', { name: /Agregar al carrito/ }))
    expect(addProduct).toHaveBeenCalledWith(product, 50000, 2)
  })
  it('marketplace mantiene los enlaces del vendedor y permite cerrar un producto agotado', () => {
    const onClose = vi.fn()
    const product = { id: 'p2', name: 'Perfume', sale_price: 100000, in_stock: false, description: 'Descripción larga', organization_slug: 'perfumeria', organization_name: 'Perfumería', images: [] } as unknown as MarketplaceProduct
    render(<MarketplaceProductModal product={product} open onClose={onClose} />)
    expect(screen.getByRole('link', { name: /Ver detalle en la tienda/ })).toHaveAttribute('href', '/perfumeria/productos/p2')
    expect(screen.getByText('Descripción larga').closest('details')).not.toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
