import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CheckoutProvider, useCheckout } from '../../../contexts/CheckoutContext'
import { SaleSummary } from '../SaleSummary'

function MixedCreditSummaryHarness() {
  const { setIsMixedPayment, setPaymentSplit, setCreditTerms } = useCheckout()
  return (
    <>
      <button type="button" onClick={() => {
        setIsMixedPayment(true)
        setPaymentSplit([
          { id: 'cash', method: 'cash', amount: 100_000 },
          { id: 'credit', method: 'credit', amount: 1_200_000 },
        ])
        setCreditTerms({ count: 12, interestRate: 10, frequency: 'monthly' })
      }}>Aplicar plan mixto</button>
      <SaleSummary
        cart={[
          { id: 'phone', name: 'Teléfono', price: 1_200_000, quantity: 1 },
          { id: 'case', name: 'Funda', price: 100_000, quantity: 1 },
        ]}
        cartCalculations={{
          subtotal: 1_300_000,
          subtotalAfterAllDiscounts: 1_300_000,
          generalDiscount: 0,
          wholesaleDiscount: 0,
          wholesaleDiscountRate: 0,
          tax: 0,
          total: 1_300_000,
        }}
        isWholesale={false}
        WHOLESALE_DISCOUNT_RATE={0}
        formatCurrency={amount => `Gs. ${amount}`}
      />
    </>
  )
}

describe('SaleSummary mixed product credit', () => {
  it('keeps the sale subtotal and shows the financing impact separately', async () => {
    const user = userEvent.setup()
    render(<CheckoutProvider><MixedCreditSummaryHarness /></CheckoutProvider>)

    await user.click(screen.getByRole('button', { name: 'Aplicar plan mixto' }))

    expect(screen.getAllByText('Gs. 1300000').length).toBeGreaterThan(0)
    expect(screen.getByText('Capital financiado:')).toBeInTheDocument()
    expect(screen.getAllByText('Gs. 1200000').length).toBeGreaterThan(0)
    expect(screen.getByText('Pago inmediato:')).toBeInTheDocument()
    expect(screen.getAllByText('Gs. 100000').length).toBeGreaterThan(0)
    expect(screen.getByText('+Gs. 120000')).toBeInTheDocument()
    expect(screen.getByText('Total final con financiación:')).toBeInTheDocument()
    expect(screen.getByText('Gs. 1420000')).toBeInTheDocument()
  })
})
