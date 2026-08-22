import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SaleConfirmationDialog } from '../SaleConfirmationDialog'

describe('SaleConfirmationDialog', () => {
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
