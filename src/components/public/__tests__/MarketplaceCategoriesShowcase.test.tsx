import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarketplaceCategoriesShowcase } from '../MarketplaceCategoriesShowcase'

describe('MarketplaceCategoriesShowcase', () => {
  it('renders title, badge and categories slides', () => {
    render(<MarketplaceCategoriesShowcase />)

    expect(screen.getByText('Categorías destacadas')).toBeInTheDocument()
    expect(screen.getByText('Belleza & Estética')).toBeInTheDocument()
    expect(screen.getByText('Electrodomésticos')).toBeInTheDocument()
    expect(screen.getByText('Muebles & Hogar')).toBeInTheDocument()
  })

  it('supports custom title, exploreAllHref and exploreAllLabel', () => {
    render(
      <MarketplaceCategoriesShowcase
        title="Explorar rubros top"
        exploreAllHref="/marketplace/categorias"
        exploreAllLabel="Ver todo el catálogo"
      />
    )

    expect(screen.getByText('Explorar rubros top')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Ver todo el catálogo/i })
    expect(link).toHaveAttribute('href', '/marketplace/categorias')
  })

  it('has no search box of its own', () => {
    render(<MarketplaceCategoriesShowcase />)
    expect(screen.queryByPlaceholderText(/Buscar categor/i)).toBeNull()
  })

  it('with real stats shows only rubros with products, sorted, linking to their categories', () => {
    render(
      <MarketplaceCategoriesShowcase
        stats={{
          belleza: { count: 87, categoryIds: ['c-1', 'c-2'], products: [{ id: 'p1', name: 'Perfume Blue', image: null, href: '/tienda/productos/p1' }] },
          electronica: { count: 156, categoryIds: ['c-3'], products: [] },
        }}
      />,
    )
    expect(screen.queryByText('Servicios')).toBeNull()
    expect(screen.queryByText('Muebles & Hogar')).toBeNull()
    const titles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(titles).toEqual(['Electrónica', 'Belleza & Estética'])
    expect(screen.getByRole('link', { name: /Ver 87 productos/ })).toHaveAttribute('href', '/marketplace/productos?categoria=c-1,c-2')
    expect(screen.getByText('156 productos')).toBeInTheDocument()
    expect(screen.getByTitle('Perfume Blue')).toHaveAttribute('href', '/tienda/productos/p1')
    expect(screen.getByText(/2 rubros · 243 productos/)).toBeInTheDocument()
  })

  it('renders navigation arrows and slide dot buttons', () => {
    render(<MarketplaceCategoriesShowcase />)

    expect(screen.getByRole('button', { name: /Slide anterior/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Siguiente slide/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Slide 1/i })).toBeInTheDocument()
  })
})
