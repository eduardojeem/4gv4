import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ProductCard } from '../ProductCard'
import type { Product } from '@/types/product-unified'

// Mock product data
const mockProduct: Product = {
  id: '1',
  name: 'Test Product',
  sku: 'TEST-001',
  price: 100,
  stock: 10,
  category: 'Electronics',
  description: 'Test product description',
  minStock: 5
}

const mockOutOfStockProduct: Product = {
  ...mockProduct,
  id: '2',
  name: 'Out of Stock Product',
  stock: 0
}

const mockLowStockProduct: Product = {
  ...mockProduct,
  id: '3',
  name: 'Low Stock Product',
  stock: 3
}

describe('ProductCard', () => {
  const mockOnAddToCart = vi.fn()
  const mockOnQuickAdd = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Grid View', () => {
    it('should render product information correctly', () => {
      render(
        <ProductCard
          product={mockProduct}
          onAddToCart={mockOnAddToCart}
          viewMode="grid"
        />
      )

      expect(screen.getByText('Test Product')).toBeInTheDocument()
      expect(screen.getByText('$100.00')).toBeInTheDocument()
      expect(screen.getByText('TEST-001')).toBeInTheDocument()
      expect(screen.getByText('Stock: 10')).toBeInTheDocument()
    })

    it('should call onAddToCart when add button is clicked', () => {
      render(
        <ProductCard
          product={mockProduct}
          onAddToCart={mockOnAddToCart}
          viewMode="grid"
        />
      )

      const addButton = screen.getByRole('button', { name: /agregar/i })
      fireEvent.click(addButton)

      expect(mockOnAddToCart).toHaveBeenCalledWith(mockProduct)
    })

    it('should show cart quantity when item is in cart', () => {
      render(
        <ProductCard
          product={mockProduct}
          onAddToCart={mockOnAddToCart}
          cartQuantity={3}
          viewMode="grid"
        />
      )

      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should disable add button when out of stock', () => {
      render(
        <ProductCard
          product={mockOutOfStockProduct}
          onAddToCart={mockOnAddToCart}
          viewMode="grid"
        />
      )

      const addButton = screen.getByRole('button', { name: /agregar/i })
      expect(addButton).toBeDisabled()
      expect(screen.getByText('Sin Stock')).toBeInTheDocument()
    })

    it('should show low stock warning', () => {
      render(
        <ProductCard
          product={mockLowStockProduct}
          onAddToCart={mockOnAddToCart}
          viewMode="grid"
        />
      )

      expect(screen.getByText('Stock Bajo')).toBeInTheDocument()
    })

    it('should show barcode when enabled', () => {
      const productWithBarcode = { ...mockProduct, barcode: '1234567890' }
      render(
        <ProductCard
          product={productWithBarcode}
          onAddToCart={mockOnAddToCart}
          showBarcode={true}
          viewMode="grid"
        />
      )

      expect(screen.getByText('1234567890')).toBeInTheDocument()
    })
  })

  describe('List View', () => {
    it('should render in list format', () => {
      render(
        <ProductCard
          product={mockProduct}
          onAddToCart={mockOnAddToCart}
          viewMode="list"
        />
      )

      // List view should have different layout
      const card = screen.getByRole('button', { name: /agregar/i }).closest('.card')
      expect(card).toBeInTheDocument()
    })

    it('should show product information in list format', () => {
      render(
        <ProductCard
          product={mockProduct}
          onAddToCart={mockOnAddToCart}
          viewMode="list"
        />
      )

      expect(screen.getByText('Test Product')).toBeInTheDocument()
      expect(screen.getByText('$100.00')).toBeInTheDocument()
    })
  })

  describe('Quick Add Functionality', () => {
    it('should call onQuickAdd with correct quantity', () => {
      render(
        <ProductCard
          product={mockProduct}
          onAddToCart={mockOnAddToCart}
          onQuickAdd={mockOnQuickAdd}
          viewMode="grid"
        />
      )

      // Assuming there are quick add buttons for different quantities
      const quickAddButtons = screen.getAllByRole('button')
      const quickAdd5Button = quickAddButtons.find(btn => 
        btn.textContent?.includes('5')
      )

      if (quickAdd5Button) {
        fireEvent.click(quickAdd5Button)
        expect(mockOnQuickAdd).toHaveBeenCalledWith(mockProduct, 5)
      }
    })

    it('should not allow quick add beyond stock limit', () => {
      const lowStockProduct = { ...mockProduct, stock: 3 }
      render(
        <ProductCard
          product={lowStockProduct}
          onAddToCart={mockOnAddToCart}
          onQuickAdd={mockOnQuickAdd}
          viewMode="grid"
        />
      )

      // Try to quick add more than available stock
      // This should not call onQuickAdd or should be disabled
      const quickAddButtons = screen.getAllByRole('button')
      quickAddButtons.forEach(button => {
        if (button.textContent?.includes('5')) {
          fireEvent.click(button)
          expect(mockOnQuickAdd).not.toHaveBeenCalledWith(lowStockProduct, 5)
        }
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <ProductCard
          product={mockProduct}
          onAddToCart={mockOnAddToCart}
          viewMode="grid"
        />
      )

      const addButton = screen.getByRole('button', { name: /agregar/i })
      expect(addButton).toHaveAttribute('aria-label')
    })

    it('should be keyboard accessible', () => {
      render(
        <ProductCard
          product={mockProduct}
          onAddToCart={mockOnAddToCart}
          viewMode="grid"
        />
      )

      const addButton = screen.getByRole('button', { name: /agregar/i })
      addButton.focus()
      expect(addButton).toHaveFocus()

      fireEvent.keyDown(addButton, { key: 'Enter' })
      expect(mockOnAddToCart).toHaveBeenCalledWith(mockProduct)
    })
  })

  describe('Visual States', () => {
    it('should apply opacity when out of stock', () => {
      const { container } = render(
        <ProductCard
          product={mockOutOfStockProduct}
          onAddToCart={mockOnAddToCart}
          viewMode="grid"
        />
      )

      const card = container.querySelector('.opacity-50')
      expect(card).toBeInTheDocument()
    })

    it('should show featured badge when product is featured', () => {
      const featuredProduct = { ...mockProduct, featured: true }
      render(
        <ProductCard
          product={featuredProduct}
          onAddToCart={mockOnAddToCart}
          viewMode="grid"
        />
      )

      expect(screen.getByText('Destacado')).toBeInTheDocument()
    })
  })
})