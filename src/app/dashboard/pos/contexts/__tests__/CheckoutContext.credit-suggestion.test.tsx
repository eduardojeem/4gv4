import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CheckoutProvider, useCheckout } from '../CheckoutContext'

function CheckoutContextHarness() {
  const {
    creditTerms,
    setCreditTerms,
    creditPlanSuggestion,
    applyProductCreditSuggestion,
    resetCheckoutState,
  } = useCheckout()

  return (
    <div>
      <button onClick={() => setCreditTerms({ ...creditTerms, firstInstallmentTiming: 'next_cycle' })}>Diferir</button>
      <output data-testid="timing">{creditTerms.firstInstallmentTiming}</output>
      <button
        type="button"
        onClick={() => applyProductCreditSuggestion({
          productId: 'product-1',
          productName: 'Notebook',
          count: 12,
          interestRate: 12,
          frequency: 'monthly',
        })}
      >
        Aplicar sugerencia
      </button>
      <button type="button" onClick={resetCheckoutState}>Reiniciar</button>
      <output data-testid="credit-terms">
        {creditTerms.count}|{creditTerms.interestRate}|{creditTerms.frequency}
      </output>
      <output data-testid="credit-source">{creditPlanSuggestion?.productName ?? 'sin origen'}</output>
    </div>
  )
}

describe('CheckoutContext product credit suggestion', () => {
  it('conserva el inicio acordado al aplicar un plan y reinicia al valor predeterminado', async () => {
    const user = userEvent.setup()
    render(<CheckoutProvider><CheckoutContextHarness /></CheckoutProvider>)
    expect(screen.getByTestId('timing')).toHaveTextContent('at_start')
    await user.click(screen.getByText('Diferir'))
    await user.click(screen.getByText('Aplicar sugerencia'))
    expect(screen.getByTestId('timing')).toHaveTextContent('next_cycle')
    await user.click(screen.getByText('Reiniciar'))
    expect(screen.getByTestId('timing')).toHaveTextContent('at_start')
  })
  it('prefills terms and records the product that suggested them', async () => {
    const user = userEvent.setup()
    render(<CheckoutProvider><CheckoutContextHarness /></CheckoutProvider>)

    await user.click(screen.getByRole('button', { name: 'Aplicar sugerencia' }))

    expect(screen.getByTestId('credit-terms')).toHaveTextContent('12|12|monthly')
    expect(screen.getByTestId('credit-source')).toHaveTextContent('Notebook')
  })

  it('clears the suggestion when checkout resets', async () => {
    const user = userEvent.setup()
    render(<CheckoutProvider><CheckoutContextHarness /></CheckoutProvider>)

    await user.click(screen.getByRole('button', { name: 'Aplicar sugerencia' }))
    await user.click(screen.getByRole('button', { name: 'Reiniciar' }))

    expect(screen.getByTestId('credit-terms')).toHaveTextContent('1|0|monthly')
    expect(screen.getByTestId('credit-source')).toHaveTextContent('sin origen')
  })
})
