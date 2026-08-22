import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EnhancedProductList } from './EnhancedProductList'
import { useProductManagement, useProductFiltering } from '@/hooks/products'

// Los valores base viven en vi.hoisted para que las factories de vi.mock —que
// se izan por encima de los imports— puedan leerlos, y para que cada test arme
// sus variantes con spread sin volver a escribir el objeto entero.
const { baseManagement, baseFiltering } = vi.hoisted(() => ({
  baseManagement: {
    products: [
      {
        id: '1',
        name: 'Laptop Gaming',
        sku: 'LAP-001',
        stock_quantity: 15,
        sale_price: 1299.99,
        purchase_price: 899.99,
        category_id: 'electronics',
        supplier_id: 'supplier-1',
        created_at: '2024-01-15T10:00:00Z'
      },
      {
        id: '2',
        name: 'Mouse Inalámbrico',
        sku: 'MOU-001',
        stock_quantity: 3,
        sale_price: 49.99,
        purchase_price: 29.99,
        category_id: 'accessories',
        supplier_id: 'supplier-2',
        created_at: '2024-02-10T14:30:00Z'
      }
    ],
    selectedProducts: [] as unknown[],
    loading: false,
    error: null as string | null,
    totalCount: 2,
    selectProduct: vi.fn(),
    selectAllProducts: vi.fn(),
    clearSelection: vi.fn(),
    setSortConfig: vi.fn(),
    setPagination: vi.fn(),
    refreshProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    bulkDelete: vi.fn(),
    bulkUpdate: vi.fn(),
    sortConfig: { field: 'name', direction: 'asc' },
    pagination: { page: 1, limit: 10 }
  },
  baseFiltering: {
    filteredProducts: [
      {
        id: '1',
        name: 'Laptop Gaming',
        sku: 'LAP-001',
        stock_quantity: 15,
        sale_price: 1299.99,
        purchase_price: 899.99,
        category_id: 'electronics',
        supplier_id: 'supplier-1',
        created_at: '2024-01-15T10:00:00Z'
      }
    ],
    filters: {
      search: '',
      category: '',
      supplier: '',
      stockStatus: 'all'
    },
    updateFilter: vi.fn(),
    clearAllFilters: vi.fn(),
    applyFilterPreset: vi.fn(),
    filterStats: { total: 2, filtered: 1 }
  }
}))

// El componente importa los hooks desde el barrel '@/hooks/products', no desde
// los módulos sueltos: mockear las rutas individuales no lo intercepta.
vi.mock('@/hooks/products', () => ({
  useProductManagement: vi.fn(() => baseManagement),
  useProductFiltering: vi.fn(() => baseFiltering)
}))

// Mock de componentes UI
vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  )
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size }: any) => (
    <button onClick={onClick} className={`${variant} ${size}`}>
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span className={`badge ${variant}`}>{children}</span>
  )
}))

describe('EnhancedProductList', () => {
  const defaultProps = {
    onProductSelect: vi.fn(),
    onProductEdit: vi.fn(),
    onProductDelete: vi.fn(),
    onProductDuplicate: vi.fn(),
    viewMode: 'table' as const,
    showSelection: true,
    showActions: true,
    showFilters: true,
    showPagination: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks borra las llamadas pero conserva los mockReturnValue, así
    // que hay que devolver ambos hooks a su valor base o el override de un test
    // se filtra al siguiente.
    vi.mocked(useProductManagement).mockReturnValue(baseManagement)
    vi.mocked(useProductFiltering).mockReturnValue(baseFiltering)
  })

  it('should render product list correctly', () => {
    render(<EnhancedProductList {...defaultProps} />)

    expect(screen.getByText('Laptop Gaming')).toBeInTheDocument()
    expect(screen.getByText('LAP-001')).toBeInTheDocument()
    expect(screen.getByText('$1,299.99')).toBeInTheDocument()
  })

  it('should display loading state', () => {
    // Mock loading state
    vi.mocked(useProductManagement).mockReturnValue({
      ...baseManagement,
      loading: true
    })

    render(<EnhancedProductList {...defaultProps} />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('should display error state', () => {
    // Mock error state
    vi.mocked(useProductManagement).mockReturnValue({
      ...baseManagement,
      error: 'Failed to load products'
    })

    render(<EnhancedProductList {...defaultProps} />)

    expect(screen.getByText(/error/i)).toBeInTheDocument()
    expect(screen.getByText(/failed to load products/i)).toBeInTheDocument()
  })

  it('should display empty state when no products', () => {
    // Mock empty products
    vi.mocked(useProductManagement).mockReturnValue({
      ...baseManagement,
      products: []
    })

    vi.mocked(useProductFiltering).mockReturnValue({
      ...baseFiltering,
      filteredProducts: []
    })

    render(<EnhancedProductList {...defaultProps} />)

    expect(screen.getByText(/no products found/i)).toBeInTheDocument()
  })

  it('should handle product selection', async () => {
    const user = userEvent.setup()
    const mockSelectProduct = vi.fn()

    vi.mocked(useProductManagement).mockReturnValue({
      ...baseManagement,
      selectProduct: mockSelectProduct
    })

    render(<EnhancedProductList {...defaultProps} />)

    const checkbox = screen.getAllByRole('checkbox')[1] // First product checkbox
    await user.click(checkbox)

    expect(mockSelectProduct).toHaveBeenCalledWith('1')
  })

  it('should handle select all products', async () => {
    const user = userEvent.setup()
    const mockSelectAllProducts = vi.fn()

    vi.mocked(useProductManagement).mockReturnValue({
      ...baseManagement,
      selectAllProducts: mockSelectAllProducts
    })

    render(<EnhancedProductList {...defaultProps} />)

    const selectAllCheckbox = screen.getAllByRole('checkbox')[0] // Header checkbox
    await user.click(selectAllCheckbox)

    expect(mockSelectAllProducts).toHaveBeenCalled()
  })

  it('should handle sorting', async () => {
    const user = userEvent.setup()
    const mockSetSortConfig = vi.fn()

    vi.mocked(useProductManagement).mockReturnValue({
      ...baseManagement,
      setSortConfig: mockSetSortConfig
    })

    render(<EnhancedProductList {...defaultProps} />)

    const nameHeader = screen.getByText('Name')
    await user.click(nameHeader)

    expect(mockSetSortConfig).toHaveBeenCalledWith({
      field: 'name',
      direction: 'desc' // Should toggle from current 'asc'
    })
  })

  it('should display stock status correctly', () => {
    render(<EnhancedProductList {...defaultProps} />)

    // Laptop Gaming has stock 15 - should show "In Stock"
    expect(screen.getByText('In Stock')).toBeInTheDocument()
  })

  it('should display margin information', () => {
    render(<EnhancedProductList {...defaultProps} />)

    // Should calculate and display margin percentage
    const marginElements = screen.getAllByText(/\d+%/)
    expect(marginElements.length).toBeGreaterThan(0)
  })

  it('should handle product actions', async () => {
    const user = userEvent.setup()

    render(<EnhancedProductList {...defaultProps} />)

    // Find and click action button
    const actionButtons = screen.getAllByRole('button')
    const actionButton = actionButtons.find(button => 
      button.textContent?.includes('Actions') || button.getAttribute('aria-label')?.includes('actions')
    )

    if (actionButton) {
      await user.click(actionButton)

      // Should show action menu
      await waitFor(() => {
        expect(screen.getByText(/edit/i) || screen.getByText(/view/i)).toBeInTheDocument()
      })
    }
  })

  it('should handle view mode changes', () => {
    const { rerender } = render(<EnhancedProductList {...defaultProps} viewMode="grid" />)

    // Should render in grid mode
    expect(screen.getByTestId('product-grid')).toBeInTheDocument()

    rerender(<EnhancedProductList {...defaultProps} viewMode="table" />)

    // Should render in table mode
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('should handle pagination', async () => {
    const user = userEvent.setup()
    const mockSetPagination = vi.fn()

    vi.mocked(useProductManagement).mockReturnValue({
      ...baseManagement,
      setPagination: mockSetPagination,
      totalCount: 25 // More than one page
    })

    render(<EnhancedProductList {...defaultProps} />)

    // Find pagination controls
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    expect(mockSetPagination).toHaveBeenCalledWith({
      page: 2,
      limit: 10
    })
  })

  it('should handle bulk operations', async () => {
    const user = userEvent.setup()
    const mockBulkDelete = vi.fn()

    vi.mocked(useProductManagement).mockReturnValue({
      ...baseManagement,
      selectedProducts: ['1', '2'],
      bulkDelete: mockBulkDelete
    })

    render(<EnhancedProductList {...defaultProps} />)

    // Should show bulk actions when products are selected
    const bulkDeleteButton = screen.getByRole('button', { name: /delete selected/i })
    await user.click(bulkDeleteButton)

    expect(mockBulkDelete).toHaveBeenCalledWith(['1', '2'])
  })

  it('should format currency correctly', () => {
    render(<EnhancedProductList {...defaultProps} />)

    expect(screen.getByText('$1,299.99')).toBeInTheDocument()
    expect(screen.getByText('$49.99')).toBeInTheDocument()
  })

  it('should format dates correctly', () => {
    render(<EnhancedProductList {...defaultProps} />)

    // Should display formatted creation dates
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
  })

  it('should handle responsive design', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })

    render(<EnhancedProductList {...defaultProps} />)

    // Should adapt to mobile layout
    expect(screen.getByTestId('mobile-product-list')).toBeInTheDocument()
  })

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup()

    render(<EnhancedProductList {...defaultProps} />)

    // Test tab navigation
    await user.tab()
    expect(document.activeElement).toHaveAttribute('role', 'checkbox')

    await user.tab()
    expect(document.activeElement).toHaveAttribute('role', 'button')
  })

  it('should handle search integration', async () => {
    const user = userEvent.setup()
    const mockUpdateFilter = vi.fn()

    vi.mocked(useProductFiltering).mockReturnValue({
      ...baseFiltering,
      updateFilter: mockUpdateFilter
    })

    render(<EnhancedProductList {...defaultProps} />)

    const searchInput = screen.getByPlaceholderText(/search products/i)
    await user.type(searchInput, 'laptop')

    expect(mockUpdateFilter).toHaveBeenCalledWith('search', 'laptop')
  })
})