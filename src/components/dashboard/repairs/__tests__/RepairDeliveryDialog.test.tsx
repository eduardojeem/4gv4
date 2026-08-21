import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { RepairDeliveryDialog } from '../RepairDeliveryDialog'

const cashRegisterMocks = vi.hoisted(() => ({
  checkOpenSession: vi.fn(),
  openRegister: vi.fn(),
}))

vi.mock('@/hooks/useCashRegister', () => ({
  useCashRegister: () => cashRegisterMocks,
}))

vi.mock('@/app/dashboard/pos/components/OpenCashRegisterDialog', () => ({
  OpenCashRegisterDialog: (props: {
    open: boolean
    amount: string
    note: string
    onAmountChange: (value: string) => void
    onNoteChange: (value: string) => void
    onSubmit: (amount: number, note: string) => void
  }) => props.open ? (
    <div role="dialog" aria-label="Abrir caja">
      <label htmlFor="delivery-opening-amount">Fondo inicial</label>
      <input id="delivery-opening-amount" value={props.amount} onChange={event => props.onAmountChange(event.target.value)} />
      <label htmlFor="delivery-opening-note">Referencia del turno</label>
      <input id="delivery-opening-note" value={props.note} onChange={event => props.onNoteChange(event.target.value)} />
      <button type="button" onClick={() => props.onSubmit(Number(props.amount), props.note)}>Confirmar apertura</button>
    </div>
  ) : null,
}))

vi.mock('@/lib/currency', () => ({
  formatCurrency: (amount: number) => `${amount}`,
  formatThousands: (value: string | number) => String(value),
  parseThousands: (value: string) => value,
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
  beforeEach(() => {
    vi.clearAllMocks()
    cashRegisterMocks.checkOpenSession.mockResolvedValue({ id: 'session-1' })
  })

  it('blocks cash collection and offers to open a closed register', async () => {
    cashRegisterMocks.checkOpenSession.mockResolvedValue(null)

    render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Reparado y funcionando/i }))

    expect(await screen.findByText('Caja cerrada')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cobrar y Entregar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeEnabled()
  })

  it('allows credit delivery while the register is closed', async () => {
    cashRegisterMocks.checkOpenSession.mockResolvedValue(null)

    render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Reparado y funcionando/i }))

    expect(await screen.findByText('Caja cerrada')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Crédito' }))
    expect(screen.getByRole('button', { name: 'Registrar Crédito y Entregar' })).toBeEnabled()
  })

  it('does not keep the suggested payment after returning and choosing withdrawn', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    fireEvent.click(screen.getByRole('button', { name: /Retirado sin reparar/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar y entregar' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledWith('repair-1', expect.objectContaining({
      outcome: 'withdrawn',
      charge: { mode: 'none' },
      parts: [],
      settlement: { kind: 'none' },
      idempotencyKey: expect.stringMatching(/^repair-delivery-/),
    }))
  })

  it('registers a full transfer and repaired delivery without outstanding consent', async () => {
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
    expect(await screen.findByText('Caja abierta')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Cobrar reparación' })).toBeInTheDocument()
    expect(screen.getByLabelText('Monto a cobrar')).toHaveValue('100')
    expect(screen.queryByRole('button', { name: /Retirado sin reparar/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(screen.getByRole('button', { name: /Reparado y funcionando/i })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Reparado y funcionando/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Transferencia' }))
    fireEvent.change(screen.getByLabelText('N° de Referencia'), { target: { value: 'TRX-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar y Entregar' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledWith('repair-1', expect.objectContaining({
      outcome: 'repaired',
      allowOutstandingBalance: false,
      idempotencyKey: expect.stringMatching(/^repair-delivery-/),
      payment: expect.objectContaining({
        method: 'transfer',
        amount: 100,
        reference: 'TRX-1',
      }),
    }))
  })

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
    expect(await screen.findByText('Caja abierta')).toBeVisible()
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

  it('opens the register without losing the delivery payment draft', async () => {
    cashRegisterMocks.checkOpenSession
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'session-1' })
    cashRegisterMocks.openRegister.mockResolvedValue(true)

    render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Reparado y funcionando/i }))
    expect(await screen.findByText('Caja cerrada')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Transferencia' }))
    fireEvent.change(screen.getByLabelText('Monto a cobrar'), { target: { value: '40' } })
    fireEvent.change(screen.getByLabelText('N° de Referencia'), { target: { value: 'TRX-2' } })
    fireEvent.change(screen.getByPlaceholderText(/Se cambió la pantalla/i), { target: { value: 'Cliente conforme' } })

    fireEvent.click(screen.getByRole('button', { name: 'Abrir caja' }))
    fireEvent.change(screen.getByLabelText('Fondo inicial'), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText('Referencia del turno'), { target: { value: 'Turno tarde' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar apertura', hidden: true }))

    await waitFor(() => expect(cashRegisterMocks.openRegister).toHaveBeenCalledWith('principal', 50000, undefined, 'Turno tarde'))
    expect(await screen.findByText('Caja abierta')).toBeVisible()
    expect(screen.getByLabelText('Monto a cobrar')).toHaveValue('40')
    expect(screen.getByLabelText('N° de Referencia')).toHaveValue('TRX-2')
    expect(screen.getByPlaceholderText(/Se cambió la pantalla/i)).toHaveValue('Cliente conforme')
  })

  it('keeps the modal open and shows an API rejection', async () => {
    const apiError = Object.assign(new Error('Caja cerrada durante el cobro'), { code: 'REPAIR_CASH_REGISTER_NOT_OPEN' })
    const onConfirm = vi.fn().mockRejectedValue(apiError)

    render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: /Reparado y funcionando/i }))
    expect(await screen.findByText('Caja abierta')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar y Entregar' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('alert')).toHaveTextContent('Caja cerrada durante el cobro')
    expect(screen.getByText('Caja cerrada')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Cobrar reparación' })).toBeVisible()
    expect(screen.getByLabelText('Monto a cobrar')).toHaveValue('100')
  })
})
