import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ProductCard } from '@/components/public/ProductCard'
import { marketDiscountTiers, marketUnitLabel, productDiscountPct } from '@/lib/public/market'
import type { PublicProduct } from '@/types/public'

/* eslint-disable @next/next/no-img-element -- The next/image test double must render a native image. */
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
/* eslint-enable @next/next/no-img-element */

const cart = vi.hoisted(() => ({
  items: [] as Array<{ cartItemId: string; quantity: number; availableStock: number | null }>,
  addProduct: vi.fn(() => ({ limited: false })),
  setQuantity: vi.fn(),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/super-demo/inicio' }))
vi.mock('@/hooks/use-public-cart', () => ({ usePublicCart: () => cart }))
vi.mock('@/hooks/useWebsiteSettings', () => ({ useWebsiteSettings: () => ({ settings: { checkout: { commerceMode: 'cart' }, company_info: {} }, isLoading: false }) }))
vi.mock('@/components/public/storefront-style-context', () => ({ useStorefrontStyle: () => 'market' }))

const tomate = {
  id: 'tomate', name: 'Tomate perita', sale_price: 12950, offer_price: 9000, has_offer: true,
  in_stock: true, stock_quantity: 30, image: '/tomate.jpg', images: [], unit_measure: 'kg',
  category: { id: 'verduleria', name: 'Frutería y verdulería' },
} as unknown as PublicProduct

describe('plantilla Supermercado: tarjeta de producto', () => {
  beforeEach(() => {
    cart.items = []
    cart.addProduct.mockClear()
    cart.setQuantity.mockClear()
  })

  it('muestra el % OFF, el precio por unidad de medida y «Agregar» a lo ancho', () => {
    render(<ProductCard product={tomate} />)
    expect(screen.getByLabelText('31% de descuento')).toBeInTheDocument()
    expect(screen.getByText('Precio por kg')).toBeInTheDocument()
    expect(screen.getByText('Frutería y verdulería')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Tomate perita al carrito' }))
    expect(cart.addProduct).toHaveBeenCalledWith(tomate, 9000, 1, null)
  })

  it('ya en el carrito, la tarjeta cambia la cantidad sin abrir nada y respeta el stock', () => {
    cart.items = [{ cartItemId: 'tomate', quantity: 2, availableStock: 3 }]
    render(<ProductCard product={tomate} />)
    expect(screen.getByRole('group', { name: 'Cantidad de Tomate perita en el carrito' })).toHaveTextContent('2')
    fireEvent.click(screen.getByRole('button', { name: 'Sumar uno de Tomate perita' }))
    expect(cart.setQuantity).toHaveBeenCalledWith('tomate', 3)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar uno de Tomate perita' }))
    expect(cart.setQuantity).toHaveBeenLastCalledWith('tomate', 1)
  })

  it('no deja pasar del stock disponible', () => {
    cart.items = [{ cartItemId: 'tomate', quantity: 3, availableStock: 3 }]
    render(<ProductCard product={tomate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sumar uno de Tomate perita' }))
    expect(cart.setQuantity).not.toHaveBeenCalled()
  })
})

describe('plantilla Supermercado: reglas', () => {
  it('lo que se vende por unidad no lleva aclaración', () => {
    expect(marketUnitLabel('unidad')).toBeNull()
    expect(marketUnitLabel('Und.')).toBeNull()
    expect(marketUnitLabel('')).toBeNull()
    expect(marketUnitLabel('Litro')).toBe('Precio por litro')
  })

  it('el descuento solo cuenta si la oferta es real', () => {
    expect(productDiscountPct({ sale_price: 100, offer_price: 70, has_offer: true })).toBe(30)
    expect(productDiscountPct({ sale_price: 100, offer_price: 120, has_offer: true })).toBe(0)
    expect(productDiscountPct({ sale_price: 100, offer_price: 70, has_offer: false })).toBe(0)
  })

  it('los escalones de «Descuentos» acumulan los mayores y solo aparecen si tienen productos', () => {
    const offer = (pct: number) => ({ sale_price: 100, offer_price: 100 - pct, has_offer: true })
    expect(marketDiscountTiers([offer(15), offer(32), offer(55)])).toEqual([
      { min: 10, count: 3 },
      { min: 20, count: 2 },
      { min: 30, count: 2 },
      { min: 40, count: 1 },
      { min: 50, count: 1 },
    ])
    expect(marketDiscountTiers([offer(12)])).toEqual([{ min: 10, count: 1 }])
  })

  it('el inicio suma las góndolas por pasillo y el header la barra de pasillos', () => {
    const home = readFileSync(resolve(process.cwd(), 'src/app/(public)/inicio/HomePageClient.tsx'), 'utf8')
    const header = readFileSync(resolve(process.cwd(), 'src/components/public/PublicHeader.tsx'), 'utf8')
    expect(home).toContain('{isMarket && <MarketAisleRows />}')
    expect(header).toContain('const beautyCategories = isBeauty || isMarket')
  })
})
