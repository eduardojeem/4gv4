import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { RepairPaymentDialog } from '../RepairPaymentDialog'

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
      <label htmlFor="opening-amount">Fondo inicial</label>
      <input id="opening-amount" value={props.amount} onChange={event => props.onAmountChange(event.target.value)} />
      <label htmlFor="opening-note">Referencia del turno</label>
      <input id="opening-note" value={props.note} onChange={event => props.onNoteChange(event.target.value)} />
      <button type="button" onClick={() => props.onSubmit(Number(props.amount), props.note)}>Confirmar apertura</button>
    </div>
  ) : null,
}))

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
  finalCost: 200000,
  estimatedCost: 200000,
  paidAmount: 20000,
} as Repair

describe('RepairPaymentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('blocks cash payments when the register is closed but allows credit', async () => {
    cashRegisterMocks.checkOpenSession.mockResolvedValue(null)

    render(<RepairPaymentDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(await screen.findByText('Caja cerrada')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Usar saldo pendiente/i }))
    expect(screen.getByRole('button', { name: 'Confirmar Cobro' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Crédito' }))
    expect(screen.getByRole('button', { name: 'Registrar Crédito' })).toBeEnabled()
  })

  it('blocks payment without a defined price and routes the user to price editing', () => {
    const onDefinePrice = vi.fn()
    const repairWithoutPrice = { ...repair, finalCost: 0, estimatedCost: 0, paidAmount: 0 }

    render(
      <RepairPaymentDialog
        open
        repair={repairWithoutPrice}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        onDefinePrice={onDefinePrice}
      />,
    )

    expect(screen.getByText('Primero definí el precio de la reparación')).toBeVisible()
    expect(screen.queryByText('Método de pago')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar Cobro' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Definir precio' }))
    expect(onDefinePrice).toHaveBeenCalledWith(expect.objectContaining({ id: 'repair-1' }))
    expect(cashRegisterMocks.checkOpenSession).not.toHaveBeenCalled()
  })

  it('shows a settled state instead of payment controls when the repair is fully paid', () => {
    const paidRepair = { ...repair, finalCost: 200000, estimatedCost: 200000, paidAmount: 200000 }

    render(<RepairPaymentDialog open repair={paidRepair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.getByText('Reparación totalmente pagada')).toBeVisible()
    expect(screen.getByText('Saldo pendiente').parentElement).toHaveTextContent('0')
    expect(screen.queryByText('Método de pago')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar Cobro' })).not.toBeInTheDocument()
    expect(cashRegisterMocks.checkOpenSession).not.toHaveBeenCalled()
  })

  it('opens the register and preserves the payment draft', async () => {
    cashRegisterMocks.checkOpenSession
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'session-1' })
    cashRegisterMocks.openRegister.mockResolvedValue(true)

    render(<RepairPaymentDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(await screen.findByText('Caja cerrada')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Monto aplicado a la reparación'), { target: { value: '100000' } })
    fireEvent.change(screen.getByPlaceholderText(/Cliente pagó/i), { target: { value: 'Seña del cliente' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir caja' }))
    fireEvent.change(screen.getByLabelText('Fondo inicial'), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText('Referencia del turno'), { target: { value: 'Turno tarde' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar apertura', hidden: true }))

    await waitFor(() => expect(cashRegisterMocks.openRegister).toHaveBeenCalledWith('principal', 50000, undefined, 'Turno tarde'))
    expect(await screen.findByText('Caja abierta')).toBeVisible()
    expect(screen.getByLabelText('Monto aplicado a la reparación')).toHaveValue(100000)
    expect(screen.getByPlaceholderText(/Cliente pagó/i)).toHaveValue('Seña del cliente')
  })

  it('calculates change and only submits the amount applied to the repair', async () => {
    cashRegisterMocks.checkOpenSession.mockResolvedValue({ id: 'session-1' })
    const onConfirm = vi.fn().mockResolvedValue(undefined)

    render(<RepairPaymentDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={onConfirm} />)

    expect(await screen.findByText('Caja abierta')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Monto aplicado a la reparación'), { target: { value: '180000' } })
    fireEvent.change(screen.getByLabelText('Efectivo recibido del cliente'), { target: { value: '200000' } })
    expect(screen.getByText(/Vuelto/).parentElement).toHaveTextContent('20000')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Cobro' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledWith('repair-1', expect.objectContaining({
      method: 'cash',
      amount: 180000,
    }))
    expect(onConfirm.mock.calls[0][1]).not.toHaveProperty('cashReceived')
  })

  it('does not allow cash received below the amount applied', async () => {
    cashRegisterMocks.checkOpenSession.mockResolvedValue({ id: 'session-1' })

    render(<RepairPaymentDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(await screen.findByText('Caja abierta')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Monto aplicado a la reparación'), { target: { value: '180000' } })
    fireEvent.change(screen.getByLabelText('Efectivo recibido del cliente'), { target: { value: '170000' } })

    expect(screen.getByText('El efectivo recibido no alcanza para cubrir el monto aplicado.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirmar Cobro' })).toBeDisabled()
  })

  it('keeps the dialog open and adjusts the draft when the server reports a newer balance', async () => {
    cashRegisterMocks.checkOpenSession.mockResolvedValue({ id: 'session-1' })
    const onConfirm = vi.fn().mockRejectedValue(Object.assign(
      new Error('El saldo pendiente cambió. El monto máximo actual es 100000.'),
      { code: 'REPAIR_PAYMENT_EXCEEDS_BALANCE', currentBalance: 100000 },
    ))

    render(<RepairPaymentDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={onConfirm} />)

    expect(await screen.findByText('Caja abierta')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Monto aplicado a la reparación'), { target: { value: '180000' } })
    fireEvent.change(screen.getByLabelText('Efectivo recibido del cliente'), { target: { value: '180000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Cobro' }))

    await waitFor(() => expect(screen.getByLabelText('Monto aplicado a la reparación')).toHaveValue(100000))
    expect(screen.getByRole('dialog', { name: /Procesar pago de reparación/i })).toBeVisible()
    expect(screen.getByText('Saldo pendiente').parentElement).toHaveTextContent('100000')
  })

  it('turns a server-reported zero balance into a controlled no-payment state', async () => {
    cashRegisterMocks.checkOpenSession.mockResolvedValue({ id: 'session-1' })
    const onConfirm = vi.fn().mockRejectedValue(Object.assign(
      new Error('La reparación ya no tiene saldo pendiente para cobrar.'),
      { code: 'REPAIR_HAS_NO_BALANCE', currentBalance: 0 },
    ))

    render(<RepairPaymentDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={onConfirm} />)

    expect(await screen.findByText('Caja abierta')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Monto aplicado a la reparación'), { target: { value: '180000' } })
    fireEvent.change(screen.getByLabelText('Efectivo recibido del cliente'), { target: { value: '180000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Cobro' }))

    expect(await screen.findByText('La reparación ya no tiene saldo pendiente para cobrar.')).toBeVisible()
    expect(screen.getByText('Reparación totalmente pagada')).toBeVisible()
    expect(screen.queryByLabelText('Monto aplicado a la reparación')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar Cobro' })).not.toBeInTheDocument()
  })
})
