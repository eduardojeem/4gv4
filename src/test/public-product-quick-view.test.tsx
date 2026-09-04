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

describe('detalle público compacto y variantes', () => {
  it('permite elegir cantidad y conserva la ruta de la tienda para producto simple', () => {
    addProduct.mockClear()
    const product = { id: 'p1', name: 'Remera', sale_price: 50000, in_stock: true, stock_quantity: 2, description: 'Algodón', images: [], brand: 'Marca', category: { name: 'Ropa' } } as unknown as PublicProduct
    render(<ProductCard product={product} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vista rápida de Remera' }))
    const modal = within(screen.getByRole('dialog'))
    expect(modal.getByText('Algodón').closest('details')).not.toHaveAttribute('open')
    fireEvent.click(modal.getByRole('button', { name: 'Aumentar cantidad' }))
    expect(modal.getByRole('button', { name: 'Aumentar cantidad' })).toBeDisabled()
    expect(modal.getByRole('link', { name: /Ver detalle completo/ })).toHaveAttribute('href', '/tienda-demo/productos/p1')
    fireEvent.click(modal.getByRole('button', { name: /Agregar al carrito/ }))
    expect(addProduct).toHaveBeenCalledWith(product, 50000, 2, null)
  })

  it('exige seleccionar una variante antes de agregar al carrito', () => {
    addProduct.mockClear()
    const productWithVariants: PublicProduct = {
      id: 'p-var-1',
      name: 'Camisa Oxford',
      sku: 'CAM-OXF',
      sale_price: 60000,
      stock_quantity: 15,
      in_stock: true,
      is_active: true,
      featured: false,
      image: null,
      images: [],
      unit_measure: 'unidades',
      barcode: null,
      wholesale_price: null,
      description: 'Camisa clásica manga larga',
      has_variants: true,
      variants: [
        {
          id: 'v1',
          product_id: 'p-var-1',
          variant_name: 'Blanco / M',
          attributes: { Color: 'Blanco', Talle: 'M' },
          sku: 'CAM-OXF-WHT-M',
          sale_price: 60000,
          stock_quantity: 5,
          is_active: true,
        },
        {
          id: 'v2',
          product_id: 'p-var-1',
          variant_name: 'Azul / L',
          attributes: { Color: 'Azul', Talle: 'L' },
          sku: 'CAM-OXF-BLU-L',
          sale_price: 65000,
          stock_quantity: 10,
          is_active: true,
        },
        {
          id: 'v3',
          product_id: 'p-var-1',
          variant_name: 'Negro / S (Agotado)',
          attributes: { Color: 'Negro', Talle: 'S' },
          sku: 'CAM-OXF-BLK-S',
          sale_price: 60000,
          stock_quantity: 0,
          is_active: true,
        },
      ],
    }

    render(<ProductCard product={productWithVariants} />)

    // 1. Click en botón rápido de la tarjeta: no agrega directo, abre modal
    fireEvent.click(screen.getByRole('button', { name: /Agregar Camisa Oxford al carrito/i }))
    expect(addProduct).not.toHaveBeenCalled()

    // 2. Modal abierto: el botón de agregar está deshabilitado / pide elegir variante
    const modal = within(screen.getByRole('dialog'))
    const addBtn = modal.getByRole('button', { name: /Elegí una variante para agregar/i })
    expect(addBtn).toBeDisabled()

    // 3. La variante sin stock está deshabilitada
    const outOfStockVariantBtn = modal.getByRole('button', { name: /Negro \/ S \(Agotado\)/i })
    expect(outOfStockVariantBtn).toBeDisabled()

    // 4. Seleccionar variante "Azul / L"
    const blueVariantBtn = modal.getByRole('button', { name: /Azul \/ L/i })
    fireEvent.click(blueVariantBtn)

    // 5. El botón ahora está habilitado con el precio de la variante seleccionada (65.000)
    const enabledAddBtn = modal.getByRole('button', { name: /Agregar al carrito.*65\.000/i })
    expect(enabledAddBtn).not.toBeDisabled()

    // 6. Agregar al carrito
    fireEvent.click(enabledAddBtn)
    expect(addProduct).toHaveBeenCalledWith(
      productWithVariants,
      65000,
      1,
      productWithVariants.variants![1]
    )
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
