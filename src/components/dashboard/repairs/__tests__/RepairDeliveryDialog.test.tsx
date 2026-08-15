import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { RepairDeliveryDialog } from '../RepairDeliveryDialog'

vi.mock('@/lib/currency', () => ({
  formatCurrency: (amount: number) => `${amount}`,
}))

const repair = {
  id: 'repair-1',
  ticketNumber: 'R-1',
  customer: { id: 'customer-1', name: 'Ana', phone: '', email: '' },
  brand: 'Marca',
  model: 'Modelo',
  issue: 'Pantalla',
  status: 'listo',
  finalCost: 100,
  estimatedCost: 100,
  paidAmount: 0,
} as Repair

describe('RepairDeliveryDialog', () => {
  it('requires explicit consent when a partial collection leaves a balance', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <RepairDeliveryDialog
        open
        repair={repair}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Reparado y funcionando/i }))
    fireEvent.change(screen.getByLabelText('Monto a cobrar'), { target: { value: '40' } })

    const submit = screen.getByRole('button', { name: /Cobrar y Entregar/i })
    expect(submit).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledWith('repair-1', expect.objectContaining({
      allowOutstandingBalance: true,
      idempotencyKey: expect.stringMatching(/^repair-delivery-/),
      payment: expect.objectContaining({ amount: 40 }),
    }))
  })
})
