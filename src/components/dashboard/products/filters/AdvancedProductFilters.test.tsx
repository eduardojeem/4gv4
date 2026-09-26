import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AdvancedProductFilters } from './AdvancedProductFilters'
import { useProductFiltering } from '@/hooks/products'

const { filteringState } = vi.hoisted(() => ({
  filteringState: {
    searchTerm: '', setSearchTerm: vi.fn(), filters: {}, updateFilters: vi.fn(),
    clearFilters: vi.fn(), activeFiltersCount: 0,
    priceRange: { min: 0, max: 1_000_000 }, stockRange: { min: 0, max: 100 },
    marginRange: { min: 0, max: 100 },
    categories: [{ id: 'cat-1', name: 'Remeras' }],
    suppliers: [{ id: 'sup-1', name: 'Proveedor Uno' }],
  },
}))

vi.mock('@/hooks/products', () => ({ useProductFiltering: vi.fn(() => filteringState) }))

describe('AdvancedProductFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useProductFiltering).mockReturnValue(filteringState as never)
  })

  it('muestra los controles principales y los datos disponibles', () => {
    render(<AdvancedProductFilters />)
    expect(screen.getByPlaceholderText('Buscar productos...')).toBeInTheDocument()
    expect(screen.getByText('Filtros Rápidos')).toBeInTheDocument()
    expect(screen.getByText('Categoría')).toBeInTheDocument()
    expect(screen.getByText('Proveedor')).toBeInTheDocument()
  })

  it('envía el texto de búsqueda al contrato actual del hook', () => {
    render(<AdvancedProductFilters />)
    fireEvent.change(screen.getByPlaceholderText('Buscar productos...'), { target: { value: 'sport' } })
    expect(filteringState.setSearchTerm).toHaveBeenCalledWith('sport')
  })

  it('aplica un filtro rápido mediante updateFilters', () => {
    render(<AdvancedProductFilters />)
    fireEvent.click(screen.getByRole('button', { name: /stock bajo/i }))
    expect(filteringState.updateFilters).toHaveBeenCalledWith({ stockStatus: ['low_stock', 'out_of_stock'] })
  })

  it('admite catálogos todavía no cargados sin romper la pantalla', () => {
    vi.mocked(useProductFiltering).mockReturnValue({
      ...filteringState, categories: undefined, suppliers: undefined,
    } as never)
    render(<AdvancedProductFilters />)
    expect(screen.getByPlaceholderText('Buscar productos...')).toBeInTheDocument()
  })
})
