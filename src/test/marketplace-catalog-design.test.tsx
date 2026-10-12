import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { displayCategoryName } from '@/lib/public/display-names'

const push = vi.fn()
let search = ''

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/marketplace/productos',
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock('@/components/public/MarketplaceProductModal', () => ({
  MarketplaceProductModal: ({ product }: { product: { name: string } | null }) => (product ? <div role="dialog">Detalle de {product.name}</div> : null),
}))
vi.mock('@/components/public/Favorites', () => ({ FavoriteButton: () => null }))

const { ProductsClient } = await import('@/components/public/ProductsClient')

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {}
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
})

beforeEach(() => {
  push.mockClear()
  search = ''
})

const producto = {
  id: 'p1', name: 'Teclado USB', sale_price: 90000, image: null, images: [], in_stock: true, featured: false,
  has_offer: false, offer_price: null, brand: 'Logitech', category: { id: 'c1', name: 'TECLADOS' },
  organization_id: 'o1', organization_name: 'Tecno Store', organization_slug: 'tecno', organization_logo_url: null,
} as never

const marcas = [
  { name: 'Logitech', product_count: 12, organization_count: 2, logo_url: null },
  { name: 'Xiaomi', product_count: 14, organization_count: 3, logo_url: null },
]

describe('los nombres de categoría', () => {
  it.each([
    ['HOGAR', 'Hogar'],
    ['COSINA', 'Cosina'],
    ['accesorios', 'Accesorios'],
    ['audio', 'Audio'],
    ['CCTV', 'CCTV'],
    ['Pantallas LCD/OLED', 'Pantallas LCD/OLED'],
    ['iPhone', 'iPhone'],
    ['  Audio   y Video ', 'Audio y Video'],
  ])('%s se muestra como %s', (entrada, esperado) => {
    expect(displayCategoryName(entrada)).toBe(esperado)
  })
})

describe('la tarjeta del catálogo', () => {
  it('toda la tarjeta abre el detalle y tiene una sola acción', () => {
    render(<ProductsClient products={[producto]} serverPaginated totalProducts={1} brands={marcas} />)
    expect(screen.queryByRole('button', { name: /Detalle/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver en la tienda/ })).toHaveAttribute('href', '/tecno/productos/p1')

    fireEvent.click(screen.getByText('Tecno Store').closest('div.group')!.querySelector('.border-t')!)
    expect(screen.getByRole('dialog')).toHaveTextContent('Detalle de Teclado USB')
  })

  it('muestra la categoría con mayúscula inicial', () => {
    render(<ProductsClient products={[producto]} serverPaginated totalProducts={1} brands={marcas} />)
    expect(screen.getByText('Teclados')).toBeInTheDocument()
  })
})

describe('el selector de marca', () => {
  it('busca sin tildes y filtra por la elegida', () => {
    render(<ProductsClient products={[producto]} serverPaginated totalProducts={1} brands={marcas} />)
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar por marca' }))
    fireEvent.change(screen.getByPlaceholderText('Buscar marca…'), { target: { value: 'xia' } })
    fireEvent.click(screen.getByRole('option', { name: /Xiaomi/ }))
    expect(new URL(String(push.mock.calls.at(-1)?.[0]), 'http://x').searchParams.get('marca')).toBe('Xiaomi')
  })

  it('sigue visible con una marca elegida aunque no haya resultados', () => {
    search = 'marca=Sony&q=zzz'
    render(<ProductsClient products={[]} serverPaginated totalProducts={0} brands={[]} initialBrand="Sony" initialQuery="zzz" />)
    expect(screen.getByRole('button', { name: 'Marca: Sony. Cambiar marca' })).toBeInTheDocument()
  })
})

describe('sin resultados', () => {
  it('propone quitar cada filtro por separado', () => {
    search = 'marca=Xiaomi&q=zzz'
    render(<ProductsClient products={[]} serverPaginated totalProducts={0} brands={marcas} initialBrand="Xiaomi" initialQuery="zzz" />)

    expect(screen.getByRole('button', { name: /Búsqueda «zzz»/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Marca Xiaomi$/ }))
    const destino = new URL(String(push.mock.calls.at(-1)?.[0]), 'http://x').searchParams
    expect(destino.has('marca')).toBe(false)
    expect(destino.get('q')).toBe('zzz')
  })
})

describe('el encabezado del catálogo', () => {
  it('ocupa una línea en el celular', () => {
    const pagina = readFileSync(resolve(process.cwd(), 'src/app/marketplace/productos/page.tsx'), 'utf8')
    expect(pagina).toContain('className="mb-6 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"')
    expect(pagina).toContain('<span className="hidden sm:inline"> encontrado')
  })
})
