import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POSRepairChargeModal } from '../POSRepairChargeModal'

const usePOSRepairSearch = vi.fn()

vi.mock('@/contexts/branch-context', () => ({
  useBranch: () => ({ selectedBranchId: 'branch-1' }),
}))
vi.mock('../../hooks/usePOSRepairSearch', () => ({
  usePOSRepairSearch: (...args: unknown[]) => usePOSRepairSearch(...args),
}))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn() } }))

const pagination = { page: 1, pageSize: 20, total: 1, totalPages: 1 }

describe('POSRepairChargeModal', () => {
  beforeEach(() => usePOSRepairSearch.mockReset())

  it('shows zero balance and disables a fully paid repair', () => {
    usePOSRepairSearch.mockReturnValue({
      repairs: [{
        id: 'repair-1', ticket_number: 'R-1', status: 'listo',
        final_cost: 500, paid_amount: 500, created_at: '2026-09-25T00:00:00Z',
      }],
      pagination, status: 'success', error: null,
      retry: vi.fn(), nextPage: vi.fn(), previousPage: vi.fn(),
    })

    render(<POSRepairChargeModal open onOpenChange={vi.fn()} onAddRepairToCart={vi.fn()} />)

    expect(screen.getByText('Gs. 0')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sin saldo pendiente' })).toBeDisabled()
  })

  it('allows charging a non-ready repair and labels it as no delivery', async () => {
    const onAddRepairToCart = vi.fn()
    usePOSRepairSearch.mockReturnValue({
      repairs: [{
        id: 'repair-1', ticket_number: 'R-1', customer_id: 'customer-1',
        status: 'reparacion', final_cost: 500, paid_amount: 200,
        created_at: '2026-09-25T00:00:00Z',
      }],
      pagination, status: 'success', error: null,
      retry: vi.fn(), nextPage: vi.fn(), previousPage: vi.fn(),
    })

    render(<POSRepairChargeModal open onOpenChange={vi.fn()} onAddRepairToCart={onAddRepairToCart} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cobrar sin entregar' }))

    expect(onAddRepairToCart).toHaveBeenCalledWith(
      expect.objectContaining({ price: 300, subtotal: 300 }),
      expect.objectContaining({ id: 'repair-1', customer_id: 'customer-1' }),
    )
  })

  it('renders an explicit error with retry', async () => {
    const retry = vi.fn()
    usePOSRepairSearch.mockReturnValue({
      repairs: [], pagination, status: 'error', error: 'Sin conexión',
      retry, nextPage: vi.fn(), previousPage: vi.fn(),
    })

    render(<POSRepairChargeModal open onOpenChange={vi.fn()} onAddRepairToCart={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
