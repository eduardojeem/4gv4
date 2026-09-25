import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePOSRepairs } from '../usePOSRepairs'

vi.mock('@/contexts/branch-context', () => ({
  useBranch: () => ({ selectedBranchId: 'branch-1' }),
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ repairs: [] }),
  })))
})

describe('usePOSRepairs', () => {
  it('does not enable delivery just because checkout opens', async () => {
    const { result, rerender } = renderHook(
      ({ open }) => usePOSRepairs({
        selectedCustomer: '',
        isCheckoutOpen: open,
        taxPercentage: 10,
      }),
      { initialProps: { open: false } },
    )

    act(() => {
      result.current.setCustomerRepairs([{
        id: 'repair-1',
        ticket_number: 'R-1',
        status: 'listo',
        final_cost: 500,
        paid_amount: 0,
        qualityCheck: { result: 'passed' },
      }])
      result.current.setSelectedRepairIds(['repair-1'])
    })
    rerender({ open: true })

    await waitFor(() => expect(result.current.selectedRepairs).toHaveLength(1))
    expect(result.current.markRepairDelivered).toBe(false)
    expect(result.current.deliveryEligibility.canDeliver).toBe(true)
  })

  it('forces delivery off when any selected repair stops being eligible', async () => {
    const { result } = renderHook(() => usePOSRepairs({
      selectedCustomer: '',
      isCheckoutOpen: true,
      taxPercentage: 10,
    }))

    act(() => {
      result.current.setCustomerRepairs([{
        id: 'repair-1', status: 'listo', final_cost: 500, paid_amount: 0,
        qualityCheck: { result: 'passed' },
      }])
      result.current.setSelectedRepairIds(['repair-1'])
    })
    await waitFor(() => expect(result.current.deliveryEligibility.canDeliver).toBe(true))
    act(() => result.current.setMarkRepairDelivered(true))
    expect(result.current.markRepairDelivered).toBe(true)

    act(() => result.current.setCustomerRepairs((current) => current.map((repair) => ({
      ...repair,
      status: 'reparacion',
    }))))
    await waitFor(() => expect(result.current.markRepairDelivered).toBe(false))
    expect(result.current.deliveryEligibility.blockingTickets).toHaveLength(1)
  })

  it('normalizes a searched repair into the selected repair collection', () => {
    const { result } = renderHook(() => usePOSRepairs({
      selectedCustomer: '',
      isCheckoutOpen: false,
      taxPercentage: 10,
    }))

    act(() => result.current.addRepairToCart({
      id: 'repair_repair-1', name: 'Reparación R-1', price: 300, quantity: 1,
      stock: 999, subtotal: 300, isService: true,
    }, {
      id: 'repair-1', customer_id: 'customer-1', ticket_number: 'R-1',
      status: 'reparacion', final_cost: 500, paid_amount: 200,
    }))

    expect(result.current.selectedRepairs).toEqual([
      expect.objectContaining({ id: 'repair-1', customer_id: 'customer-1' }),
    ])
  })
})
