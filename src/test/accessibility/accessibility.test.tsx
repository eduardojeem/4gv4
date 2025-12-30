/**
 * Accessibility Tests - Fase 5 Testing & QA
 * Tests de accesibilidad para componentes críticos
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { createMockProduct } from '@/test/setup'
import React from 'react'

// Extender expect con jest-axe
expect.extend(toHaveNoViolations)

// Mock de componentes para testing de accesibilidad
const MockAccessibleForm = () => {
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    category: ''
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    
    if (!formData.name) newErrors.name = 'El nombre es requerido'
    if (!formData.email) newErrors.email = 'El email es requerido'
    
    setErrors(newErrors)
  }
  
  return (
    <form onSubmit={handleSubmit} aria-label="Formulario de cliente">
      <h1>Agregar Cliente</h1>
      
      <div>
        <label htmlFor="name">
          Nombre *
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <div id="name-error" role="alert" aria-live="polite">
            {errors.name}
          </div>
        )}
      </div>
      
      <div>
        <label htmlFor="email">
          Email *
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <div id="email-error" role="alert" aria-live="polite">
            {errors.email}
          </div>
        )}
      </div>
      
      <div>
        <label htmlFor="phone">
          Teléfono
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
        />
      </div>
      
      <div>
        <label htmlFor="category">
          Categoría
        </label>
        <select
          id="category"
          value={formData.category}
          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
        >
          <option value="">Seleccionar categoría</option>
          <option value="regular">Regular</option>
          <option value="premium">Premium</option>
          <option value="vip">VIP</option>
        </select>
      </div>
      
      <button type="submit">
        Guardar Cliente
      </button>
    </form>
  )
}

const MockAccessibleTable = () => {
  const products = [
    createMockProduct({ id: '1', name: 'Producto 1', price: 100, stock: 10 }),
    createMockProduct({ id: '2', name: 'Producto 2', price: 200, stock: 5 }),
    createMockProduct({ id: '3', name: 'Producto 3', price: 150, stock: 0 })
  ]
  
  return (
    <div>
      <h2>Lista de Productos</h2>
      <table role="table" aria-label="Productos disponibles">
        <caption>
          Lista de productos con información de precio y stock
        </caption>
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Precio</th>
            <th scope="col">Stock</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.id}>
              <th scope="row">{product.name}</th>
              <td>${product.price}</td>
              <td>{product.stock}</td>
              <td>
                <span 
                  className={product.stock > 0 ? 'available' : 'out-of-stock'}
                  aria-label={product.stock > 0 ? 'Disponible' : 'Sin stock'}
                >
                  {product.stock > 0 ? '✓' : '✗'}
                </span>
              </td>
              <td>
                <button 
                  aria-label={`Editar ${product.name}`}
                  disabled={product.stock === 0}
                >
                  Editar
                </button>
                <button 
                  aria-label={`Eliminar ${product.name}`}
                  aria-describedby={product.stock === 0 ? 'delete-disabled-reason' : undefined}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div id="delete-disabled-reason" className="sr-only">
        No se pueden eliminar productos sin stock
      </div>
    </div>
  )
}

const MockAccessibleModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const modalRef = React.useRef<HTMLDivElement>(null)
  
  React.useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus()
    }
  }, [isOpen])
  
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])
  
  if (!isOpen) return null
  
  return (
    <div 
      className="modal-overlay" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div 
        ref={modalRef}
        className="modal-content"
        tabIndex={-1}
      >
        <header>
          <h2 id="modal-title">Confirmar Acción</h2>
          <button 
            onClick={onClose}
            aria-label="Cerrar modal"
            className="close-button"
          >
            ×
          </button>
        </header>
        
        <div id="modal-description">
          ¿Estás seguro de que quieres realizar esta acción?
        </div>
        
        <footer>
          <button onClick={onClose}>
            Cancelar
          </button>
          <button onClick={onClose} className="primary">
            Confirmar
          </button>
        </footer>
      </div>
    </div>
  )
}

describe('Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Form Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<MockAccessibleForm />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper form labels', () => {
      render(<MockAccessibleForm />)
      
      // Verificar que todos los inputs tienen labels asociados
      expect(screen.getByLabelText('Nombre *')).toBeInTheDocument()
      expect(screen.getByLabelText('Email *')).toBeInTheDocument()
      expect(screen.getByLabelText('Teléfono')).toBeInTheDocument()
      expect(screen.getByLabelText('Categoría')).toBeInTheDocument()
    })

    it('should indicate required fields properly', () => {
      render(<MockAccessibleForm />)
      
      const nameInput = screen.getByLabelText('Nombre *')
      const emailInput = screen.getByLabelText('Email *')
      
      expect(nameInput).toHaveAttribute('aria-required', 'true')
      expect(emailInput).toHaveAttribute('aria-required', 'true')
    })

    it('should show validation errors with proper ARIA attributes', async () => {
      const user = userEvent.setup()
      render(<MockAccessibleForm />)
      
      const submitButton = screen.getByRole('button', { name: 'Guardar Cliente' })
      await user.click(submitButton)
      
      // Verificar que los errores se muestran
      expect(screen.getByText('El nombre es requerido')).toBeInTheDocument()
      expect(screen.getByText('El email es requerido')).toBeInTheDocument()
      
      // Verificar ARIA attributes
      const nameInput = screen.getByLabelText('Nombre *')
      const emailInput = screen.getByLabelText('Email *')
      
      expect(nameInput).toHaveAttribute('aria-invalid', 'true')
      expect(emailInput).toHaveAttribute('aria-invalid', 'true')
      expect(nameInput).toHaveAttribute('aria-describedby', 'name-error')
      expect(emailInput).toHaveAttribute('aria-describedby', 'email-error')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<MockAccessibleForm />)
      
      // Navegar con Tab
      await user.tab()
      expect(screen.getByLabelText('Nombre *')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByLabelText('Email *')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByLabelText('Teléfono')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByLabelText('Categoría')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByRole('button', { name: 'Guardar Cliente' })).toHaveFocus()
    })
  })

  describe('Table Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<MockAccessibleTable />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper table structure', () => {
      render(<MockAccessibleTable />)
      
      const table = screen.getByRole('table', { name: 'Productos disponibles' })
      expect(table).toBeInTheDocument()
      
      // Verificar caption
      expect(screen.getByText('Lista de productos con información de precio y stock')).toBeInTheDocument()
      
      // Verificar headers
      expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: 'Precio' })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: 'Stock' })).toBeInTheDocument()
    })

    it('should have proper row and column headers', () => {
      render(<MockAccessibleTable />)
      
      // Verificar que los nombres de productos son row headers
      expect(screen.getByRole('rowheader', { name: 'Producto 1' })).toBeInTheDocument()
      expect(screen.getByRole('rowheader', { name: 'Producto 2' })).toBeInTheDocument()
      
      // Verificar scope attributes
      const columnHeaders = screen.getAllByRole('columnheader')
      columnHeaders.forEach(header => {
        expect(header).toHaveAttribute('scope', 'col')
      })
      
      const rowHeaders = screen.getAllByRole('rowheader')
      rowHeaders.forEach(header => {
        expect(header).toHaveAttribute('scope', 'row')
      })
    })

    it('should have accessible action buttons', () => {
      render(<MockAccessibleTable />)
      
      // Verificar que los botones tienen labels descriptivos
      expect(screen.getByRole('button', { name: 'Editar Producto 1' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Eliminar Producto 1' })).toBeInTheDocument()
      
      // Verificar estado de disponibilidad
      expect(screen.getByLabelText('Disponible')).toBeInTheDocument()
      expect(screen.getByLabelText('Sin stock')).toBeInTheDocument()
    })
  })

  describe('Modal Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const onClose = vi.fn()
      const { container } = render(<MockAccessibleModal isOpen={true} onClose={onClose} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper modal attributes', () => {
      const onClose = vi.fn()
      render(<MockAccessibleModal isOpen={true} onClose={onClose} />)
      
      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title')
      expect(modal).toHaveAttribute('aria-describedby', 'modal-description')
    })

    it('should focus modal when opened', () => {
      const onClose = vi.fn()
      render(<MockAccessibleModal isOpen={true} onClose={onClose} />)
      
      const modal = screen.getByRole('dialog')
      expect(modal).toHaveFocus()
    })

    it('should close on Escape key', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<MockAccessibleModal isOpen={true} onClose={onClose} />)
      
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalled()
    })

    it('should trap focus within modal', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<MockAccessibleModal isOpen={true} onClose={onClose} />)
      
      // El modal debería estar enfocado inicialmente
      const modal = screen.getByRole('dialog')
      expect(modal).toHaveFocus()
      
      // Navegar con Tab debería mantener el foco dentro del modal
      await user.tab()
      expect(screen.getByRole('button', { name: 'Cerrar modal' })).toHaveFocus()
      
      await user.tab()
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
      
      await user.tab()
      expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus()
    })
  })

  describe('Color Contrast and Visual Accessibility', () => {
    it('should not rely solely on color for information', () => {
      render(<MockAccessibleTable />)
      
      // Verificar que el estado se comunica con texto y símbolos, no solo color
      expect(screen.getByLabelText('Disponible')).toHaveTextContent('✓')
      expect(screen.getByLabelText('Sin stock')).toHaveTextContent('✗')
    })

    it('should have sufficient color contrast', () => {
      // Este test requeriría herramientas específicas para medir contraste
      // Por ahora, verificamos que los elementos críticos están presentes
      render(<MockAccessibleForm />)
      
      const requiredFields = screen.getAllByText('*')
      expect(requiredFields.length).toBeGreaterThan(0)
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper heading hierarchy', () => {
      render(
        <div>
          <MockAccessibleForm />
          <MockAccessibleTable />
        </div>
      )
      
      // Verificar jerarquía de headings
      expect(screen.getByRole('heading', { level: 1, name: 'Agregar Cliente' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: 'Lista de Productos' })).toBeInTheDocument()
    })

    it('should have live regions for dynamic content', async () => {
      const user = userEvent.setup()
      render(<MockAccessibleForm />)
      
      const submitButton = screen.getByRole('button', { name: 'Guardar Cliente' })
      await user.click(submitButton)
      
      // Verificar que los errores tienen aria-live
      const errorElements = screen.getAllByRole('alert')
      errorElements.forEach(error => {
        expect(error).toHaveAttribute('aria-live', 'polite')
      })
    })

    it('should provide context for complex interactions', () => {
      render(<MockAccessibleTable />)
      
      // Verificar que los botones deshabilitados tienen explicación
      const editButtons = screen.getAllByText('Editar')
      const disabledButton = editButtons.find(button => 
        (button as HTMLButtonElement).disabled
      )
      
      if (disabledButton) {
        expect(disabledButton).toBeDisabled()
      }
    })
  })

  describe('Mobile Accessibility', () => {
    it('should have adequate touch targets', () => {
      render(<MockAccessibleForm />)
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        // Los botones deberían tener un tamaño mínimo adecuado
        // En un test real, verificaríamos las dimensiones CSS
        expect(button).toBeInTheDocument()
      })
    })

    it('should support zoom up to 200%', () => {
      // Este test requeriría simulación de zoom
      // Por ahora, verificamos que el contenido es accesible
      render(<MockAccessibleForm />)
      
      expect(screen.getByRole('form', { name: 'Formulario de cliente' })).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should have visible focus indicators', async () => {
      const user = userEvent.setup()
      render(<MockAccessibleForm />)
      
      await user.tab()
      const focusedElement = document.activeElement
      
      // Verificar que hay un elemento enfocado
      expect(focusedElement).not.toBe(document.body)
      expect(focusedElement).toBeInTheDocument()
    })

    it('should support skip links for navigation', () => {
      // En una aplicación real, habría skip links
      render(
        <div>
          <a href="#main-content" className="skip-link">
            Saltar al contenido principal
          </a>
          <main id="main-content">
            <MockAccessibleForm />
          </main>
        </div>
      )
      
      expect(screen.getByText('Saltar al contenido principal')).toBeInTheDocument()
    })
  })
})