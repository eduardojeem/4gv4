import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SaleConfirmationDialog } from '../SaleConfirmationDialog'
import { buildPosCreditSummary } from '@/lib/credits/pos-credit-summary'
import type { FirstInstallmentTiming } from '@/lib/credits/installments'
import type { FirstInstallmentPayment } from '@/lib/credits/first-payment'

function CreditConfirmationHarness() {
  const [timing, setTiming] = React.useState<FirstInstallmentTiming>('at_start')
  const [firstPayment, setFirstPayment] = React.useState<FirstInstallmentPayment>()
  const summary = buildPosCreditSummary(100000, { count: 3, frequency: 'monthly', interestRate: 0, startDate: '2026-01-31', firstInstallmentTiming: timing, firstPayment })
  return <SaleConfirmationDialog open onOpenChange={() => undefined} onConfirm={() => undefined} mode="credit" customerName="Ana" paymentLabel="Crédito" total={100000} immediateAmount={0} installmentCount={3} installmentAmount={summary.installmentAmount} firstDueDate={summary.firstDueDate} creditSummary={summary} onFirstInstallmentTimingChange={value => { setTiming(value); if (value === 'next_cycle') setFirstPayment(undefined) }} firstPayment={firstPayment} onFirstPaymentChange={setFirstPayment} formatCurrency={n => `Gs. ${n}`} isProcessing={false} />
}

describe('SaleConfirmationDialog', () => {
  it('cobra solo la primera cuota y bloquea efectivo insuficiente', () => {
    render(<CreditConfirmationHarness />)
    const toggle = screen.getByRole('checkbox', { name: /Cobrar primera cuota ahora/ })
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    expect(screen.getByText('Gs. 66667')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Efectivo recibido para la cuota'), { target: { value: '10000' } })
    expect(screen.getByRole('button', { name: 'Confirmar venta a crédito' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('El efectivo recibido no cubre')
    fireEvent.change(screen.getByLabelText('Efectivo recibido para la cuota'), { target: { value: '40000' } })
    expect(screen.getByText('Vuelto de la cuota: Gs. 6667')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar venta a crédito' })).toBeEnabled()
  })
  it('requiere referencia bancaria y desactiva el cobro si cambia al próximo ciclo', () => {
    render(<CreditConfirmationHarness />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Cobrar primera cuota ahora/ }))
    fireEvent.change(screen.getByLabelText('Medio de cobro de la cuota'), { target: { value: 'transfer' } })
    expect(screen.getByRole('button', { name: 'Confirmar venta a crédito' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Banco o cuenta receptora'), { target: { value: 'Banco' } })
    fireEvent.change(screen.getByLabelText('Referencia de transferencia'), { target: { value: '123456' } })
    expect(screen.getByRole('button', { name: 'Confirmar venta a crédito' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /¿Cuándo vence la primera cuota/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Desde el próximo ciclo/ }))
    expect(screen.getByRole('checkbox', { name: /Cobrar primera cuota ahora/ })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Cobrar primera cuota ahora/ })).not.toBeChecked()
  })
  it('permite cambiar el inicio en la confirmacion y detalla la ultima cuota', () => {
    render(<CreditConfirmationHarness />)
    fireEvent.click(screen.getByRole('button', { name: /¿Cuándo vence la primera cuota/ }))
    expect(screen.getByRole('radio', { name: /Desde el inicio/ })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: /Desde el próximo ciclo/ }))
    expect(screen.getByRole('radio', { name: /Desde el próximo ciclo/ })).toBeChecked()
    expect(screen.getByText('28/02/2026')).toBeInTheDocument()
    expect(screen.getByText(/Última cuota: Gs. 33334/)).toBeInTheDocument()
    expect(screen.getByText(/no registra el cobro de la primera cuota/)).toBeInTheDocument()
  })
  it('requires an explicit second action before confirming a regular sale', () => {
    const onConfirm = vi.fn()

    render(
      <SaleConfirmationDialog
        open
        onOpenChange={() => undefined}
        onConfirm={onConfirm}
        mode="sale"
        customerName="Consumidor final"
        paymentLabel="Efectivo"
        total={125000}
        immediateAmount={125000}
        formatCurrency={(amount) => `Gs. ${amount}`}
        isProcessing={false}
      />,
    )

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Confirmar venta' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows the complete financing commitment before confirming credit', () => {
    render(
      <SaleConfirmationDialog
        open
        onOpenChange={() => undefined}
        onConfirm={() => undefined}
        mode="credit"
        customerName="Ana Cliente"
        paymentLabel="Pago mixto con crédito"
        total={165000}
        immediateAmount={50000}
        financedPrincipal={100000}
        interestAmount={15000}
        installmentCount={3}
        installmentAmount={38333.33}
        firstDueDate="2026-09-05"
        formatCurrency={(amount) => `Gs. ${amount}`}
        isProcessing={false}
      />,
    )

    expect(screen.getByText('Confirmar venta a crédito')).toBeInTheDocument()
    expect(screen.getByText('Ana Cliente')).toBeInTheDocument()
    expect(screen.getByText('05/09/2026')).toBeInTheDocument()
    expect(screen.getByText('Gs. 50000')).toBeInTheDocument()
    expect(screen.getByText('Gs. 100000')).toBeInTheDocument()
    expect(screen.getByText('+Gs. 15000')).toBeInTheDocument()
  })

  it('blocks confirmation and review actions while processing', () => {
    render(
      <SaleConfirmationDialog
        open
        onOpenChange={() => undefined}
        onConfirm={() => undefined}
        mode="sale"
        customerName="Consumidor final"
        paymentLabel="Transferencia"
        total={50000}
        immediateAmount={50000}
        formatCurrency={(amount) => `Gs. ${amount}`}
        isProcessing
      />,
    )

    expect(screen.getByRole('button', { name: 'Procesando venta' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Volver y revisar' })).toBeDisabled()
  })
})
