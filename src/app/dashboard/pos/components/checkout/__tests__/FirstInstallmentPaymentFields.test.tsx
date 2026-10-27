import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FirstInstallmentPaymentFields } from '../FirstInstallmentPaymentFields'
import type { FirstInstallmentPayment } from '@/lib/credits/first-payment'

function Harness({ initialAmount }: { initialAmount: number }) {
  const [amount, setAmount] = useState(initialAmount)
  const [payment, setPayment] = useState<FirstInstallmentPayment | undefined>()
  return <>
    <button type="button" onClick={() => setAmount(80000)}>cambiar cuota</button>
    <output data-testid="received">{payment?.cashReceived ?? ''}</output>
    <FirstInstallmentPaymentFields payment={payment} onChange={setPayment} amount={amount} available formatCurrency={value => `Gs. ${value}`} disabled={false} />
  </>
}

describe('cobro de la primera cuota en el checkout', () => {
  it('el efectivo precargado sigue a la cuota si cambian las cuotas', () => {
    render(<Harness initialAmount={50000} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Cobrar primera cuota ahora/ }))
    expect(screen.getByTestId('received')).toHaveTextContent('50000')
    fireEvent.click(screen.getByRole('button', { name: 'cambiar cuota' }))
    expect(screen.getByTestId('received')).toHaveTextContent('80000')
    expect(screen.getByText('Vuelto de la cuota: Gs. 0')).toBeInTheDocument()
  })

  it('no pisa un importe que el cajero escribió', () => {
    render(<Harness initialAmount={50000} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Cobrar primera cuota ahora/ }))
    fireEvent.change(screen.getByLabelText('Efectivo recibido para la cuota'), { target: { value: '100000' } })
    fireEvent.blur(screen.getByLabelText('Efectivo recibido para la cuota'))
    const typed = screen.getByTestId('received').textContent
    fireEvent.click(screen.getByRole('button', { name: 'cambiar cuota' }))
    expect(screen.getByTestId('received').textContent).toBe(typed)
  })
})
