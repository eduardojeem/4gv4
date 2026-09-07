import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileOrderHistory } from '@/components/profile/profile-order-history'

describe('ProfileOrderHistory', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], nextCursor: null }) })))

  it('combines store and payment filters in the request', async () => {
    render(<ProfileOrderHistory initialOrders={[{
      id: '1', order_number: 'PED-1', status: 'DELIVERED', payment_status: 'PAID', fulfillment_type: 'PICKUP', customer_address: null,
      estimated_delivery_date: null, total: 100, created_at: '2026-09-01T10:00:00Z', organization: { id: 'o1', name: 'Moda Sur', slug: 'moda-sur' },
    }]} totalCount={1} tenantPrefix="/marketplace" />)
    fireEvent.change(screen.getByLabelText('Filtrar por tienda'), { target: { value: 'moda-sur' } })
    fireEvent.change(screen.getByLabelText('Filtrar por pago'), { target: { value: 'PAID' } })
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('organization=moda-sur'), expect.anything()))
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain('payment=PAID')
  })

  it('announces an empty filtered result', async () => {
    render(<ProfileOrderHistory initialOrders={[]} totalCount={0} tenantPrefix="/marketplace" />)
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'READY' } })
    expect(await screen.findByText('No encontramos pedidos con esos filtros.')).toBeInTheDocument()
  })
})
