import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Auditoría de /marketplace/productos (2026-10): la franja de categorías no se
 * podía recorrer con el mouse y el endpoint de favoritos respondía datos de
 * productos que la tienda no publica.
 */

type Row = Record<string, unknown>
let tablas: Record<string, Row[]> = {}

function fakeSupabase() {
  return {
    from(table: string) {
      const filtros: Array<(row: Row) => boolean> = []
      let soloSonda = false
      const builder: Record<string, unknown> = {
        select: (cols: string) => { if (/^hide_price$/.test(cols.trim())) soloSonda = true; return builder },
        in: (col: string, values: unknown[]) => { filtros.push((row) => values.includes(row[col])); return builder },
        eq: (col: string, value: unknown) => { filtros.push((row) => row[col] === value); return builder },
        limit: () => builder,
        then: (ok: (v: unknown) => unknown) =>
          Promise.resolve(soloSonda ? { data: [], error: null } : { data: (tablas[table] ?? []).filter((row) => filtros.every((f) => f(row))), error: null }).then(ok),
      }
      return builder
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => fakeSupabase() }))
vi.mock('@/lib/rate-limiter', () => ({ getClientIp: () => '1.1.1.1', rateLimiter: { check: async () => true } }))

const { POST } = await import('@/app/api/public/favorites/metadata/route')
const { forgetHidePriceColumnCheck } = await import('@/lib/products/price-visibility')
const { HorizontalScroller } = await import('@/components/public/HorizontalScroller')

const producto = (id: string, extra: Row = {}): Row => ({
  id, organization_id: 'org-abierta', name: `Producto ${id}`, description: 'detalle', sku: `SKU-${id}`, brand: 'Marca',
  image_url: null, images: [], sale_price: 150000, offer_price: null, has_offer: false, is_active: true,
  stock_quantity: 3, visibility: 'public', hide_price: false, ...extra,
})

const pedir = async (productIds: string[]) => {
  const response = await POST(new NextRequest('http://localhost/api/public/favorites/metadata', { method: 'POST', body: JSON.stringify({ productIds }) }))
  return (await response.json()) as { metadata: Record<string, { name: string; price: number; sku: string | null; isActive: boolean; hidePrice: boolean }> }
}

beforeEach(() => {
  forgetHidePriceColumnCheck()
  tablas = {
    organizations: [{ id: 'org-abierta', storefront_public: true }, { id: 'org-cerrada', storefront_public: false }],
    products: [
      producto('publico'),
      producto('oculto', { hide_price: true, has_offer: true, offer_price: 120000 }),
      producto('privado', { visibility: 'private' }),
      producto('pausado', { is_active: false }),
      producto('cerrada', { organization_id: 'org-cerrada' }),
    ],
  }
})

describe('el endpoint anónimo de favoritos', () => {
  it('responde los productos publicados', async () => {
    const { metadata } = await pedir(['publico'])
    expect(metadata.publico).toMatchObject({ name: 'Producto publico', price: 150000, sku: 'SKU-publico', isActive: true })
  })

  it('no devuelve el precio de «Precio a consultar» (su id está en el HTML del marketplace)', async () => {
    const { metadata } = await pedir(['oculto'])
    // En 0, no null: con null Favoritos volvía al precio guardado por la tarjeta.
    expect(metadata.oculto).toMatchObject({ price: 0, hidePrice: true })
    expect(JSON.stringify(metadata.oculto)).not.toMatch(/150000|120000/)
  })

  it.each(['privado', 'pausado', 'cerrada'])('no revela nada de un producto %s', async (id) => {
    const { metadata } = await pedir([id])
    expect(metadata[id]).toMatchObject({ name: '', price: 0, sku: null, isActive: false })
    expect(JSON.stringify(metadata[id])).not.toContain('detalle')
  })
})

describe('la franja de categorías', () => {
  const dibujar = () => {
    render(
      <HorizontalScroller label="categorías">
        <button type="button">Todas</button>
        <button type="button" data-active="true">Celulares</button>
      </HorizontalScroller>
    )
    const strip = screen.getByRole('group', { name: 'categorías' })
    // jsdom no calcula tamaños: una franja de 300px con 1200 de contenido.
    Object.defineProperty(strip, 'clientWidth', { value: 300, configurable: true })
    Object.defineProperty(strip, 'scrollWidth', { value: 1200, configurable: true })
    return strip
  }

  it('la rueda del mouse la mueve en horizontal', () => {
    const strip = dibujar()
    const ev = new WheelEvent('wheel', { deltaY: 200, bubbles: true, cancelable: true })
    strip.dispatchEvent(ev)
    expect(strip.scrollLeft).toBe(200)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('al llegar al final la rueda vuelve a bajar la página', () => {
    const strip = dibujar()
    strip.scrollLeft = 900
    const ev = new WheelEvent('wheel', { deltaY: 200, bubbles: true, cancelable: true })
    strip.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('el catálogo la usa para categorías y ramas', () => {
    const cliente = readFileSync(resolve(process.cwd(), 'src/components/public/ProductsClient.tsx'), 'utf8')
    expect(cliente).toContain('<HorizontalScroller label="categorías" activeKey={initialCategory}')
    expect(cliente).toContain('<HorizontalScroller label="ramas" activeKey={initialSubcategory}')
    // Cambiar de página vuelve al principio de la grilla.
    expect(cliente).toContain("gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })")
    // La tarjeta ya no guarda el precio oculto en el favorito.
    expect(cliente).toContain('price: precioOculto ? null : displayPrice')
  })
})
