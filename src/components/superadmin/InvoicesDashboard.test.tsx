import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/superadmin/invoices',
  useSearchParams: () => new URLSearchParams(),
}))

import { InvoicesDashboard, type InvoiceRow } from './InvoicesDashboard'

const pago = (extra: Partial<InvoiceRow> = {}): InvoiceRow => ({
  id: 'p1',
  organizationId: 'o1',
  organizationName: 'Tienda Uno',
  organizationSlug: 'tienda-uno',
  organizationPlan: 'PRO',
  planId: 'PRO',
  amount: 200_000,
  currency: 'PYG',
  status: 'paid',
  paymentMethod: 'card',
  provider: 'pagopar',
  providerPaymentId: null,
  externalReference: null,
  receiptUrl: null,
  paidAt: '2026-09-20T12:00:00Z',
  createdAt: '2026-09-20T12:00:00Z',
  ...extra,
})

describe('Pagos', () => {
  it('muestra los cobros sin repetir los mismos números en otra tarjeta', () => {
    render(<InvoicesDashboard rows={[pago()]} referenceTime="2026-09-29T12:00:00Z" />)

    expect(screen.getByRole('heading', { name: 'Pagos' })).toBeInTheDocument()
    expect(screen.getByText('Últimos 30 días')).toBeInTheDocument()
    expect(screen.queryByText('Este mes')).not.toBeInTheDocument()
    expect(screen.queryByText('Resumen rápido')).not.toBeInTheDocument()
  })

  it('el reparto por proveedor solo aparece si hay más de uno', () => {
    const { rerender } = render(<InvoicesDashboard rows={[pago()]} referenceTime="2026-09-29T12:00:00Z" />)
    expect(screen.queryByText('Distribución por proveedor')).not.toBeInTheDocument()

    rerender(<InvoicesDashboard rows={[pago(), pago({ id: 'p2', provider: 'bancard' })]} referenceTime="2026-09-29T12:00:00Z" />)
    expect(screen.getByText('Distribución por proveedor')).toBeInTheDocument()
  })
})
