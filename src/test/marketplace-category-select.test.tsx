import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const destino = () => new URL(String(push.mock.calls.at(-1)?.[0]), 'http://x').searchParams

beforeEach(() => {
  push.mockClear()
  search = ''
})

describe('el selector de categoría, al lado de marcas', () => {
  it('lista cada categoría con sus ramas, por nombre', () => {
    dibujar()
    const select = screen.getByRole('combobox', { name: 'Filtrar por categoría' })
    const grupos = [...select.querySelectorAll('optgroup')].map((g) => g.label)
    expect(grupos).toEqual(['Accesorios de Celular', 'Electrónica'])
    expect(screen.getByRole('option', { name: 'Todo Accesorios de Celular (6)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cargadores y Cables (3)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Electrónica (80)' })).toBeInTheDocument()
  })

  it('elegir una rama marca también su categoría', () => {
    dibujar()
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por categoría' }), { target: { value: 'sub:acc:cab' } })
    expect(destino().get('categoria')).toBe('acc')
    expect(destino().get('subcategoria')).toBe('cab')
  })

  it('cambiar de categoría borra la rama anterior y la página', () => {
    search = 'categoria=acc&subcategoria=cab&pagina=3&marca=Xiaomi'
    dibujar({ initialCategory: 'acc', initialSubcategory: 'cab' })
    const select = screen.getByRole('combobox', { name: 'Filtrar por categoría' }) as HTMLSelectElement
    expect(select.value).toBe('sub:acc:cab')

    fireEvent.change(select, { target: { value: 'cat:elec' } })
    expect(destino().get('categoria')).toBe('elec')
    expect(destino().has('subcategoria')).toBe(false)
    expect(destino().has('pagina')).toBe(false)
    // La marca elegida se mantiene.
    expect(destino().get('marca')).toBe('Xiaomi')
  })

  it('«Categorías» quita el filtro', () => {
    search = 'categoria=elec'
    dibujar({ initialCategory: 'elec' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por categoría' }), { target: { value: '' } })
    expect(destino().has('categoria')).toBe(false)
  })
})
