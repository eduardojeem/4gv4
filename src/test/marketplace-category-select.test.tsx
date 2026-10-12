import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
let search = ''

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/marketplace/productos',
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock('@/components/public/MarketplaceProductModal', () => ({ MarketplaceProductModal: () => null }))
vi.mock('@/components/public/Favorites', () => ({ FavoriteButton: () => null }))

const { ProductsClient } = await import('@/components/public/ProductsClient')

const categorias = [
  { id: 'acc', name: 'Accesorios de Celular', parent_id: null, product_count: 3, organization_count: 1 },
  { id: 'cab', name: 'Cargadores y Cables', parent_id: 'acc', product_count: 3, organization_count: 1 },
  { id: 'elec', name: 'Electrónica', parent_id: null, product_count: 80, organization_count: 4 },
]

const dibujar = (props: Record<string, string> = {}) =>
  render(<ProductsClient products={[]} serverPaginated categories={categorias} brands={[]} {...props} />)

const abrir = (nombre: RegExp | string = 'Filtrar por categoría') =>
  fireEvent.click(screen.getByRole('button', { name: nombre }))

// Nombre y cantidad, separados como se leen.
const opciones = () =>
  screen.getAllByRole('option').map((o) =>
    [...o.querySelectorAll('span')].map((span) => span.textContent?.trim()).filter(Boolean).join(' ') || o.textContent?.trim()
  )

const destino = () => new URL(String(push.mock.calls.at(-1)?.[0]), 'http://x').searchParams

beforeAll(() => {
  // cmdk y Radix usan APIs de diseño que jsdom no trae.
  Element.prototype.scrollIntoView ??= () => {}
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
})

beforeEach(() => {
  push.mockClear()
  search = ''
})

describe('el selector de categoría, al lado de marcas', () => {
  it('lista las categorías por cantidad de productos, con sus ramas debajo', () => {
    dibujar()
    abrir()
    expect(opciones()).toEqual([
      'Todas las categorías',
      'Electrónica 80',
      'Accesorios de Celular 6',
      'Cargadores y Cables 3',
    ])
  })

  it('busca sin tildes y muestra la rama con su categoría', () => {
    dibujar()
    abrir()
    fireEvent.change(screen.getByPlaceholderText('Buscar categoría…'), { target: { value: 'electronica' } })
    expect(opciones()).toEqual(['Electrónica 80'])

    fireEvent.change(screen.getByPlaceholderText('Buscar categoría…'), { target: { value: 'cargad' } })
    expect(opciones()).toEqual(['Accesorios de Celular 6', 'Cargadores y Cables 3'])
  })

  it('avisa cuando ninguna coincide', () => {
    dibujar()
    abrir()
    fireEvent.change(screen.getByPlaceholderText('Buscar categoría…'), { target: { value: 'zapatos' } })
    expect(screen.getByText('Ninguna categoría se llama así.')).toBeInTheDocument()
  })

  it('elegir una rama marca también su categoría', () => {
    dibujar()
    abrir()
    fireEvent.click(screen.getByRole('option', { name: /Cargadores y Cables/ }))
    expect(destino().get('categoria')).toBe('acc')
    expect(destino().get('subcategoria')).toBe('cab')
  })

  it('muestra lo elegido y al cambiar borra la rama y la página, no la marca', () => {
    search = 'categoria=acc&subcategoria=cab&pagina=3&marca=Xiaomi'
    dibujar({ initialCategory: 'acc', initialSubcategory: 'cab' })
    abrir('Categoría: Cargadores y Cables. Cambiar categoría')

    fireEvent.click(screen.getByRole('option', { name: /Electrónica/ }))
    expect(destino().get('categoria')).toBe('elec')
    expect(destino().has('subcategoria')).toBe(false)
    expect(destino().has('pagina')).toBe(false)
    expect(destino().get('marca')).toBe('Xiaomi')
  })

  it('«Todas las categorías» quita el filtro', () => {
    search = 'categoria=elec'
    dibujar({ initialCategory: 'elec' })
    abrir('Categoría: Electrónica. Cambiar categoría')
    fireEvent.click(screen.getByRole('option', { name: 'Todas las categorías' }))
    expect(destino().has('categoria')).toBe(false)
  })
})
