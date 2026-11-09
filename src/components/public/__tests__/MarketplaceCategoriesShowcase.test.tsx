import { render, screen, fireEvent } from '@testing-library/react'
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

  it('filters slides interactively using the search input', () => {
    render(<MarketplaceCategoriesShowcase />)

    const searchInput = screen.getByPlaceholderText(/Buscar categoría.../i)
    fireEvent.change(searchInput, { target: { value: 'belleza' } })

    expect(screen.getByText('Belleza & Estética')).toBeInTheDocument()
    expect(screen.queryByText('Computación')).not.toBeInTheDocument()
  })

  it('shows empty state when no slide matches and allows resetting search', () => {
    render(<MarketplaceCategoriesShowcase />)

    const searchInput = screen.getByPlaceholderText(/Buscar categoría.../i)
    fireEvent.change(searchInput, { target: { value: 'categorianoinventada123' } })

    expect(screen.getByText(/No encontramos categorías para/i)).toBeInTheDocument()

    const resetBtn = screen.getByRole('button', { name: /Restablecer búsqueda/i })
    fireEvent.click(resetBtn)

    expect(screen.getByText('Belleza & Estética')).toBeInTheDocument()
  })

  it('renders navigation arrows and slide dot buttons', () => {
    render(<MarketplaceCategoriesShowcase />)

    expect(screen.getByRole('button', { name: /Slide anterior/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Siguiente slide/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Slide 1/i })).toBeInTheDocument()
  })
})
