import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CustomerDetailModal } from '../CustomerDetailModal'
import type { Customer } from '@/hooks/use-customer-state'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        }))
      }))
    }))
  }))
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('CustomerDetailModal', () => {
  const mockCustomer: Customer = {
    id: 'cust-1234-uuid',
    customerCode: 'CLI-00123',
    name: 'Carlos Benítez',
    phone: '0981112233',
    alternate_phone: '0982998877',
    alternate_phone_label: 'Esposa (María)',
    email: 'carlos@example.com',
    ruc: '1234567-8',
    customer_type: 'wholesale',
    status: 'active',
    address: 'Avda. Eusebio Ayala 1234',
    city: 'Asunción',
    notes: 'Cliente preferencial de reparaciones de pantallas',
    total_repairs: 14,
    total_purchases: 5,
    lifetime_value: 3500000,
    loyalty_points: 120,
    credit_limit: 1000000,
    current_balance: 350000,
    registration_date: '2025-01-10T10:00:00Z',
    last_visit: '',
    last_activity: '',
    credit_score: 10,
    segment: 'wholesale',
    satisfaction_score: 5,
    avg_order_value: 250000,
    purchase_frequency: 'alta',
    preferred_contact: 'whatsapp',
    birthday: '',
    pending_amount: 0,
    tags: []
  }

  const mockAuthorizedPersons = [
    {
      id: 'auth-1',
      full_name: 'María González',
      document_number: '4567890',
      phone: '0982998877',
      relationship: 'Esposa',
      is_active: true
    },
    {
      id: 'auth-2',
      full_name: 'Marcos Benítez',
      document_number: '5678901',
      phone: null,
      relationship: 'Hijo',
      is_active: true
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    window.open = vi.fn()
  })

  it('renders customer name, code, ruc and badges correctly', () => {
    render(
      <CustomerDetailModal
        open={true}
        onClose={vi.fn()}
        customer={mockCustomer}
      />
    )

    expect(screen.getByText('Carlos Benítez')).toBeInTheDocument()
    expect(screen.getByText('CLI-00123')).toBeInTheDocument()
    expect(screen.getByText(/1234567-8/)).toBeInTheDocument()
    expect(screen.getByText('Mayorista / Técnico')).toBeInTheDocument()
  })

  it('renders primary phone and alternate phone with its custom label', () => {
    render(
      <CustomerDetailModal
        open={true}
        onClose={vi.fn()}
        customer={mockCustomer}
      />
    )

    expect(screen.getByText('0981112233')).toBeInTheDocument()
    expect(screen.getByText('Principal')).toBeInTheDocument()
    expect(screen.getByText('0982998877')).toBeInTheDocument()
    expect(screen.getByText('Esposa (María)')).toBeInTheDocument()
  })

  it('renders authorized persons for repair pickup with documents and relationship', () => {
    render(
      <CustomerDetailModal
        open={true}
        onClose={vi.fn()}
        customer={mockCustomer}
        authorizedPersons={mockAuthorizedPersons}
      />
    )

    expect(screen.getByText('Personas Autorizadas para Retiro')).toBeInTheDocument()
    expect(screen.getByText('2 autorizadas')).toBeInTheDocument()
    expect(screen.getByText('María González')).toBeInTheDocument()
    expect(screen.getByText('Esposa')).toBeInTheDocument()
    expect(screen.getByText(/4567890/)).toBeInTheDocument()
    expect(screen.getByText('Marcos Benítez')).toBeInTheDocument()
    expect(screen.getByText('Hijo')).toBeInTheDocument()
    expect(screen.getByText(/5678901/)).toBeInTheDocument()
  })

  it('renders workshop metrics and credit/balance if available', () => {
    render(
      <CustomerDetailModal
        open={true}
        onClose={vi.fn()}
        customer={mockCustomer}
      />
    )

    expect(screen.getByText('Historial y Métricas en Taller')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument() // repairs
    expect(screen.getByText('5')).toBeInTheDocument() // purchases
    expect(screen.getByText('120')).toBeInTheDocument() // loyalty points
    expect(screen.getByText(/Cuenta Corriente Comercial/)).toBeInTheDocument()
    expect(screen.getByText(/Cliente preferencial de reparaciones de pantallas/)).toBeInTheDocument()
  })

  it('calls onEdit when clicking "Editar Datos"', () => {
    const handleEdit = vi.fn()
    const handleClose = vi.fn()

    render(
      <CustomerDetailModal
        open={true}
        onClose={handleClose}
        customer={mockCustomer}
        onEdit={handleEdit}
      />
    )

    const editBtn = screen.getByRole('button', { name: /Editar Datos/i })
    fireEvent.click(editBtn)

    expect(handleClose).toHaveBeenCalled()
    expect(handleEdit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Carlos Benítez',
      phone: '0981112233'
    }))
  })

  it('opens WhatsApp with properly formatted link and message when clicking WhatsApp for alternate phone', () => {
    render(
      <CustomerDetailModal
        open={true}
        onClose={vi.fn()}
        customer={mockCustomer}
      />
    )

    const altWhatsAppBtn = screen.getByTitle('Enviar mensaje de WhatsApp al número alternativo')
    fireEvent.click(altWhatsAppBtn)

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/595982998877?text='),
      '_blank',
      'noopener,noreferrer'
    )
  })
})
