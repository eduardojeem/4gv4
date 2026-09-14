import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SupplierDetailModal } from '@/components/suppliers/SupplierDetailModal'
import type { UISupplier } from '@/lib/types/supplier-ui'

// Mock heavy sub-components
vi.mock('@/components/suppliers/SupplierProductsList', () => ({
  SupplierProductsList: ({ onOrderProduct }: { onOrderProduct?: (p: any) => void }) => (
    <div data-testid="supplier-products-list">
      <button onClick={() => onOrderProduct?.({ id: 'p-1', name: 'Pantalla OLED' })}>
        Pedir Producto
      </button>
    </div>
  ),
}))

vi.mock('@/components/suppliers/SupplierOrdersList', () => ({
  SupplierOrdersList: ({ onCreateOrder }: { onCreateOrder?: () => void }) => (
    <div data-testid="supplier-orders-list">
      <button onClick={onCreateOrder}>Crear Orden en Lista</button>
    </div>
  ),
}))

vi.mock('@/components/suppliers/SupplierNotes', () => ({
  SupplierNotes: ({ onSaved }: { onSaved?: (n: string | null) => void }) => (
    <div data-testid="supplier-notes">
      <button onClick={() => onSaved?.('Notas actualizadas')}>Guardar Notas</button>
    </div>
  ),
}))

const mockSupplier: UISupplier = {
  id: 'sup-123',
  name: 'Distribuidora Global SA',
  contact_name: 'Juan Pérez',
  email: 'contacto@distribuidoraglobal.com',
  phone: '+54 9 11 1234-5678',
  address: 'Av. Corrientes 1234',
  city: 'Buenos Aires',
  country: 'Argentina',
  postal_code: '1043',
  website: 'https://distribuidoraglobal.com',
  rating: 4.8,
  status: 'active',
  business_type: 'distributor',
  notes: 'Proveedor confiable de repuestos.',
  total_orders: 15,
  total_amount: 150000,
  products_count: 42,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-02-01T00:00:00Z',
} as UISupplier

describe('SupplierDetailModal', () => {
  it('renders supplier information correctly when open', () => {
    render(
      <SupplierDetailModal
        isOpen={true}
        onClose={vi.fn()}
        supplier={mockSupplier}
      />
    )

    // Name appears in title and in commercial info card
    const names = screen.getAllByText('Distribuidora Global SA')
    expect(names.length).toBeGreaterThanOrEqual(1)

    expect(screen.getByText('Activo')).toBeDefined()
    expect(screen.getAllByText('Distribuidor').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Contacto: Juan Pérez/)).toBeDefined()
    expect(screen.getByText('+54 9 11 1234-5678')).toBeDefined()
    expect(screen.getByText('contacto@distribuidoraglobal.com')).toBeDefined()
    expect(screen.getByText('Sitio Web')).toBeDefined()
    expect(screen.getByText('WhatsApp')).toBeDefined()
    expect(screen.getByText('Datos Comerciales')).toBeDefined()
    expect(screen.getByText('Ubicación y Domicilio')).toBeDefined()
  })

  it('triggers onCreateOrder and onEdit callbacks', () => {
    const handleCreateOrder = vi.fn()
    const handleEdit = vi.fn()

    render(
      <SupplierDetailModal
        isOpen={true}
        onClose={vi.fn()}
        supplier={mockSupplier}
        onCreateOrder={handleCreateOrder}
        onEdit={handleEdit}
      />
    )

    const orderBtn = screen.getByRole('button', { name: /Nueva Orden/i })
    fireEvent.click(orderBtn)
    expect(handleCreateOrder).toHaveBeenCalledWith(mockSupplier)

    const editBtn = screen.getByRole('button', { name: /Editar/i })
    fireEvent.click(editBtn)
    expect(handleEdit).toHaveBeenCalledWith(mockSupplier)
  })

  it('navigates between tabs and renders child components', () => {
    const handleNotesSaved = vi.fn()
    const handleCreateOrder = vi.fn()

    render(
      <SupplierDetailModal
        isOpen={true}
        onClose={vi.fn()}
        supplier={mockSupplier}
        onNotesSaved={handleNotesSaved}
        onCreateOrder={handleCreateOrder}
      />
    )

    // Check Initial Tab (Informacion)
    expect(screen.getByText('Datos Comerciales')).toBeDefined()
    expect(screen.getByText('Ubicación y Domicilio')).toBeDefined()

    // Switch to Products Tab via Radix TabsTrigger (mousedown + click)
    const productsTab = screen.getByRole('tab', { name: /Productos/i })
    fireEvent.mouseDown(productsTab)
    fireEvent.click(productsTab)
    expect(screen.getByTestId('supplier-products-list')).toBeDefined()

    const orderProductBtn = screen.getByText('Pedir Producto')
    fireEvent.click(orderProductBtn)
    expect(handleCreateOrder).toHaveBeenCalledWith(mockSupplier, { id: 'p-1', name: 'Pantalla OLED' })

    // Switch to Orders Tab
    const ordersTab = screen.getByRole('tab', { name: /Órdenes/i })
    fireEvent.mouseDown(ordersTab)
    fireEvent.click(ordersTab)
    expect(screen.getByTestId('supplier-orders-list')).toBeDefined()

    // Switch to Notes Tab
    const notesTab = screen.getByRole('tab', { name: /Notas/i })
    fireEvent.mouseDown(notesTab)
    fireEvent.click(notesTab)
    expect(screen.getByTestId('supplier-notes')).toBeDefined()

    const saveNotesBtn = screen.getByText('Guardar Notas')
    fireEvent.click(saveNotesBtn)
    expect(handleNotesSaved).toHaveBeenCalledWith('Notas actualizadas')
  })
})
