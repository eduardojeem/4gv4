import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        data: [],
        error: null,
      }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: vi.fn(),
      }),
    }),
  }),
}))

// Mock hooks
vi.mock('@/hooks/usePOSProducts', () => ({
  usePOSProducts: vi.fn(() => ({
    products: [
      {
        id: '1',
        name: 'Test Product 1',
        price: 100,
        stock: 10,
        sku: 'TEST-001',
        category: 'Electronics',
      },
      {
        id: '2',
        name: 'Test Product 2',
        price: 50,
        stock: 5,
        sku: 'TEST-002',
        category: 'Electronics',
      },
    ],
    cart: [],
    loading: false,
    error: null,
    searchTerm: '',
    selectedCategory: 'all',
    categories: ['Electronics'],
    cartTotal: 0,
    cartItemsCount: 0,
    realTimeEnabled: true,
    realTimeStatus: {
      isConnected: true,
      connectionStatus: 'connected',
      lastSync: new Date(),
      eventsReceived: 0,
      connectionHealth: { isHealthy: true, latency: 100, lastHeartbeat: new Date() }
    },
    setSearchTerm: vi.fn(),
    setSelectedCategory: vi.fn(),
    findProductByBarcode: vi.fn(),
    addToCart: vi.fn(),
    updateCartItemQuantity: vi.fn(),
    removeFromCart: vi.fn(),
    clearCart: vi.fn(),
    processSale: vi.fn(),
    fetchProducts: vi.fn(),
    refreshProducts: vi.fn(),
    toggleRealTime: vi.fn(),
    reconnectRealTime: vi.fn()
  })),
}))

// Import the component after mocks
import POSPage from '../page'

describe('POS Integration Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render POS interface with products', async () => {
    render(<POSPage />)

    // Check if main elements are present
    expect(screen.getByText('Punto de Venta')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/buscar productos/i)).toBeInTheDocument()
    
    // Wait for products to load
    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.getByText('Test Product 2')).toBeInTheDocument()
    })
  })

  it('should add product to cart and update totals', async () => {
    render(<POSPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    })

    // Find and click add button for first product
    const addButtons = screen.getAllByText(/agregar/i)
    await user.click(addButtons[0])

    // Check if product appears in cart
    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.getByText('$100.00')).toBeInTheDocument()
    })

    // Check if total is updated
    expect(screen.getByText(/total/i)).toBeInTheDocument()
  })

  it('should search and filter products', async () => {
    render(<POSPage />)

    const searchInput = screen.getByPlaceholderText(/buscar productos/i)
    
    // Search for specific product
    await user.type(searchInput, 'Test Product 1')

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.queryByText('Test Product 2')).not.toBeInTheDocument()
    })
  })

  it('should update cart quantities', async () => {
    render(<POSPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    })

    // Add product to cart
    const addButtons = screen.getAllByText(/agregar/i)
    await user.click(addButtons[0])

    // Wait for cart to update
    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeInTheDocument()
    })

    // Find quantity input and update it
    const quantityInput = screen.getByDisplayValue('1')
    await user.clear(quantityInput)
    await user.type(quantityInput, '3')

    // Check if total is updated
    await waitFor(() => {
      expect(screen.getByText('$300.00')).toBeInTheDocument()
    })
  })

  it('should remove items from cart', async () => {
    render(<POSPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    })

    // Add product to cart
    const addButtons = screen.getAllByText(/agregar/i)
    await user.click(addButtons[0])

    // Wait for cart to update
    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    })

    // Find and click remove button
    const removeButton = screen.getByLabelText(/eliminar/i)
    await user.click(removeButton)

    // Check if product is removed from cart
    await waitFor(() => {
      expect(screen.queryByDisplayValue('1')).not.toBeInTheDocument()
    })
  })

  it('should handle payment process', async () => {
    render(<POSPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    })

    // Add product to cart
    const addButtons = screen.getAllByText(/agregar/i)
    await user.click(addButtons[0])

    // Wait for cart to update
    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    })

    // Find and click checkout button
    const checkoutButton = screen.getByText(/procesar venta/i)
    await user.click(checkoutButton)

    // Check if payment modal opens
    await waitFor(() => {
      expect(screen.getByText(/método de pago/i)).toBeInTheDocument()
    })
  })

  it('should switch between grid and list view', async () => {
    render(<POSPage />)

    // Find view toggle buttons
    const gridButton = screen.getByLabelText(/vista de cuadrícula/i)
    const listButton = screen.getByLabelText(/vista de lista/i)

    // Switch to list view
    await user.click(listButton)

    // Check if view changes (this would depend on implementation)
    expect(listButton).toHaveAttribute('aria-pressed', 'true')

    // Switch back to grid view
    await user.click(gridButton)
    expect(gridButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('should handle barcode scanning', async () => {
    render(<POSPage />)

    // Find barcode input or scanner button
    const barcodeButton = screen.getByLabelText(/escanear código/i)
    await user.click(barcodeButton)

    // Check if scanner interface opens
    await waitFor(() => {
      expect(screen.getByText(/escáner de código/i)).toBeInTheDocument()
    })
  })

  it('should clear cart', async () => {
    render(<POSPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    })

    // Add products to cart
    const addButtons = screen.getAllByText(/agregar/i)
    await user.click(addButtons[0])
    await user.click(addButtons[1])

    // Wait for cart to update
    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
      expect(screen.getByText('Test Product 2')).toBeInTheDocument()
    })

    // Find and click clear cart button
    const clearButton = screen.getByText(/limpiar carrito/i)
    await user.click(clearButton)

    // Confirm clear action
    const confirmButton = screen.getByText(/confirmar/i)
    await user.click(confirmButton)

    // Check if cart is empty
    await waitFor(() => {
      expect(screen.queryByDisplayValue('1')).not.toBeInTheDocument()
      expect(screen.getByText(/carrito vacío/i)).toBeInTheDocument()
    })
  })

  it('should handle keyboard navigation', async () => {
    render(<POSPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    })

    // Test tab navigation
    const searchInput = screen.getByPlaceholderText(/buscar productos/i)
    searchInput.focus()
    expect(searchInput).toHaveFocus()

    // Tab to next element
    await user.tab()
    
    // Should focus on first product or filter button
    const focusedElement = document.activeElement
    expect(focusedElement).toBeInTheDocument()
  })

  it.skip('should handle error states gracefully', async () => {
    // Mock error state by temporarily overriding the mock
    const mockUsePOSProducts = vi.fn().mockReturnValue({
      products: [],
      cart: [],
      loading: false,
      error: 'Failed to load products',
      searchTerm: '',
      selectedCategory: 'all',
      categories: [],
      cartTotal: 0,
      cartItemsCount: 0,
      realTimeEnabled: true,
      realTimeStatus: {
        isConnected: false,
        connectionStatus: 'disconnected',
        lastSync: null,
        eventsReceived: 0,
        connectionHealth: { isHealthy: false, latency: 5000, lastHeartbeat: null }
      },
      setSearchTerm: vi.fn(),
      setSelectedCategory: vi.fn(),
      findProductByBarcode: vi.fn(),
      addToCart: vi.fn(),
      updateCartItemQuantity: vi.fn(),
      removeFromCart: vi.fn(),
      clearCart: vi.fn(),
      processSale: vi.fn(),
      fetchProducts: vi.fn(),
      refreshProducts: vi.fn(),
      toggleRealTime: vi.fn(),
      reconnectRealTime: vi.fn()
    })

    render(<POSPage />)

    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })

    // Check if retry button is available
    const retryButton = screen.getByText(/reintentar/i)
    expect(retryButton).toBeInTheDocument()
  })
})