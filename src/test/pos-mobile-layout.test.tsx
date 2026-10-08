import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Product } from '@/types/product-unified'
import { ProductCard } from '@/app/dashboard/pos/components/ProductCard'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const POS = leer('src/app/dashboard/pos/page.tsx')
const CSS = leer('src/app/dashboard/pos/pos.css')

describe('POS en el celular', () => {
  it('la barra del panel no tapa el «Cobrar» del POS', () => {
    expect(leer('src/components/dashboard/mobile-nav.tsx')).toContain("if (pathname === '/dashboard/pos') return null")
  })

  it('el POS ocupa el área del panel sin doble scroll', () => {
    expect(CSS).toContain('#dashboard-main:has(.pos-shell)')
    expect(CSS).toContain('#dashboard-main .pos-shell:not(.fixed)')
  })

  it('los colores del POS usan los del tema (están en oklch, no en hsl)', () => {
    expect(CSS).not.toMatch(/hsl\(var\(--/)
  })

  it('el buscador usa 16px en el celular para que iOS no haga zoom', () => {
    expect(POS).toContain('h-10 pl-8 pr-12 text-base sm:h-8 sm:text-xs')
  })

  it('el carrito del encabezado abre el mismo carrito editable que la barra inferior', () => {
    expect(POS).not.toContain('showCartDialog')
    expect(POS).toContain("else setIsMobileCartOpen(true)")
  })

  it('«Cobrar» no repite el total que ya muestra la barra', () => {
    const barra = POS.slice(POS.indexOf('{/* Mobile Cart Bottom Bar */}'))
    const cobrar = barra.slice(barra.indexOf('<CreditCard className="mr-2 h-5 w-5" />'), barra.indexOf('</Button>'))
    expect(cobrar).not.toContain('formatCurrency')
  })
})

describe('tarjeta de producto en el celular', () => {
  const product = { id: 'p1', name: 'Pomada', sku: 'P1', sale_price: 85000, stock_quantity: 4, is_active: true } as unknown as Product

  it('el botón de detalle tiene nombre y tamaño para el dedo', () => {
    render(<ProductCard product={product} addToCart={vi.fn()} formatCurrency={(n) => `Gs. ${n}`} onViewDetail={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Ver detalle de Pomada' })).toHaveClass('h-8', 'w-8')
  })

  it('no quedan textos de 7 u 8 px sin versión legible en el celular', () => {
    const card = leer('src/app/dashboard/pos/components/ProductCard.tsx')
    expect(card).not.toMatch(/(?<!sm:)text-\[(7|7\.5|8)px\]/)
  })
})
