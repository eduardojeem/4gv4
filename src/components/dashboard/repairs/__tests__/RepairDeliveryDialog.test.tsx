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
  qualityCheck: {
    id: 'quality-1', result: 'passed', checkedAt: '2026-09-13T12:00:00Z',
    checkedBy: { id: 'tech-1', name: 'Ana Técnica' },
    checklist: {
      powersOn: true, reportedIssueResolved: true, basicFunctions: true,
      physicalCondition: true, accessoriesVerified: true,
    },
  },
} as Repair

describe('RepairDeliveryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cashRegisterMocks.checkOpenSession.mockResolvedValue({ id: 'session-1' })
  })

  it('uses a responsive full-height flow with scrollable content and fixed actions', () => {
    render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.getByTestId('repair-delivery-modal')).toHaveClass('max-sm:h-[100dvh]', 'sm:max-w-2xl')
    expect(screen.getByTestId('repair-delivery-header')).toHaveClass('py-2')
    expect(screen.getByTestId('repair-delivery-body')).toHaveClass('flex-1', 'overflow-y-auto')
    expect(screen.getByTestId('repair-delivery-actions')).toHaveClass('max-sm:grid', 'max-sm:grid-cols-2')
  })

  it('makes it explicit that a fully paid device can be delivered without another charge', () => {
    render(<RepairDeliveryDialog
      open
      repair={{ ...repair, paidAmount: 100 }}
      onOpenChange={vi.fn()}
      onConfirm={vi.fn()}
    />)

    expect(screen.getByRole('heading', { name: 'Confirmar entrega — equipo pagado' })).toBeVisible()
    expect(screen.getByText('Equipo pagado en su totalidad')).toBeVisible()
    expect(screen.getByText('Podés entregarlo sin registrar otro cobro.')).toBeVisible()
  })

  it('shows the advance and remaining balance before delivery', () => {
    render(<RepairDeliveryDialog
      open
      repair={{ ...repair, paidAmount: 40 }}
      onOpenChange={vi.fn()}
      onConfirm={vi.fn()}
    />)

    // Verificado y con saldo: abre en el cobro, con el anticipo a la vista.
    expect(screen.getByRole('heading', { name: 'Cobrar saldo y entregar' })).toBeVisible()
    expect(screen.getByText('Anticipo recibido: 40')).toBeVisible()
    expect(screen.getByText('Saldo pendiente al entregar: 60')).toBeVisible()
  })

  it('explains an advance when the final price is still unknown', () => {
    render(<RepairDeliveryDialog
      open
      repair={{ ...repair, finalCost: null, estimatedCost: 0, paidAmount: 30 }}
      onOpenChange={vi.fn()}
      onConfirm={vi.fn()}
    />)

    expect(screen.getByRole('heading', { name: 'Entregar: falta el precio' })).toBeVisible()
    expect(screen.getByText('Anticipo recibido: 30')).toBeVisible()
    expect(screen.getByText('El precio final todavía está pendiente; el saldo se calculará cuando lo definas.')).toBeVisible()
  })

  it('blocks cash collection and offers to open a closed register', async () => {
    cashRegisterMocks.checkOpenSession.mockResolvedValue(null)

    render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(await screen.findByText('Caja cerrada')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cobrar y Entregar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeEnabled()
  })

  it('allows credit delivery while the register is closed', async () => {
    cashRegisterMocks.checkOpenSession.mockResolvedValue(null)

    render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(await screen.findByText('Caja cerrada')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Crédito' }))
    // Por defecto, una sola cuota.
    expect(screen.getByLabelText('N° de cuotas')).toHaveValue(1)
    expect(screen.getByRole('button', { name: 'Registrar Crédito y Entregar' })).toBeEnabled()
  })

  it('uses the previously verified unrepaired outcome without suggesting payment', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <RepairDeliveryDialog
        open
        repair={{ ...repair, qualityCheck: { ...repair.qualityCheck!, result: 'withdrawn', note: 'El cliente decidió retirar.' } }}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

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

  /** Con la verificación aprobada y saldo pendiente, «Resultado» era un clic de más. */
  it('opens straight on collecting the balance when the device was verified as working', async () => {
    render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Cobrar saldo y entregar' })).toBeInTheDocument()
    expect(screen.getByLabelText('Monto a cobrar')).toHaveValue('100')
    expect(screen.queryByText('¿Cuál fue el resultado?')).not.toBeInTheDocument()
    expect(await screen.findByText('Caja abierta')).toBeVisible()
  })

  it('still starts on the result when a verified repair is already paid', () => {
    render(<RepairDeliveryDialog open repair={{ ...repair, paidAmount: 100 }} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.getByText('¿Cuál fue el resultado?')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirmar Entrega' })).toBeEnabled()
  })

  it('does not let the cashier replace the certified technical result', () => {
    render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.getByText(/resultado técnico registrado por Ana Técnica/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Retirado sin reparar/i })).not.toBeInTheDocument()
  })

  it('blocks the flow when the ready device has no technical verification', () => {
    render(<RepairDeliveryDialog open repair={{ ...repair, qualityCheck: null }} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.getByText(/falta la verificación técnica/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirmar Entrega' })).toBeDisabled()
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

    expect(await screen.findByText('Caja abierta')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Cobrar saldo y entregar' })).toBeInTheDocument()
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

  it('blocks confirmation and explains when the entered payment exceeds the balance', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <RepairDeliveryDialog
        open
        repair={{ ...repair, paidAmount: 40 }}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    expect(await screen.findByText('Caja abierta')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Monto a cobrar'), { target: { value: '70' } })

    expect(screen.getByLabelText('Monto a cobrar')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('El monto supera el saldo pendiente de 60.')
    expect(screen.getByRole('button', { name: /Cobrar y Entregar/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Cobrar y Entregar/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('opens the register without losing the delivery payment draft', async () => {
    cashRegisterMocks.checkOpenSession
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'session-1' })
    cashRegisterMocks.openRegister.mockResolvedValue(true)

    render(<RepairDeliveryDialog open repair={repair} onOpenChange={vi.fn()} onConfirm={vi.fn()} />)
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
    expect(await screen.findByText('Caja abierta')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar y Entregar' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('alert')).toHaveTextContent('Caja cerrada durante el cobro')
    expect(screen.getByText('Caja cerrada')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Abrir caja' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Cobrar saldo y entregar' })).toBeVisible()
    expect(screen.getByLabelText('Monto a cobrar')).toHaveValue('100')
  })

  it('shows technical verification warning and allows opening technical verification modal', () => {
    const onOpenChange = vi.fn()
    const onOpenQualityCheck = vi.fn()
    const unverifiedRepair = { ...repair, qualityCheck: undefined }

    render(
      <RepairDeliveryDialog
        open
        repair={unverifiedRepair}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
        onOpenQualityCheck={onOpenQualityCheck}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Falta la verificación técnica')
    const openQualityBtn = screen.getByRole('button', { name: /Abrir verificación técnica/i })
    expect(openQualityBtn).toBeVisible()

    fireEvent.click(openQualityBtn)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onOpenQualityCheck).toHaveBeenCalledWith(unverifiedRepair)
  })
})

describe('RepairDeliveryDialog: entregar una reparación sin precio', () => {
  const unpriced = { ...repair, finalCost: null, estimatedCost: 0, laborCost: 0, parts: [], paidAmount: 0 } as unknown as Repair

  beforeEach(() => {
    vi.clearAllMocks()
    cashRegisterMocks.checkOpenSession.mockResolvedValue({ id: 'session-1' })
  })

  it('pregunta cuánto se cobró, fija el precio y después cobra y entrega', async () => {
    const onDefinePrice = vi.fn().mockResolvedValue(undefined)
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<RepairDeliveryDialog open repair={unpriced} onOpenChange={vi.fn()} onConfirm={onConfirm} onDefinePrice={onDefinePrice} />)

    expect(screen.getByText('¿Cuánto cobraste por esta reparación?')).toBeVisible()
    expect(screen.getByRole('button', { name: /Confirmar Entrega/ })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('¿Cuánto cobraste por esta reparación?'), { target: { value: '350' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente: cobrar/ }))
    expect(await screen.findByLabelText('Monto a cobrar')).toHaveValue('350')
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar y Entregar' }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onDefinePrice).toHaveBeenCalledWith('repair-1', { pricingMode: 'budget', finalCost: 350 })
    expect(onDefinePrice.mock.invocationCallOrder[0]).toBeLessThan(onConfirm.mock.invocationCallOrder[0])
    expect(onConfirm).toHaveBeenCalledWith('repair-1', expect.objectContaining({ outcome: 'repaired', payment: expect.objectContaining({ amount: 350 }) }))
  })

  it('«Sin cargo» entrega con precio 0 y el motivo, sin cobrar', async () => {
    const onDefinePrice = vi.fn().mockResolvedValue(undefined)
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(<RepairDeliveryDialog open repair={unpriced} onOpenChange={vi.fn()} onConfirm={onConfirm} onDefinePrice={onDefinePrice} />)

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Entrega/ }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onDefinePrice).toHaveBeenCalledWith('repair-1', expect.objectContaining({ finalCost: 0, priceOverrideReason: expect.stringMatching(/Sin cargo/) }))
    expect(onConfirm.mock.calls[0][1]).not.toHaveProperty('payment')
  })

  it('sugiere lo que se cobró antes por lo mismo y lo usa con un toque', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      suggestion: { lastPrice: 350, typicalPrice: 350, count: 1, matchedIssue: 'pantalla', device: 'Marca Modelo' },
    }))))
    render(<RepairDeliveryDialog open repair={unpriced} onOpenChange={vi.fn()} onConfirm={vi.fn()} onDefinePrice={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Usar 350' }, { timeout: 2000 }))
    expect(screen.getByLabelText('¿Cuánto cobraste por esta reparación?')).toHaveValue('350')
    expect(screen.getByText(/La última vez cobraste 350 por «pantalla» en Marca Modelo/)).toBeVisible()
    vi.unstubAllGlobals()
  })

  it('si la pantalla no puede fijar el precio, no deja entregar y explica dónde hacerlo', () => {
    render(<RepairDeliveryDialog open repair={unpriced} onOpenChange={vi.fn()} onConfirm={vi.fn()} allowPayment={false} />)
    fireEvent.change(screen.getByLabelText('¿Cuánto cobraste por esta reparación?'), { target: { value: '350' } })
    expect(screen.getByText(/definilo en el detalle de la reparación/)).toBeVisible()
    expect(screen.getByRole('button', { name: /Confirmar Entrega/ })).toBeDisabled()
  })
})
