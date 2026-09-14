import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '3e34e410-6bdd-46f2-bb9b-8a52073113db' }),
  useRouter: () => ({ push: mockPush }),
}))

const mockSupplierDb = {
  id: '3e34e410-6bdd-46f2-bb9b-8a52073113db',
  name: 'Electrónica Central SRL',
  contact_name: 'Carlos Benítez',
  email: 'ventas@central.com.py',
  phone: '+595 21 555 1234',
  address: 'Av. Eusebio Ayala 2450',
  city: 'Asunción',
  country: 'Paraguay',
  postal_code: '1500',
  website: 'https://electronicacentral.com.py',
  business_type: 'distributor',
  status: 'active',
  rating: 4.7,
  products_count: 55,
  total_orders: 22,
  total_amount: 3450000,
  notes: 'Entrega en 24 horas.',
  created_at: '2025-01-10T08:00:00Z',
  updated_at: '2025-02-15T14:30:00Z',
}

// Stable mock client
const mockClient = {
  from: vi.fn((table: string) => {
    if (table === 'suppliers') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockSupplierDb, error: null }),
          }),
        }),
      }
    }
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 55, data: [], error: null }),
      }),
    }
  }),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockClient,
}))

// Mock heavy children components
vi.mock('@/components/suppliers/SupplierProductsList', () => ({
  SupplierProductsList: ({ onOrderProduct }: { onOrderProduct?: (p: any) => void }) => (
    <div data-testid="supplier-products-list">
      <button onClick={() => onOrderProduct?.({ id: 'prod-1', name: 'Módulo Pantalla', purchasePrice: 45000 })}>
        Pedir Módulo
      </button>
    </div>
  ),
}))

vi.mock('@/components/suppliers/SupplierOrdersList', () => ({
  SupplierOrdersList: ({ onCreateOrder }: { onCreateOrder?: () => void }) => (
    <div data-testid="supplier-orders-list">
      <button onClick={onCreateOrder}>Crear Pedido</button>
    </div>
  ),
}))

vi.mock('@/components/suppliers/SupplierNotes', () => ({
  SupplierNotes: ({ notes, onSaved }: { notes?: string; onSaved?: (n: string | null) => void }) => (
    <div data-testid="supplier-notes">
      <span>Notas: {notes}</span>
      <button onClick={() => onSaved?.('Notas modificadas')}>Guardar Notas</button>
    </div>
  ),
}))

vi.mock('@/components/dashboard/supplier-modal', () => ({
  SupplierModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? <div data-testid="supplier-modal"><button onClick={onClose}>Cerrar Modal</button></div> : null
  ),
}))

vi.mock('@/components/suppliers/CreateOrderModal', () => ({
  CreateOrderModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? <div data-testid="create-order-modal"><button onClick={onClose}>Cerrar Orden</button></div> : null
  ),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import SupplierDetailPage from '../page'

describe('SupplierDetailPage ([id])', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders supplier details, header, KPIs and quick contact links', async () => {
    render(<SupplierDetailPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Electrónica Central SRL').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText('Activo').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Distribuidor').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Carlos Benítez/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('+595 21 555 1234').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ventas@central.com.py').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('WhatsApp')).toBeDefined()
    expect(screen.getByText('Sitio Web')).toBeDefined()
    expect(screen.getByText('Datos Comerciales')).toBeDefined()
    expect(screen.getByText('Ubicación y Despacho')).toBeDefined()
  })

  it('opens SupplierModal when clicking Editar Proveedor', async () => {
    render(<SupplierDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Editar Proveedor/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Editar Proveedor/i }))
    expect(screen.getByTestId('supplier-modal')).toBeDefined()

    fireEvent.click(screen.getByText('Cerrar Modal'))
    expect(screen.queryByTestId('supplier-modal')).toBeNull()
  })

  it('opens CreateOrderModal when clicking Nueva Orden', async () => {
    render(<SupplierDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Nueva Orden/i })).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: /Nueva Orden/i }))
    expect(screen.getByTestId('create-order-modal')).toBeDefined()
  })

  it('allows navigation between tabs and rendering child lists', async () => {
    render(<SupplierDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Productos/i })).toBeDefined()
    })

    // Switch to Products Tab
    const prodTab = screen.getByRole('tab', { name: /Productos/i })
    fireEvent.mouseDown(prodTab)
    fireEvent.click(prodTab)
    expect(screen.getByTestId('supplier-products-list')).toBeDefined()

    // Test ordering from product
    fireEvent.click(screen.getByText('Pedir Módulo'))
    expect(screen.getByTestId('create-order-modal')).toBeDefined()

    // Switch to Orders Tab
    const ordTab = screen.getByRole('tab', { name: /Órdenes/i })
    fireEvent.mouseDown(ordTab)
    fireEvent.click(ordTab)
    expect(screen.getByTestId('supplier-orders-list')).toBeDefined()

    // Switch to Notes Tab
    const notesTab = screen.getByRole('tab', { name: /Notas/i })
    fireEvent.mouseDown(notesTab)
    fireEvent.click(notesTab)
    expect(screen.getByTestId('supplier-notes')).toBeDefined()
  })
})
