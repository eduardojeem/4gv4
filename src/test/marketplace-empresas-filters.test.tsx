import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

let url = ''
const push = vi.fn()
const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/marketplace/empresas',
  useSearchParams: () => new URLSearchParams(url),
}))

const { EmpresasClient } = await import('@/components/public/EmpresasClient')
const { cityFacets, filterOrganizations, rubroFacets, sortOrganizations } = await import('@/lib/public/empresas-filters')
const { TopRatedCarousel } = await import('@/components/public/TopRatedCarousel')

const org = (id: string, name: string, vertical: string, rubro: string, city: string, extra: Partial<MarketplaceOrganization> = {}) => ({
  id, name, slug: id, plan: 'PRO', logo_url: null, business_vertical: vertical, rubro, city, address: null,
  created_at: '2026-01-01T00:00:00Z', products_count: 0, featured_products: [], ...extra,
}) as MarketplaceOrganization

const ORGS = [
  org('a', 'Mundo Celulares', 'electronics', 'tecnologia', 'Encarnación', { products_count: 40, review_rating_avg: 4, review_count: 3 }),
  org('b', 'Compu Center', 'electronics', 'tecnologia', 'Asunción', { products_count: 10 }),
  org('c', 'Boutique Luna', 'clothing', 'indumentaria', 'Encarnación', { products_count: 5, review_rating_avg: 5, review_count: 8 }),
  org('d', 'Barbería Don', 'barbershop', 'barberia', 'Encarnación'),
  org('e', 'Almacén Central', 'general', 'comercio', 'Encarnación'),
]
const base = { query: '', rubro: 'all', city: 'all' }

describe('reglas de los filtros', () => {
  it('el buscador encuentra los rubros por su nombre en castellano', () => {
    const names = (query: string) => filterOrganizations(ORGS, { ...base, query }).map((o) => o.name)
    expect(names('tecnologia')).toEqual(['Mundo Celulares', 'Compu Center'])
    expect(names('ropa')).toEqual(['Boutique Luna'])
    expect(names('moda')).toEqual(['Boutique Luna'])
    expect(names('peluqueria')).toEqual(['Barbería Don'])
  })

  it('cada chip cuenta con la búsqueda y la ciudad puestas', () => {
    const facets = rubroFacets(ORGS, { ...base, query: 'mundo' })
    expect(facets.find((f) => f.id === 'tecnologia')?.count).toBe(1)
    expect(facets.find((f) => f.id === 'indumentaria')?.count).toBe(0)
  })

  it('los chips usan los mismos nombres que las tarjetas e incluyen Barbería', () => {
    expect(rubroFacets(ORGS, base).map((f) => f.label)).toEqual(['Tecnología', 'Moda & Retail', 'Barbería & Peluquería', 'Comercio general'])
  })

  it('las ciudades cuentan con el rubro elegido', () => {
    const facets = cityFacets(ORGS, { ...base, rubro: 'tecnologia' })
    expect(facets.map((f) => [f.display, f.count])).toEqual([['Asunción', 1], ['Encarnación', 1]])
  })

  it('ordena por calificación, productos y nombre', () => {
    expect(sortOrganizations(ORGS, 'calificacion')[0].name).toBe('Boutique Luna')
    expect(sortOrganizations(ORGS, 'productos')[0].name).toBe('Mundo Celulares')
    expect(sortOrganizations(ORGS, 'nombre')[0].name).toBe('Almacén Central')
    expect(sortOrganizations(ORGS, 'destacadas')).toBe(ORGS)
  })
})

describe('el directorio', () => {
  beforeEach(() => {
    url = ''
    push.mockReset()
    replace.mockReset()
  })

  it('con Atrás vuelve a mostrar lo que dice la URL', () => {
    url = 'rubro=tecnologia'
    const { rerender } = render(<EmpresasClient organizations={ORGS} initialRubro="tecnologia" />)
    expect(screen.getByText('Rubro: Tecnología')).toBeInTheDocument()
    expect(screen.queryByText('Boutique Luna')).not.toBeInTheDocument()

    url = ''
    rerender(<EmpresasClient organizations={ORGS} initialRubro="tecnologia" />)
    expect(screen.queryByText('Rubro: Tecnología')).not.toBeInTheDocument()
    expect(screen.getByText('Boutique Luna')).toBeInTheDocument()
  })

  it('escribir no llena el historial: reemplaza la entrada', () => {
    vi.useFakeTimers()
    try {
      render(<EmpresasClient organizations={ORGS} />)
      fireEvent.change(screen.getByLabelText('Buscar tiendas'), { target: { value: 'celulares' } })
      act(() => { vi.advanceTimersByTime(500) })
      expect(replace).toHaveBeenCalledWith('/marketplace/empresas?q=celulares', { scroll: false })
      expect(push).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('un rubro sin tiendas para la búsqueda se ve pero no se puede elegir', () => {
    render(<EmpresasClient organizations={ORGS} />)
    fireEvent.change(screen.getByLabelText('Buscar tiendas'), { target: { value: 'celulares' } })
    expect(screen.getByRole('button', { name: /Moda & Retail/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Tecnología/ })).toBeEnabled()
  })

  it('con una sola ciudad no muestra el filtro de ciudad', () => {
    render(<EmpresasClient organizations={ORGS.filter((o) => o.city === 'Encarnación')} />)
    expect(screen.queryByLabelText('Filtrar por ciudad')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ordenar tiendas')).toBeInTheDocument()
  })
})

describe('las mejor calificadas', () => {
  it('no aparecen con pocas reseñas', () => {
    const pocas = [org('x', 'X', 'general', 'comercio', 'Encarnación', { review_rating_avg: 5, review_count: 1 }), org('y', 'Y', 'general', 'comercio', 'Encarnación', { review_rating_avg: 5, review_count: 1 })]
    const { container } = render(<TopRatedCarousel organizations={pocas} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('aparecen con al menos 3 tiendas con 2 reseñas o más', () => {
    const varias = ['p', 'q', 'r'].map((id) => org(id, `Tienda ${id}`, 'general', 'comercio', 'Encarnación', { review_rating_avg: 4.5, review_count: 2 }))
    render(<TopRatedCarousel organizations={varias} />)
    expect(screen.getByText('Las mejor calificadas del marketplace')).toBeInTheDocument()
  })
})
