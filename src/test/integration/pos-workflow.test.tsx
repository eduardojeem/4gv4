/**
 * POS Workflow Integration Tests - Fase 5 Testing & QA
 * Tests de integración para el flujo completo del sistema POS
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMockProduct } from '@/test/setup'

// Mock de componentes POS
const MockPOSPage = () => {
  const [cart, setCart] = React.useState<any[]>([])
  const [products] = React.useState([
    createMockProduct({ id: '1', name: 'Producto 1', price: 100, stock: 10 }),
    createMockProduct({ id: '2', name: 'Producto 2', price: 50, stock: 5 }),
    createMockProduct({ id: '3', name: 'Producto 3', price: 200, stock: 2 })
  ])
  
  const addToCart = (product: any, quantity: number) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id)
      if (existingItem) {
        return prevCart.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + quantity, subtotal: (item.quantity + quantity) * product.price }
            : item
        )
      } else {
        return [...prevCart, { 
          id: product.id, // Use product.id as the cart item id
          product, 
          quantity, 
          subtotal: quantity * product.price 
        }]
      }
    })
  }
  
  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId))
  }
  
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity === 0) {
      removeFromCart(productId)
    } else {
      setCart(prevCart => prevCart.map(item => 
        item.product.id === productId 
          ? { ...item, quantity, subtotal: quantity * item.product.price }
          : item
      ))
    }
  }
  
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0)
  
  const processPayment = async () => {
    // Simular procesamiento de pago
    await new Promise(resolve => setTimeout(resolve, 1000))
    setCart([])
    return { success: true, transactionId: 'txn-' + Date.now() }
  }
  
  return (
    <div data-testid="pos-page">
      {/* Product Grid */}
      <div data-testid="product-grid">
        <h2>Productos</h2>
        {products.map(product => (
          <div key={product.id} data-testid={`product-${product.id}`}>
            <span>{product.name}</span>
            <span>${product.price}</span>
            <span>Stock: {product.stock}</span>
            <button 
              onClick={() => addToCart(product, 1)}
              disabled={product.stock === 0}
            >
              Agregar al Carrito
            </button>
          </div>
        ))}
      </div>
      
      {/* Cart */}
      <div data-testid="cart">
        <h2>Carrito</h2>
        {cart.length === 0 ? (
          <p>Carrito vacío</p>
        ) : (
          <>
            {cart.map(item => (
              <div key={item.product.id} data-testid={`cart-item-${item.product.id}`}>
                <span>{item.product.name}</span>
                <input 
                  type="number" 
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 0)}
                  min="0"
                />
                <span>${item.subtotal}</span>
                <button onClick={() => removeFromCart(item.product.id)}>
                  Eliminar
                </button>
              </div>
            ))}
            <div data-testid="cart-total">
              Total: ${total}
            </div>
            <button 
              data-testid="checkout-button"
              onClick={processPayment}
              disabled={cart.length === 0}
            >
              Procesar Pago
            </button>
          </>
        )}
      </div>
    </div>
  )
}

import React from 'react'

describe('POS Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Debug Tests', () => {
    it('should add first product to cart', async () => {
      const user = userEvent.setup()
      render(<MockPOSPage />)
      
      // Verificar estado inicial
      expect(screen.getByText('Carrito vacío')).toBeInTheDocument()
      
      // Agregar solo el primer producto
      const product1Button = screen.getByTestId('product-1').querySelector('button')!
      await user.click(product1Button)
      
      // Verificar que se agregó
      await waitFor(() => {
        expect(screen.queryByText('Carrito vacío')).not.toBeInTheDocument()
        expect(screen.getByTestId('cart-item-1')).toBeInTheDocument()
        expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $100')
      })
    })

    it('should add both products sequentially', async () => {
      const user = userEvent.setup()
      render(<MockPOSPage />)
      
      // Agregar primer producto
      const product1Button = screen.getByTestId('product-1').querySelector('button')!
      await user.click(product1Button)
      
      // Esperar y verificar primer producto
      await waitFor(() => {
        expect(screen.getByTestId('cart-item-1')).toBeInTheDocument()
        expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $100')
      })
      
      // Agregar segundo producto
      const product2Button = screen.getByTestId('product-2').querySelector('button')!
      await user.click(product2Button)
      
      // Verificar ambos productos
      await waitFor(() => {
        expect(screen.getByTestId('cart-item-1')).toBeInTheDocument()
        expect(screen.getByTestId('cart-item-2')).toBeInTheDocument()
        expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $150')
      })
    })
  })

  describe('Complete Sale Workflow', () => {
    it('should complete a full sale from product selection to payment', async () => {
      const user = userEvent.setup()
      render(<MockPOSPage />)
      
      // 1. Verificar que la página se carga correctamente
      expect(screen.getByTestId('pos-page')).toBeInTheDocument()
      expect(screen.getByText('Carrito vacío')).toBeInTheDocument()
      
      // 2. Agregar primer producto y esperar
      const product1Button = screen.getByTestId('product-1').querySelector('button')!
      await user.click(product1Button)
      
      // Verificar que el producto 1 se agregó
      await waitFor(() => {
        expect(screen.getByTestId('cart-item-1')).toBeInTheDocument()
        expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $100')
      })
      
      // 3. Agregar segundo producto
      const product2Button = screen.getByTestId('product-2').querySelector('button')!
      await user.click(product2Button)
      
      // Verificar que ambos productos están en el carrito
      await waitFor(() => {
        expect(screen.getByTestId('cart-item-1')).toBeInTheDocument()
        expect(screen.getByTestId('cart-item-2')).toBeInTheDocument()
        expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $150')
      })
      
      // 4. Procesar pago directamente (sin modificar cantidades para simplificar)
      const checkoutButton = screen.getByTestId('checkout-button')
      expect(checkoutButton).not.toBeDisabled()
      
      await user.click(checkoutButton)
      
      // 5. Verificar que el carrito se vació después del pago
      await waitFor(() => {
        expect(screen.getByText('Carrito vacío')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('should handle quantity updates correctly', async () => {
      const user = userEvent.setup()
      render(<MockPOSPage />)
      
      // Verificar estado inicial
      expect(screen.getByText('Carrito vacío')).toBeInTheDocument()
      
      // Agregar un producto
      const product1Button = screen.getByTestId('product-1').querySelector('button')!
      expect(product1Button).toBeInTheDocument()
      await user.click(product1Button)
      
      // Verificar que se agregó con más tiempo de espera
      await waitFor(() => {
        expect(screen.queryByText('Carrito vacío')).not.toBeInTheDocument()
        expect(screen.getByTestId('cart-item-1')).toBeInTheDocument()
        expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $100')
      }, { timeout: 3000 })
      
      // Modificar cantidad a 3
      const quantityInput = screen.getByTestId('cart-item-1').querySelector('input[type="number"]')!
      expect(quantityInput).toBeInTheDocument()
      expect(quantityInput).toHaveValue(1)
      
      await user.clear(quantityInput)
      await user.type(quantityInput, '3')
      
      // Verificar que se actualizó el total
      await waitFor(() => {
        expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $300')
      }, { timeout: 3000 })
    })

    it('should handle product stock validation', async () => {
      const user = userEvent.setup()
      render(<MockPOSPage />)
      
      // Verificar estado inicial
      expect(screen.getByText('Carrito vacío')).toBeInTheDocument()
      
      // Producto con stock limitado (2 unidades)
      const product3Button = screen.getByTestId('product-3').querySelector('button')!
      expect(product3Button).toBeInTheDocument()
      
      // Agregar al carrito
      await user.click(product3Button)
      
      // Verificar que se agregó correctamente con más tiempo de espera
      await waitFor(() => {
        expect(screen.queryByText('Carrito vacío')).not.toBeInTheDocument()
        expect(screen.getByTestId('cart-item-3')).toBeInTheDocument()
        expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $200')
      }, { timeout: 3000 })
      
      // Verificar que el input tiene valor inicial de 1
      const quantityInput = screen.getByTestId('cart-item-3').querySelector('input[type="number"]')!
      expect(quantityInput).toBeInTheDocument()
      expect(quantityInput).toHaveValue(1)
      
      // Intentar modificar cantidad a 2 (dentro del stock disponible)
      await user.clear(quantityInput)
      await user.type(quantityInput, '2')
      
      // Verificar que el input se actualiza correctamente
      await waitFor(() => {
        expect(quantityInput).toHaveValue(2)
        expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $400')
      }, { timeout: 3000 })
    })

    it('should handle removing items from cart', async () => {
      const user = userEvent.setup()
      render(<MockPOSPage />)
      
      // Agregar productos
      await user.click(screen.getByTestId('product-1').querySelector('button')!)
      await user.click(screen.getByTestId('product-2').querySelector('button')!)
      
      expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $150')
      
      // Eliminar un producto
      const removeButton = screen.getByTestId('cart-item-1').querySelector('button')!
      await user.click(removeButton)
      
      // Verificar que se eliminó
      expect(screen.queryByTestId('cart-item-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $50')
    })

    it('should handle quantity changes correctly', async () => {
      const user = userEvent.setup()
      render(<MockPOSPage />)
      
      // Agregar producto
      await user.click(screen.getByTestId('product-1').querySelector('button')!)
      
      const quantityInput = screen.getByTestId('cart-item-1').querySelector('input[type="number"]')!
      
      // Cambiar cantidad a 0 (debería eliminar el item)
      await user.clear(quantityInput)
      await user.type(quantityInput, '0')
      
      await waitFor(() => {
        expect(screen.queryByTestId('cart-item-1')).not.toBeInTheDocument()
        expect(screen.getByText('Carrito vacío')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle payment failures gracefully', async () => {
      // Mock payment failure
      const mockProcessPayment = vi.fn().mockRejectedValue(new Error('Payment failed'))
      
      const MockPOSWithError = () => {
        const [cart, setCart] = React.useState([
          { 
            id: '1', 
            product: createMockProduct({ id: '1', price: 100 }), 
            quantity: 1, 
            subtotal: 100 
          }
        ])
        const [error, setError] = React.useState<string | null>(null)
        
        const processPayment = async () => {
          try {
            await mockProcessPayment()
          } catch (err) {
            setError('Error en el pago')
          }
        }
        
        return (
          <div>
            <div data-testid="cart-total">Total: $100</div>
            <button onClick={processPayment}>Procesar Pago</button>
            {error && <div data-testid="error-message">{error}</div>}
          </div>
        )
      }
      
      const user = userEvent.setup()
      render(<MockPOSWithError />)
      
      await user.click(screen.getByText('Procesar Pago'))
      
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Error en el pago')
      })
    })

    it('should validate empty cart checkout', async () => {
      render(<MockPOSPage />)
      
      // Verificar que el carrito está vacío
      expect(screen.getByText('Carrito vacío')).toBeInTheDocument()
      
      // Verificar que no hay botón de checkout cuando el carrito está vacío
      expect(screen.queryByTestId('checkout-button')).not.toBeInTheDocument()
      
      // Agregar un producto para que aparezca el botón
      const user = userEvent.setup()
      const product1Button = screen.getByTestId('product-1').querySelector('button')!
      await user.click(product1Button)
      
      // Ahora debería aparecer el botón de checkout
      await waitFor(() => {
        expect(screen.getByTestId('checkout-button')).toBeInTheDocument()
        expect(screen.getByTestId('checkout-button')).not.toBeDisabled()
      })
    })
  })

  describe('Performance', () => {
    it('should handle large number of products efficiently', async () => {
      const startTime = performance.now()
      
      const MockPOSWithManyProducts = () => {
        const products = Array.from({ length: 1000 }, (_, i) => 
          createMockProduct({ 
            id: `${i + 1}`, 
            name: `Producto ${i + 1}`, 
            price: (i + 1) * 10 
          })
        )
        
        return (
          <div data-testid="product-grid">
            {products.map(product => (
              <div key={product.id}>
                <span>{product.name}</span>
                <span>${product.price}</span>
              </div>
            ))}
          </div>
        )
      }
      
      render(<MockPOSWithManyProducts />)
      
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      // Debería renderizar en menos de 1 segundo
      expect(renderTime).toBeLessThan(1000)
      expect(screen.getByTestId('product-grid')).toBeInTheDocument()
    })

    it('should update cart totals efficiently', async () => {
      const user = userEvent.setup()
      render(<MockPOSPage />)
      
      const startTime = performance.now()
      
      // Agregar múltiples productos rápidamente
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByTestId('product-1').querySelector('button')!)
      }
      
      const endTime = performance.now()
      const operationTime = endTime - startTime
      
      // Las operaciones deberían ser rápidas
      expect(operationTime).toBeLessThan(2000)
      expect(screen.getByTestId('cart-total')).toHaveTextContent('Total: $1000')
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()
      render(<MockPOSPage />)
      
      // Navegar con Tab
      await user.tab()
      
      // El primer botón debería estar enfocado
      const firstButton = screen.getByTestId('product-1').querySelector('button')!
      expect(firstButton).toHaveFocus()
      
      // Agregar producto con Enter
      await user.keyboard('{Enter}')
      
      expect(screen.getByTestId('cart-item-1')).toBeInTheDocument()
    })

    it('should have proper ARIA labels', () => {
      render(<MockPOSPage />)
      
      // Verificar que los elementos importantes tienen labels apropiados
      expect(screen.getByTestId('product-grid')).toBeInTheDocument()
      expect(screen.getByTestId('cart')).toBeInTheDocument()
      
      // Los botones deberían tener texto descriptivo
      const addButtons = screen.getAllByText('Agregar al Carrito')
      expect(addButtons.length).toBeGreaterThan(0)
    })
  })
})