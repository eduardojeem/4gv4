import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CustomerSelector } from './CustomerSelector'
import type { Customer } from '@/hooks/use-customer-state'

// El selector consulta la base al montar; aca solo interesan las etiquetas,
// asi que se le pasan los clientes por prop y se neutralizan los hooks de datos.
vi.mock('@/hooks/use-customer-state', () => ({
  useCustomerState: () => ({ filteredCustomers: [], loading: false }),
}))

vi.mock('@/hooks/useCustomerRepairs', () => ({
  useCustomerRepairs: () => ({ repairs: [], loading: false, fetchRepairs: vi.fn() }),
}))

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'c-1',
    customerCode: 'CLI-001',
    name: 'Distribuidora Sur',
    email: 'ventas@sur.test',
    phone: '0981000000',
    customer_type: 'wholesale',
    status: 'active',
    total_purchases: 0,
    total_repairs: 0,
    registration_date: '2026-01-01',
    last_visit: '2026-01-01',
    last_activity: '2026-01-01',
    address: '',
    city: '',
    credit_score: 0,
    segment: 'wholesale',
    satisfaction_score: 0,
    lifetime_value: 0,
    avg_order_value: 0,
    purchase_frequency: '',
    preferred_contact: '',
    birthday: '',
    loyalty_points: 0,
    credit_limit: 0,
    current_balance: 0,
    pending_amount: 0,
    notes: '',
    tags: [],
    referral_source: '',
    discount_percentage: 0,
    payment_terms: '',
    assigned_salesperson: '',
    last_purchase_amount: 0,
    total_spent_this_year: 0,
    ...overrides,
  }
}

describe('CustomerSelector — etiquetas del cliente seleccionado', () => {
  it('muestra el tipo y el segmento en español, no el valor crudo', () => {
    // Reporte del usuario: al seleccionar un cliente en el POS decia "wholesale".
    render(
      <CustomerSelector
        selectedCustomer={makeCustomer()}
        onSelectCustomer={vi.fn()}
        customers={[]}
      />,
    )

    expect(screen.queryByText('wholesale')).toBeNull()
    expect(screen.getAllByText('Mayorista').length).toBeGreaterThan(0)
  })

  it('traduce también el estado', () => {
    render(
      <CustomerSelector
        selectedCustomer={makeCustomer()}
        onSelectCustomer={vi.fn()}
        customers={[]}
      />,
    )

    expect(screen.queryByText('active')).toBeNull()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('no rompe con un segmento que no está mapeado', () => {
    render(
      <CustomerSelector
        selectedCustomer={makeCustomer({ segment: 'segmento_raro' })}
        onSelectCustomer={vi.fn()}
        customers={[]}
      />,
    )

    // Legible en vez de crudo: nunca una celda vacia ni "segmento_raro".
    expect(screen.getByText('Segmento raro')).toBeInTheDocument()
  })
})
