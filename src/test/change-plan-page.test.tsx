import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChangePlanPage from '@/app/admin/subscriptions/change-plan/page'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

function plan(code: string, name: string, price: number) {
  return {
    code, name, price_monthly: price, currency: 'PYG', price_note: null, description: null,
    is_popular: false, highlights: [], features: [],
  }
}

function mockData(overrides: Record<string, unknown> = {}) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    currentPlan: plan('PRO_MAX', 'Pro Max', 200000),
    usage: {},
    plans: [plan('FREE', 'Gratuito', 0), plan('PRO', 'Pro', 100000), plan('PRO_MAX', 'Pro Max', 200000)],
    billingMissingFields: [],
    paidPeriodEndsAt: '2026-11-19T12:00:00.000Z',
    ...overrides,
  })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Cambiar plan', () => {
  it('no cobra con un clic: muestra el detalle y espera la confirmación', async () => {
    const fetchMock = mockData()
    render(<ChangePlanPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Elegir Pro' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Cambiar a Pro')
    expect(screen.getByText('−Gs. 100.000', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/los días que quedan de Pro Max no se descuentan/)).toBeInTheDocument()
    // Solo la carga inicial: todavía no se pidió el cambio.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('bajar a Gratuito con un mes pago avisa que se programa al vencimiento', async () => {
    mockData()
    render(<ChangePlanPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar a gratuito' }))

    expect(screen.getByText(/Seguís con Pro Max hasta el/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Programar el cambio' })).toBeEnabled()
  })

  it('desde Gratuito y sin datos de facturación arranca en transferencia y bloquea tarjeta', async () => {
    const fetchMock = mockData({
      billingMissingFields: ['RUC o CI'],
      currentPlan: plan('FREE', 'Gratuito', 0),
      paidPeriodEndsAt: null,
    })
    render(<ChangePlanPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Elegir Pro' }))

    expect(screen.getByRole('button', { name: /^tarjeta/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^transferencia/i })).toHaveAttribute('aria-pressed', 'true')

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, redirectTo: '/admin/subscriptions#pay-transfer' })))
    fireEvent.click(screen.getByRole('button', { name: 'Generar solicitud de transferencia' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ plan: 'PRO', paymentMethod: 'transfer' })
  })

  it('entre planes pagos no ofrece transferencia', async () => {
    mockData()
    render(<ChangePlanPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Elegir Pro' }))

    expect(screen.queryByRole('button', { name: /^transferencia/i })).not.toBeInTheDocument()
  })
})
