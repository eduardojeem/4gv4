import { cleanup, render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomerCreditFileSummary, CreditFilePaymentSummary } from '@/app/dashboard/pos/components/checkout/CustomerCreditFileSummary'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('credit file operational POS summary', () => {
  it('does not request a file for cash even with a stale inactive credit split', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<CreditFilePaymentSummary customerId="fixture" mixed={false} method="cash" splits={[{ method: 'credit' }]} formatAmount={String} />)
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Resumen de ficha para crédito')).not.toBeInTheDocument()
  })
  it('does not reuse an older customer response after changing customer', async () => {
    let resolveFirst!: (value: Response) => void
    const summary = (limit: number) => new Response(JSON.stringify({ summary: { status: 'approved', mode: 'informational', missing: [], limit, outstanding: 0, available: limit, overdueCount: 0, eligible: true } }))
    vi.stubGlobal('fetch', vi.fn((url) => String(url).includes('/first/') ? new Promise<Response>(resolve => { resolveFirst = resolve }) : Promise.resolve(summary(300))))
    const { rerender } = render(<CustomerCreditFileSummary customerId="first" formatAmount={String} />)
    rerender(<CustomerCreditFileSummary customerId="second" formatAmount={String} />)
    await waitFor(() => expect(screen.getAllByText('300')).toHaveLength(2))
    await act(async () => { resolveFirst(summary(999)); await Promise.resolve() })
    expect(screen.queryByText('999')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver cliente' })).toHaveAttribute('href', '/dashboard/customers?id=second')
  })
  it('shows financial aggregates and a customer link without private fields', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ summary: { status: 'pending', mode: 'required', missing: ['approval'], limit: 500, outstanding: 200, available: 300, overdueCount: 2, eligible: false } }))))
    render(<CustomerCreditFileSummary customerId="customer-1" />)
    expect(await screen.findByText('Pendiente de revisión')).toBeInTheDocument()
    expect(screen.getByText(/Requiere aprobación/)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver cliente' })).toHaveAttribute('href', '/dashboard/customers?id=customer-1')
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/customers/customer-1/credit-file/summary')
  })
  it('does not claim approval when the migration is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'La ficha no está disponible.' }), { status: 503 })))
    render(<CustomerCreditFileSummary customerId="customer-1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('no está disponible')
    expect(screen.queryByText('Aprobado')).not.toBeInTheDocument()
  })
})
