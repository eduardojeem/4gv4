import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { screen, waitFor } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { AdvancedProductFilters } from './AdvancedProductFilters'

// Mock del hook de filtrado
vi.mock('../../../../hooks/products/useProductFiltering', () => ({
  useProductFiltering: () => ({
    filters: {
      search: '',
      category: '',
      supplier: '',
      stockStatus: 'all',
      priceRange: { min: 0, max: 1000 },
      stockRange: { min: 0, max: 100 },
      marginRange: { min: 0, max: 100 },
      dateRange: { start: null, end: null }
    },
    updateFilter: vi.fn(),
    clearAllFilters: vi.fn(),
    applyFilterPreset: vi.fn(),
    filterStats: { total: 100, filtered: 85 }
  })
}))

// Mock de componentes UI
vi.mock('@/components/ui/input', () => ({
  Input: ({ placeholder, value, onChange, ...props }: any) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      {...props}
    />
  )
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <select onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size }: any) => (
    <button onClick={onClick} className={`${variant} ${size}`}>
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, min, max }: any) => (
    <input
      type="range"
      min={min}
      max={max}
      value={value[0]}
      onChange={(e) => onValueChange([parseInt(e.target.value)])}
    />
  )
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span className={`badge ${variant}`}>{children}</span>
  )
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div className="card">{children}</div>,
  CardContent: ({ children }: any) => <div className="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div className="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 className="card-title">{children}</h3>
}))

describe('AdvancedProductFilters', () => {
  const defaultProps = {
    onFiltersChange: vi.fn(),
    showPresets: true,
    collapsible: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render search input', () => {
    render(<AdvancedProductFilters {...defaultProps} />)

    expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument()
  })

  it('should handle search input changes', async () => {
    const user = userEvent.setup()
    const mockUpdateFilter = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductFiltering').useProductFiltering).mockReturnValue({
      ...require('../../../../hooks/products/useProductFiltering').useProductFiltering(),
      updateFilter: mockUpdateFilter
    })

    render(<AdvancedProductFilters {...defaultProps} />)

    const searchInput = screen.getByPlaceholderText(/search products/i)
    await user.type(searchInput, 'laptop')

    expect(mockUpdateFilter).toHaveBeenCalledWith('search', 'laptop')
  })

  it('should display filter presets when enabled', () => {
    render(<AdvancedProductFilters {...defaultProps} showPresets={true} />)

    expect(screen.getByText(/low stock/i)).toBeInTheDocument()
    expect(screen.getByText(/out of stock/i)).toBeInTheDocument()
    expect(screen.getByText(/high margin/i)).toBeInTheDocument()
  })

  it('should handle preset selection', async () => {
    const user = userEvent.setup()
    const mockApplyFilterPreset = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductFiltering').useProductFiltering).mockReturnValue({
      ...require('../../../../hooks/products/useProductFiltering').useProductFiltering(),
      applyFilterPreset: mockApplyFilterPreset
    })

    render(<AdvancedProductFilters {...defaultProps} />)

    const lowStockPreset = screen.getByText(/low stock/i)
    await user.click(lowStockPreset)

    expect(mockApplyFilterPreset).toHaveBeenCalledWith('lowStock')
  })

  it('should display category filter', () => {
    render(<AdvancedProductFilters {...defaultProps} />)

    expect(screen.getByText(/category/i)).toBeInTheDocument()
  })

  it('should handle category selection', async () => {
    const user = userEvent.setup()
    const mockUpdateFilter = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductFiltering').useProductFiltering).mockReturnValue({
      ...require('../../../../hooks/products/useProductFiltering').useProductFiltering(),
      updateFilter: mockUpdateFilter
    })

    render(<AdvancedProductFilters {...defaultProps} />)

    const categorySelect = screen.getByRole('combobox', { name: /category/i })
    await user.selectOptions(categorySelect, 'electronics')

    expect(mockUpdateFilter).toHaveBeenCalledWith('category', 'electronics')
  })

  it('should display supplier filter', () => {
    render(<AdvancedProductFilters {...defaultProps} />)

    expect(screen.getByText(/supplier/i)).toBeInTheDocument()
  })

  it('should display stock status filter', () => {
    render(<AdvancedProductFilters {...defaultProps} />)

    expect(screen.getByText(/stock status/i)).toBeInTheDocument()
  })

  it('should handle stock status changes', async () => {
    const user = userEvent.setup()
    const mockUpdateFilter = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductFiltering').useProductFiltering).mockReturnValue({
      ...require('../../../../hooks/products/useProductFiltering').useProductFiltering(),
      updateFilter: mockUpdateFilter
    })

    render(<AdvancedProductFilters {...defaultProps} />)

    const stockStatusSelect = screen.getByRole('combobox', { name: /stock status/i })
    await user.selectOptions(stockStatusSelect, 'low')

    expect(mockUpdateFilter).toHaveBeenCalledWith('stockStatus', 'low')
  })

  it('should display price range filter', () => {
    render(<AdvancedProductFilters {...defaultProps} />)

    expect(screen.getByText(/price range/i)).toBeInTheDocument()
  })

  it('should handle price range changes', async () => {
    const user = userEvent.setup()
    const mockUpdateFilter = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductFiltering').useProductFiltering).mockReturnValue({
      ...require('../../../../hooks/products/useProductFiltering').useProductFiltering(),
      updateFilter: mockUpdateFilter
    })

    render(<AdvancedProductFilters {...defaultProps} />)

    const priceSlider = screen.getByRole('slider', { name: /price/i })
    await user.type(priceSlider, '500')

    expect(mockUpdateFilter).toHaveBeenCalledWith('priceRange', expect.any(Object))
  })

  it('should display stock range filter', () => {
    render(<AdvancedProductFilters {...defaultProps} />)

    expect(screen.getByText(/stock range/i)).toBeInTheDocument()
  })

  it('should display margin range filter', () => {
    render(<AdvancedProductFilters {...defaultProps} />)

    expect(screen.getByText(/margin/i)).toBeInTheDocument()
  })

  it('should display date range filter', () => {
    render(<AdvancedProductFilters {...defaultProps} />)

    expect(screen.getByText(/fecha de creación/i)).toBeInTheDocument()
  })

  it('should handle clear all filters', async () => {
    const user = userEvent.setup()
    const mockClearAllFilters = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductFiltering').useProductFiltering).mockReturnValue({
      ...require('../../../../hooks/products/useProductFiltering').useProductFiltering(),
      clearAllFilters: mockClearAllFilters
    })

    render(<AdvancedProductFilters {...defaultProps} />)

    const clearButton = screen.getByRole('button', { name: /clear all/i })
    await user.click(clearButton)

    expect(mockClearAllFilters).toHaveBeenCalled()
  })

  it('should display filter statistics', () => {
    render(<AdvancedProductFilters {...defaultProps} />)

    expect(screen.getByText(/85 of 100 products/i)).toBeInTheDocument()
  })

  it('should render in collapsible mode', () => {
    render(<AdvancedProductFilters {...defaultProps} collapsible={true} />)

    // En modo colapsable, el contenido puede estar oculto inicialmente
    expect(screen.getByText(/filtros avanzados/i)).toBeInTheDocument()
  })

  it('should show all filters by default', () => {
    render(<AdvancedProductFilters {...defaultProps} />)

    expect(screen.getByText(/rango de precio/i)).toBeInTheDocument()
    expect(screen.getByText(/rango de stock/i)).toBeInTheDocument()
    expect(screen.getByText(/margen de beneficio/i)).toBeInTheDocument()
  })

  it('should hide presets when showPresets is false', () => {
    render(<AdvancedProductFilters {...defaultProps} showPresets={false} />)

    expect(screen.queryByText(/low stock/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/out of stock/i)).not.toBeInTheDocument()
  })

  it('should handle active filters display', () => {
    vi.mocked(require('../../../../hooks/products/useProductFiltering').useProductFiltering).mockReturnValue({
      ...require('../../../../hooks/products/useProductFiltering').useProductFiltering(),
      filters: {
        search: 'laptop',
        category: 'electronics',
        supplier: 'supplier-1',
        stockStatus: 'low',
        priceRange: { min: 100, max: 500 },
        stockRange: { min: 0, max: 10 },
        marginRange: { min: 20, max: 50 },
        dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      }
    })

    render(<AdvancedProductFilters {...defaultProps} />)

    // Debería mostrar filtros activos
    expect(screen.getByText('laptop')).toBeInTheDocument()
    expect(screen.getByText('electronics')).toBeInTheDocument()
    expect(screen.getByText('Low Stock')).toBeInTheDocument()
  })

  it('should handle filter removal from active filters', async () => {
    const user = userEvent.setup()
    const mockUpdateFilter = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductFiltering').useProductFiltering).mockReturnValue({
      ...require('../../../../hooks/products/useProductFiltering').useProductFiltering(),
      filters: {
        search: 'laptop',
        category: 'electronics',
        supplier: '',
        stockStatus: 'all',
        priceRange: { min: 0, max: 1000 },
        stockRange: { min: 0, max: 100 },
        marginRange: { min: 0, max: 100 },
        dateRange: { start: null, end: null }
      },
      updateFilter: mockUpdateFilter
    })

    render(<AdvancedProductFilters {...defaultProps} />)

    // Buscar botón de eliminar filtro
    const removeFilterButton = screen.getByRole('button', { name: /remove.*laptop/i })
    await user.click(removeFilterButton)

    expect(mockUpdateFilter).toHaveBeenCalledWith('search', '')
  })

  it('should handle responsive design', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })

    render(<AdvancedProductFilters {...defaultProps} />)

    // Debería adaptar el layout para móvil
    expect(screen.getByTestId('mobile-filters')).toBeInTheDocument()
  })

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup()

    render(<AdvancedProductFilters {...defaultProps} />)

    // Test tab navigation
    await user.tab()
    expect(document.activeElement).toHaveAttribute('placeholder', /search products/i)

    await user.tab()
    expect(document.activeElement).toHaveAttribute('role', 'combobox')
  })

  it('should call onFiltersChange when filters update', async () => {
    const user = userEvent.setup()
    const mockOnFiltersChange = vi.fn()

    render(<AdvancedProductFilters {...defaultProps} onFiltersChange={mockOnFiltersChange} />)

    const searchInput = screen.getByPlaceholderText(/search products/i)
    await user.type(searchInput, 'test')

    expect(mockOnFiltersChange).toHaveBeenCalled()
  })

  it('should handle date range picker', async () => {
    const user = userEvent.setup()
    const mockUpdateFilter = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductFiltering').useProductFiltering).mockReturnValue({
      ...require('../../../../hooks/products/useProductFiltering').useProductFiltering(),
      updateFilter: mockUpdateFilter
    })

    render(<AdvancedProductFilters {...defaultProps} />)

    const dateInput = screen.getByLabelText(/start date/i)
    await user.type(dateInput, '2024-01-01')

    expect(mockUpdateFilter).toHaveBeenCalledWith('dateRange', expect.any(Object))
  })
})