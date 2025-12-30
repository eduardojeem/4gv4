import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductAnalyticsDashboard } from './ProductAnalyticsDashboard'

// Mock del hook de analytics
vi.mock('../../../../hooks/products/useProductAnalytics', () => ({
  useProductAnalytics: () => ({
    analytics: {
      totalProducts: 150,
      totalValue: 125000,
      averagePrice: 833.33,
      lowStockCount: 12,
      outOfStockCount: 5,
      topCategories: [
        { category: 'Electronics', count: 45, value: 67500 },
        { category: 'Accessories', count: 38, value: 28500 }
      ],
      topSuppliers: [
        { supplier: 'Supplier A', count: 52, value: 78000 },
        { supplier: 'Supplier B', count: 41, value: 31500 }
      ],
      trends: {
        daily: [
          { date: '2024-01-01', products: 148, value: 123000 },
          { date: '2024-01-02', products: 150, value: 125000 }
        ],
        weekly: [
          { week: '2024-W01', products: 145, value: 120000 },
          { week: '2024-W02', products: 150, value: 125000 }
        ],
        monthly: [
          { month: '2024-01', products: 150, value: 125000 }
        ]
      }
    },
    loading: false,
    error: null,
    timeRange: '30d',
    refreshAnalytics: vi.fn(),
    setTimeRange: vi.fn(),
    exportData: vi.fn(),
    getKeyMetrics: vi.fn(() => ({
      totalProducts: 150,
      totalValue: 125000,
      averagePrice: 833.33,
      lowStockCount: 12,
      outOfStockCount: 5
    })),
    getInventoryAlerts: vi.fn(() => ({
      lowStock: [
        { id: '1', name: 'Product 1', stock_quantity: 3 }
      ],
      outOfStock: [
        { id: '2', name: 'Product 2', stock_quantity: 0 }
      ]
    })),
    getCategoryAnalysis: vi.fn(() => [
      { category: 'Electronics', count: 45, value: 67500 },
      { category: 'Accessories', count: 38, value: 28500 }
    ]),
    getSupplierAnalysis: vi.fn(() => [
      { supplier: 'Supplier A', count: 52, value: 78000 },
      { supplier: 'Supplier B', count: 41, value: 31500 }
    ]),
    getTrendData: vi.fn((period) => {
      if (period === 'daily') {
        return [
          { date: '2024-01-01', products: 148, value: 123000 },
          { date: '2024-01-02', products: 150, value: 125000 }
        ]
      }
      return []
    })
  })
}))

// Mock de componentes UI
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div className="card">{children}</div>,
  CardContent: ({ children }: any) => <div className="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div className="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 className="card-title">{children}</h3>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size }: any) => (
    <button onClick={onClick} className={`${variant} ${size}`}>
      {children}
    </button>
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

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span className={`badge ${variant}`}>{children}</span>
  )
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: any) => (
    <div className="progress" data-value={value}>
      <div style={{ width: `${value}%` }} />
    </div>
  )
}))

// Mock de gráficos
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  Pie: () => <div data-testid="pie" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>
}))

describe('ProductAnalyticsDashboard', () => {
  const defaultProps = {
    showTimeControls: true,
    showExportOptions: true,
    compact: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render key metrics correctly', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} />)

    expect(screen.getByText('150')).toBeInTheDocument() // Total products
    expect(screen.getByText('$125,000')).toBeInTheDocument() // Total value
    expect(screen.getByText('$833.33')).toBeInTheDocument() // Average price
    expect(screen.getByText('12')).toBeInTheDocument() // Low stock count
    expect(screen.getByText('5')).toBeInTheDocument() // Out of stock count
  })

  it('should display loading state', () => {
    vi.mocked(require('../../../../hooks/products/useProductAnalytics').useProductAnalytics).mockReturnValue({
      ...require('../../../../hooks/products/useProductAnalytics').useProductAnalytics(),
      loading: true
    })

    render(<ProductAnalyticsDashboard {...defaultProps} />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('should display error state', () => {
    vi.mocked(require('../../../../hooks/products/useProductAnalytics').useProductAnalytics).mockReturnValue({
      ...require('../../../../hooks/products/useProductAnalytics').useProductAnalytics(),
      error: 'Failed to load analytics'
    })

    render(<ProductAnalyticsDashboard {...defaultProps} />)

    expect(screen.getByText(/error/i)).toBeInTheDocument()
    expect(screen.getByText(/failed to load analytics/i)).toBeInTheDocument()
  })

  it('should handle time range changes', async () => {
    const user = userEvent.setup()
    const mockSetTimeRange = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductAnalytics').useProductAnalytics).mockReturnValue({
      ...require('../../../../hooks/products/useProductAnalytics').useProductAnalytics(),
      setTimeRange: mockSetTimeRange
    })

    render(<ProductAnalyticsDashboard {...defaultProps} />)

    const timeRangeSelect = screen.getByRole('combobox', { name: /time range/i })
    await user.selectOptions(timeRangeSelect, '7d')

    expect(mockSetTimeRange).toHaveBeenCalledWith('7d')
  })

  it('should display trend charts', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} />)

    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('should display category analysis', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} />)

    expect(screen.getByText('Electronics')).toBeInTheDocument()
    expect(screen.getByText('Accessories')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument() // Electronics count
    expect(screen.getByText('38')).toBeInTheDocument() // Accessories count
  })

  it('should display supplier analysis', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} />)

    expect(screen.getByText('Supplier A')).toBeInTheDocument()
    expect(screen.getByText('Supplier B')).toBeInTheDocument()
    expect(screen.getByText('52')).toBeInTheDocument() // Supplier A count
    expect(screen.getByText('41')).toBeInTheDocument() // Supplier B count
  })

  it('should display inventory alerts', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} />)

    expect(screen.getByText(/low stock/i)).toBeInTheDocument()
    expect(screen.getByText(/out of stock/i)).toBeInTheDocument()
    expect(screen.getByText('Product 1')).toBeInTheDocument()
    expect(screen.getByText('Product 2')).toBeInTheDocument()
  })

  it('should handle refresh analytics', async () => {
    const user = userEvent.setup()
    const mockRefreshAnalytics = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductAnalytics').useProductAnalytics).mockReturnValue({
      ...require('../../../../hooks/products/useProductAnalytics').useProductAnalytics(),
      refreshAnalytics: mockRefreshAnalytics
    })

    render(<ProductAnalyticsDashboard {...defaultProps} />)

    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await user.click(refreshButton)

    expect(mockRefreshAnalytics).toHaveBeenCalled()
  })

  it('should handle data export', async () => {
    const user = userEvent.setup()
    const mockExportData = vi.fn()

    vi.mocked(require('../../../../hooks/products/useProductAnalytics').useProductAnalytics).mockReturnValue({
      ...require('../../../../hooks/products/useProductAnalytics').useProductAnalytics(),
      exportData: mockExportData
    })

    render(<ProductAnalyticsDashboard {...defaultProps} />)

    const exportButton = screen.getByRole('button', { name: /export/i })
    await user.click(exportButton)

    expect(mockExportData).toHaveBeenCalled()
  })

  it('should hide time controls when showTimeControls is false', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} showTimeControls={false} />)

    expect(screen.queryByRole('combobox', { name: /time range/i })).not.toBeInTheDocument()
  })

  it('should hide export options when showExportOptions is false', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} showExportOptions={false} />)

    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument()
  })

  it('should render in compact mode', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} compact={true} />)

    expect(screen.getByTestId('compact-dashboard')).toBeInTheDocument()
  })

  it('should display percentage changes in metrics', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} />)

    // Buscar indicadores de cambio porcentual
    const percentageElements = screen.getAllByText(/[+-]\d+%/)
    expect(percentageElements.length).toBeGreaterThan(0)
  })

  it('should handle chart interactions', async () => {
    const user = userEvent.setup()

    render(<ProductAnalyticsDashboard {...defaultProps} />)

    const chart = screen.getByTestId('line-chart')
    await user.hover(chart)

    // Debería mostrar tooltip al hacer hover
    expect(screen.getByTestId('tooltip')).toBeInTheDocument()
  })

  it('should display progress bars for categories', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} />)

    const progressBars = screen.getAllByTestId('progress')
    expect(progressBars.length).toBeGreaterThan(0)
  })

  it('should handle responsive design', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })

    render(<ProductAnalyticsDashboard {...defaultProps} />)

    expect(screen.getByTestId('mobile-dashboard')).toBeInTheDocument()
  })

  it('should display trend direction indicators', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} />)

    // Buscar iconos de tendencia (up/down arrows)
    const trendIcons = screen.getAllByTestId(/trend-(up|down)/)
    expect(trendIcons.length).toBeGreaterThan(0)
  })

  it('should handle empty analytics data', () => {
    vi.mocked(require('../../../../hooks/products/useProductAnalytics').useProductAnalytics).mockReturnValue({
      ...require('../../../../hooks/products/useProductAnalytics').useProductAnalytics(),
      analytics: {
        totalProducts: 0,
        totalValue: 0,
        averagePrice: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        topCategories: [],
        topSuppliers: [],
        trends: { daily: [], weekly: [], monthly: [] }
      }
    })

    render(<ProductAnalyticsDashboard {...defaultProps} />)

    expect(screen.getByText(/no data available/i)).toBeInTheDocument()
  })

  it('should display metric cards with proper formatting', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} />)

    // Verificar formato de moneda
    expect(screen.getByText(/\$125,000/)).toBeInTheDocument()
    expect(screen.getByText(/\$833\.33/)).toBeInTheDocument()

    // Verificar formato de números
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup()

    render(<ProductAnalyticsDashboard {...defaultProps} />)

    // Test tab navigation
    await user.tab()
    expect(document.activeElement).toHaveAttribute('role', 'combobox')

    await user.tab()
    expect(document.activeElement).toHaveAttribute('role', 'button')
  })

  it('should display alerts with proper severity', () => {
    render(<ProductAnalyticsDashboard {...defaultProps} />)

    // Verificar badges de alerta
    expect(screen.getByText('Low Stock')).toBeInTheDocument()
    expect(screen.getByText('Out of Stock')).toBeInTheDocument()
  })

  it('should handle chart data updates', () => {
    const { rerender } = render(<ProductAnalyticsDashboard {...defaultProps} />)

    // Cambiar datos y verificar que se actualiza
    vi.mocked(require('../../../../hooks/products/useProductAnalytics').useProductAnalytics).mockReturnValue({
      ...require('../../../../hooks/products/useProductAnalytics').useProductAnalytics(),
      analytics: {
        ...require('../../../../hooks/products/useProductAnalytics').useProductAnalytics().analytics,
        totalProducts: 200
      }
    })

    rerender(<ProductAnalyticsDashboard {...defaultProps} />)

    expect(screen.getByText('200')).toBeInTheDocument()
  })
})