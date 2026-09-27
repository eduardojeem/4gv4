import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomerGlobalPaymentModal } from '@/components/dashboard/customers/CustomerGlobalPaymentModal'
import type { Customer } from '@/hooks/use-customer-state'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

const cliente = { id: '44444444-4444-4444-8444-444444444444', name: 'Ana', phone: '0981000000' } as Customer

const deudas = {
  success: true,
  debts: [
    {
      id: 'cuota', type: 'installment', title: 'Crédito #abc · cuota 1', totalAmount: 100000, paidAmount: 0,
      pendingAmount: 100000, isOverdue: true, status: 'Vencida', collectable: true,
    },
    {
      id: 'rep', type: 'repair', title: 'Reparación #T-9', totalAmount: 200000, paidAmount: 0,
      pendingAmount: 200000, isOverdue: false, status: 'En taller', operationalStatus: 'listo',
      repairCategory: 'ready_for_pickup', collectable: false, blockedReason: 'Es de otra sucursal: cobrala desde esa sucursal, así entra a su caja.',
    },
  ],
  totalDebt: 300000,
  collectableDebt: 100000,
  overdueDebt: 100000,
  storeBalance: 0,
}

afterEach(() => { vi.unstubAllGlobals() })

async function abrir() {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => (init?.method === 'POST' ? { success: true, receiptNumber: 'REC-1', totalAmount: 100000, appliedAllocations: [] } : deudas),
  }))
  vi.stubGlobal('fetch', fetchMock)
  render(<CustomerGlobalPaymentModal customer={cliente} open onClose={() => {}} />)
  await waitFor(() => expect(screen.getAllByText('Reparación #T-9').length).toBeGreaterThan(0))
  return fetchMock
}

describe('el modal de cobro, en pantalla', () => {
  it('se abre sin romper y ya no ofrece copiar cuentas bancarias', async () => {
    await abrir()
    expect(screen.queryByText(/Copiar Cuentas Bancarias/)).not.toBeInTheDocument()
  })

  it('marca las deudas de otra sucursal y no deja cobrarlas desde acá', async () => {
    await abrir()
    expect(screen.getAllByText('Otra sucursal').length).toBeGreaterThan(0)
    // «Pagar todo» ofrece solo lo que se puede cobrar desde esta sucursal.
    expect(screen.getByRole('button', { name: /Pagar Todo \(.*100\.000/ })).toBeInTheDocument()
  })

  it('pide confirmar el sobrante antes de cobrar', async () => {
    const fetchMock = await abrir()
    const monto = screen.getByPlaceholderText('0')
    fireEvent.change(monto, { target: { value: '150000' } })

    const confirmar = screen.getByRole('button', { name: /Confirmar Abono/ })
    expect(confirmar).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(confirmar).not.toBeDisabled()
    fireEvent.click(confirmar)

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(true))
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')!
    const body = JSON.parse(String((post[1] as RequestInit).body))
    expect(body).toMatchObject({ amount: 150000, paymentMethod: 'cash', creditExcessToStoreCredit: true })
    expect(body.idempotencyKey).toMatch(/^cobro-/)
  })
})
