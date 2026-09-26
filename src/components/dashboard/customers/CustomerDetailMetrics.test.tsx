import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CustomerDetailMetrics } from './CustomerDetailMetrics'
import type { Customer } from '@/hooks/use-customer-state'

const customer = {
  id: 'customer-1',
  customerCode: 'CLI-0001',
  name: 'Ana Duarte',
  email: 'ana@example.com',
  phone: '0981000000',
  customer_type: 'regular',
  status: 'active',
  total_purchases: 4,
  lifetime_value: 2_000_000,
  credit_limit: 1_000_000,
  // La columna que no actualiza nadie: queda en 0 para todos los clientes.
  current_balance: 0,
  credit_score: 5,
} as unknown as Customer

const renderMetrics = (extra: Record<string, unknown> = {}) =>
  render(<CustomerDetailMetrics customer={{ ...customer, ...extra } as never} />)

describe('CustomerDetailMetrics', () => {
  it('shows the full limit as available when the customer owes nothing', () => {
    renderMetrics({ credit_outstanding: 0 })

    expect(screen.getByText('Crédito Disponible')).toBeInTheDocument()
    expect(screen.getAllByText(/1\.000\.000/).length).toBeGreaterThan(0)
  })

  // El bug: el disponible salía de `credit_limit - current_balance`, y esa
  // columna nunca se actualiza, así que un cliente que debía todo seguía
  // mostrando el límite completo disponible.
  it('subtracts what the customer actually owes, not the stale column', () => {
    renderMetrics({ credit_outstanding: 700_000, current_balance: 0 })

    // 1.000.000 − 700.000 disponible, y el saldo adeudado a la vista.
    expect(screen.getByText(/debe/)).toBeInTheDocument()
    expect(screen.getAllByText(/300\.000/).length).toBeGreaterThan(0)
  })

  it('never reports negative available credit', () => {
    renderMetrics({ credit_outstanding: 1_500_000 })

    const zero = screen.getAllByText(/^Gs\. 0$|^0$/)
    expect(zero.length).toBeGreaterThan(0)
  })

  it('falls back to zero outstanding when the balance could not be resolved', () => {
    renderMetrics({})

    expect(screen.getAllByText(/1\.000\.000/).length).toBeGreaterThan(0)
  })

  it('renders live stats for total spent, purchases and pending debt when provided', () => {
    render(
      <CustomerDetailMetrics
        customer={customer}
        stats={{
          totalSpent: 4_500_000,
          salesCount: 3,
          repairsCount: 2,
          totalPurchases: 5,
          pendingDebt: 600_000,
          availableCredit: 400_000,
          creditLimit: 1_000_000,
        }}
      />
    )

    expect(screen.getByText('Total Gastado')).toBeInTheDocument()
    expect(screen.getAllByText(/4\.500\.000/).length).toBeGreaterThan(0)
    expect(screen.getByText(/3 ventas · 2 reparaciones/)).toBeInTheDocument()
    expect(screen.getByText('Pedidos Totales')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Deuda Pendiente')).toBeInTheDocument()
    expect(screen.getAllByText(/600\.000/).length).toBeGreaterThan(0)
  })
})
