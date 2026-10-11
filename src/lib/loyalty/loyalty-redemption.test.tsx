import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_options: unknown, handler: (request: NextRequest, ctx: unknown, route: unknown) => unknown) =>
    (request: NextRequest, route: unknown) => handler(request, { organization: { id: 'org' } }, route),
}))
vi.mock('@/lib/supabase/org-scoped-server', () => ({ createOrgScopedClient: async () => ({ rpc }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { POST } = await import('@/app/api/loyalty/customers/[customerId]/redeem/route')
const { RedeemPointsControl } = await import('@/app/dashboard/pos/components/checkout/RedeemPointsControl')
const { ProfilePoints } = await import('@/components/profile/profile-points')
const { redemptionFromRow } = await import('@/app/dashboard/pos/hooks/useLoyaltyPreview')

const canjear = (body: unknown) =>
  (POST as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(
    new NextRequest('http://localhost/api/loyalty/customers/c1/redeem', { method: 'POST', body: JSON.stringify(body) }),
    { params: Promise.resolve({ customerId: 'c1' }) },
  )

afterEach(() => { rpc.mockReset(); vi.unstubAllGlobals() })

describe('el canje por saldo a favor', () => {
  it('canjea con una clave por intento', async () => {
    rpc.mockResolvedValue({ data: { points: 300, amount: '3000.00', balance: 200, replayed: false }, error: null })
    const response = await canjear({ points: 300, idempotencyKey: 'intento-1234' })
    expect(await response.json()).toEqual({ success: true, data: { points: 300, amount: 3000, balance: 200, replayed: false } })
    expect(rpc).toHaveBeenCalledWith('redeem_loyalty_points_to_store_credit', { p_organization_id: 'org', p_customer_id: 'c1', p_points: 300, p_idempotency_key: 'redeem:intento-1234' })
  })

  it.each([
    ['INSUFFICIENT_POINTS', 'El cliente no tiene esa cantidad de puntos.'],
    ['BELOW_MIN_REDEMPTION', 'Todavía no llega al mínimo de puntos para canjear.'],
    ['REDEMPTION_DISABLED', 'El canje de puntos está apagado. Configuralo en Promociones → Puntos.'],
  ])('%s se explica en palabras del cajero', async (code, message) => {
    rpc.mockResolvedValue({ data: null, error: { message: code } })
    const response = await canjear({ points: 300, idempotencyKey: 'intento-1234' })
    expect(response.status).toBe(422)
    expect((await response.json()).error).toBe(message)
  })

  it('sin valor de canje la tienda no lo ofrece', () => {
    expect(redemptionFromRow({ enabled: true, redemption_value: null })).toBeNull()
    expect(redemptionFromRow({ enabled: false, redemption_value: 10 })).toBeNull()
    expect(redemptionFromRow({ enabled: true, redemption_value: 10, min_redemption_points: 100 })).toEqual({ value: 10, min: 100 })
  })
})

describe('el botón de canje en el cobro', () => {
  const formatCurrency = (n: number) => `Gs. ${n.toLocaleString('es-PY')}`

  it('muestra cuánto vale y canjea', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { points: 500, amount: 5000, balance: 0 } }) })
    vi.stubGlobal('fetch', fetchMock)
    const onRedeemed = vi.fn()
    render(<RedeemPointsControl customerId="c1" balance={500} redemption={{ value: 10, min: 100 }} formatCurrency={formatCurrency} onRedeemed={onRedeemed} />)

    fireEvent.click(screen.getByRole('button', { name: /Canjear por Gs\. 5\.000/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Canjear' }))
    await waitFor(() => expect(onRedeemed).toHaveBeenCalledWith({ points: 500, amount: 5000, balance: 0 }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ points: 500 })
  })

  it('por debajo del mínimo avisa en vez de ofrecer el canje', () => {
    render(<RedeemPointsControl customerId="c1" balance={50} redemption={{ value: 10, min: 100 }} formatCurrency={formatCurrency} onRedeemed={vi.fn()} />)
    expect(screen.getByText('Canjea desde 100 puntos.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('«Mis puntos» en el perfil del cliente', () => {
  const base = { earning: { currencyPerPoint: 10000, pointsPerUnit: 1 }, movements: [{ id: '1', points: 15, description: 'Compra: 15 puntos', createdAt: '2026-10-10T12:00:00Z' }] }

  it('muestra el saldo, cuánto vale y los movimientos', () => {
    render(<ProfilePoints points={{ ...base, balance: 320, redemption: { value: 10, min: null, balanceValue: 3200 } }} />)
    expect(screen.getByText('320')).toBeInTheDocument()
    expect(screen.getByText(/Sumás 1 punto cada/)).toBeInTheDocument()
    expect(screen.getByText(/Equivalen a/)).toHaveTextContent('3.200')
    expect(screen.getByText('Compra: 15 puntos')).toBeInTheDocument()
  })

  it('si no llega al mínimo, dice cuánto le falta', () => {
    render(<ProfilePoints points={{ ...base, balance: 40, redemption: { value: 10, min: 100, balanceValue: 400 } }} />)
    expect(screen.getByText(/Te faltan/)).toHaveTextContent('60 puntos')
  })
})
