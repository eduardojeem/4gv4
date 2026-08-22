import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PaymentCashSessionGuard } from './PaymentCashSessionGuard'

describe('PaymentCashSessionGuard', () => {
  it('shows a blocking status while caja is being checked', () => {
    render(<PaymentCashSessionGuard state="checking" onOpenCashRegister={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Consultando caja')
  })

  it('offers opening the register when it is closed', () => {
    const onOpen = vi.fn()
    render(<PaymentCashSessionGuard state="closed" onOpenCashRegister={onOpen} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Caja cerrada')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir caja' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('presents caja as a prerequisite before a payment form', () => {
    const onCancel = vi.fn()
    render(
      <PaymentCashSessionGuard
        state="closed"
        variant="gate"
        branchName="Sucursal Centro"
        registerName="Caja Principal"
        onOpenCashRegister={vi.fn()}
        onCancel={onCancel}
      />
    )

    expect(screen.getByRole('heading', { name: 'Abrí la caja para continuar' })).toBeVisible()
    expect(screen.getByText(/Todos los cobros y pagos deben quedar asociados/)).toBeVisible()
    expect(screen.getByText('Sucursal Centro')).toBeVisible()
    expect(screen.getByText('Caja Principal')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('directs users without opening permission to cash management', () => {
    render(<PaymentCashSessionGuard state="closed" variant="gate" canOpenRegister={false} onOpenCashRegister={vi.fn()} />)

    expect(screen.getByText('Solicitá a un responsable que abra la caja.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ir a Caja' })).toHaveAttribute('href', '/dashboard/pos/caja')
  })

  it('confirms when caja is open and renders nothing for non-payment operations', () => {
    const { rerender } = render(<PaymentCashSessionGuard state="open" onOpenCashRegister={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Caja abierta')

    rerender(<PaymentCashSessionGuard state="idle" onOpenCashRegister={vi.fn()} />)
    expect(screen.queryByText(/Caja/)).not.toBeInTheDocument()
  })
})
