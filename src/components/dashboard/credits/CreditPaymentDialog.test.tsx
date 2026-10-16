import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CreditPaymentDialog } from './CreditPaymentDialog'

vi.mock('@/hooks/use-credit-printing', () => ({ useCreditPrinting: () => ({ format: '80mm', changeFormat: vi.fn(), issuer: { businessName: 'Prueba' } }) }))

it.each(['card', 'transfer'] as const)('requires a reference before confirming the selected %s method', async method => {
  const onConfirm = vi.fn().mockResolvedValue({ success: false, error: 'Fixture only' })
  render(<CreditPaymentDialog open onOpenChange={vi.fn()} onConfirm={onConfirm} initialMethod={method} initialAmount={100} maxPaymentAmount={100}
    creditInfo={{ id: 'credit', customerId: 'customer', customerName: 'Cliente prueba', principal: 100, interestRate: 0, termMonths: 1, remainingBalance: 100 }} />)
  const confirm = screen.getByRole('button', { name: 'Confirmar Pago' })
  expect(confirm).toBeDisabled()
  fireEvent.change(screen.getByLabelText(method === 'card' ? 'Número de cupón *' : 'Número de comprobante *'), { target: { value: 'REF-001' } })
  expect(confirm).toBeEnabled()
  fireEvent.click(confirm)
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(method, 100, 'REF-001', undefined, false))
})
