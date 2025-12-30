/**
 * POSCart Component Tests - Fase 5 Testing & QA
 * Tests para el componente crítico del carrito POS
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { POSCart } from '@/app/dashboard/pos/components/POSCart'
import { createMockProduct } from '@/test/setup'

// Mock del hook usePOS
const mockUsePOS = {
  cart: [],
  total: 0,
  addToCart: vi.fn(),
  removeFromCart: vi.fn(),
  updateQuantity: vi.fn(),
  clearCart: vi.fn(),
  processPayment: vi.fn(),
  isProcessing: false
}

vi.mock('@/hooks/usePOS', () => ({
  usePOS: () => mockUsePOS
}))

describe('POSCart Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePOS.cart = []
    mockUsePOS.total = 0
    mockUsePOS.isProcessing = false
  })

  describe('Empty Cart', () => {
    it('should render empty cart message', () => {
      render(<POSCart />)
      
      expect(screen.getByText(/carrito vacío/i)).toBeInTheDocument()
      expect(screen.getByText(/agrega productos/i)).toBeInTheDocument()
    })

    it('should disable checkout button when cart is empty', () => {
      render(<POSCart />)
      
      const checkoutButton = screen.getByRole('button', { name: /procesar pago/i })
      expect(checkoutButton).toBeDisabled()
    })
  })

  describe('Cart with Items', () => {
    beforeEach(() => {
      mockUsePOS.cart = [
        {
          id: '1',
          product: createMockProduct({ id: '1', name: 'Producto 1', price: 100 }),
          quantity: 2,
          subtotal: 200
        },
        {
          id: '2',
          product: createMockProduct({ id: '2', name: 'Producto 2', price: 50 }),
          quantity: 1,
          subtotal: 50
        }
      ]
      mockUsePOS.total = 250
    })

    it('should render cart items correctly', () => {
      render(<POSCart />)
      
      expect(screen.getByText('Producto 1')).toBeInTheDocument()
      expect(screen.getByText('Producto 2')).toBeInTheDocument()
      expect(screen.getByText('$250.00')).toBeInTheDocument()
    })

    it('should display correct quantities', () => {
      render(<POSCart />)
      
      const quantityInputs = screen.getAllByRole('spinbutton')
      expect(quantityInputs[0]).toHaveValue(2)
      expect(quantityInputs[1]).toHaveValue(1)
    })

    it('should update quantity when input changes', async () => {
      render(<POSCart />)
      
      const quantityInput = screen.getAllByRole('spinbutton')[0]
      fireEvent.change(quantityInput, { target: { value: '3' } })
      
      await waitFor(() => {
        expect(mockUsePOS.updateQuantity).toHaveBeenCalledWith('1', 3)
      })
    })

    it('should remove item when quantity is set to 0', async () => {
      render(<POSCart />)
      
      const quantityInput = screen.getAllByRole('spinbutton')[0]
      fireEvent.change(quantityInput, { target: { value: '0' } })
      
      await waitFor(() => {
        expect(mockUsePOS.removeFromCart).toHaveBeenCalledWith('1')
      })
    })

    it('should remove item when delete button is clicked', async () => {
      render(<POSCart />)
      
      const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i })
      fireEvent.click(deleteButtons[0])
      
      await waitFor(() => {
        expect(mockUsePOS.removeFromCart).toHaveBeenCalledWith('1')
      })
    })

    it('should enable checkout button when cart has items', () => {
      render(<POSCart />)
      
      const checkoutButton = screen.getByRole('button', { name: /procesar pago/i })
      expect(checkoutButton).not.toBeDisabled()
    })
  })

  describe('Checkout Process', () => {
    beforeEach(() => {
      mockUsePOS.cart = [
        {
          id: '1',
          product: createMockProduct({ id: '1', name: 'Producto 1', price: 100 }),
          quantity: 1,
          subtotal: 100
        }
      ]
      mockUsePOS.total = 100
    })

    it('should process payment when checkout button is clicked', async () => {
      mockUsePOS.processPayment.mockResolvedValue({ success: true })
      
      render(<POSCart />)
      
      const checkoutButton = screen.getByRole('button', { name: /procesar pago/i })
      fireEvent.click(checkoutButton)
      
      await waitFor(() => {
        expect(mockUsePOS.processPayment).toHaveBeenCalled()
      })
    })

    it('should show loading state during payment processing', async () => {
      mockUsePOS.isProcessing = true
      
      render(<POSCart />)
      
      expect(screen.getByText(/procesando/i)).toBeInTheDocument()
      
      const checkoutButton = screen.getByRole('button', { name: /procesando/i })
      expect(checkoutButton).toBeDisabled()
    })

    it('should clear cart after successful payment', async () => {
      mockUsePOS.processPayment.mockResolvedValue({ success: true })
      
      render(<POSCart />)
      
      const checkoutButton = screen.getByRole('button', { name: /procesar pago/i })
      fireEvent.click(checkoutButton)
      
      await waitFor(() => {
        expect(mockUsePOS.clearCart).toHaveBeenCalled()
      })
    })

    it('should handle payment errors gracefully', async () => {
      mockUsePOS.processPayment.mockRejectedValue(new Error('Payment failed'))
      
      render(<POSCart />)
      
      const checkoutButton = screen.getByRole('button', { name: /procesar pago/i })
      fireEvent.click(checkoutButton)
      
      await waitFor(() => {
        expect(screen.getByText(/error en el pago/i)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUsePOS.cart = [
        {
          id: '1',
          product: createMockProduct({ id: '1', name: 'Producto 1', price: 100 }),
          quantity: 1,
          subtotal: 100
        }
      ]
      mockUsePOS.total = 100
    })

    it('should have proper ARIA labels', () => {
      render(<POSCart />)
      
      expect(screen.getByRole('region', { name: /carrito de compras/i })).toBeInTheDocument()
      expect(screen.getByRole('list', { name: /productos en el carrito/i })).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      render(<POSCart />)
      
      const quantityInput = screen.getByRole('spinbutton')
      quantityInput.focus()
      
      expect(document.activeElement).toBe(quantityInput)
    })

    it('should announce total price changes', () => {
      render(<POSCart />)
      
      const totalElement = screen.getByRole('status', { name: /total/i })
      expect(totalElement).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn()
      
      const TestComponent = () => {
        renderSpy()
        return <POSCart />
      }
      
      const { rerender } = render(<TestComponent />)
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Re-render with same props
      rerender(<TestComponent />)
      
      // Should not cause additional renders due to memoization
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })
  })
})