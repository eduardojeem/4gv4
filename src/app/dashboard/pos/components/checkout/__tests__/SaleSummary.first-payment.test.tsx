import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PosCreditTerms } from '@/lib/credits/pos-credit-summary'
import { SaleSummary } from '../SaleSummary'

vi.mock('../../../contexts/CheckoutContext', () => ({ useCheckout: () => React.useContext(TestContext) }))
const TestContext = React.createContext<Record<string, unknown>>({})
function Harness({ mixed = false, credit = true, deferred = false }) {
  const [creditTerms, setCreditTerms] = useState<PosCreditTerms>({ count: 3, frequency: 'monthly', interestRate: 0, startDate: '2026-09-01', firstInstallmentTiming: deferred ? 'next_cycle' : 'at_start' })
  const state = { discount: 0, paymentMethod: 'credit', isMixedPayment: mixed, paymentSplit: mixed ? [{ method: 'cash', amount: 60000 }, ...(credit ? [{ method: 'credit', amount: 300000 }] : [])] : [], creditTerms, setCreditTerms, storeCreditApplied: 0, paymentStatus: 'idle' }
  return <TestContext.Provider value={state}><SaleSummary cart={[]} cartCalculations={{ subtotal: 360000, subtotalAfterAllDiscounts: 360000, generalDiscount: 0, wholesaleDiscount: 0, wholesaleDiscountRate: 0, tax: 0, total: 360000 }} isWholesale={false} WHOLESALE_DISCOUNT_RATE={0} formatCurrency={n => `Gs. ${n}`} /></TestContext.Provider>
}
describe('revisión del cobro en el modal principal', () => {
  it('permite cobrar la primera cuota y actualiza el saldo sin aumentar el total', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Cobrar primera cuota ahora/ }))
    expect(screen.getByTestId('checkout-collect-now')).toHaveTextContent('Gs. 120000')
    expect(screen.getByTestId('checkout-credit-balance')).toHaveTextContent('Gs. 240000')
    expect(screen.getByText('Gs. 360000', { selector: '.text-xl' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Efectivo recibido para la cuota'), { target: { value: '1' } })
    expect(screen.getByRole('alert')).toHaveTextContent('no cubre la primera cuota')
  })
  it('suma la entrega inicial a la cuota sin descontarla dos veces del crédito', () => {
    render(<Harness mixed />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Cobrar primera cuota ahora/ }))
    expect(screen.getByTestId('checkout-collect-now')).toHaveTextContent('Gs. 160000')
    expect(screen.getByTestId('checkout-credit-balance')).toHaveTextContent('Gs. 200000')
  })
  it('no ofrece cobro cuando el pago mixto no contiene crédito', () => {
    render(<Harness mixed credit={false} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
  it('deshabilita la opción cuando el vencimiento comienza en el próximo ciclo', () => {
    render(<Harness deferred />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })
})
