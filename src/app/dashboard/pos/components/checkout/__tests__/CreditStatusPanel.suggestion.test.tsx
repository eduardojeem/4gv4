import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CreditStatusPanel } from '../CreditStatusPanel'

const suggestion = {
  productId: 'product-1',
  productName: 'Notebook',
  count: 12,
  interestRate: 12,
  frequency: 'monthly' as const,
}

describe('CreditStatusPanel plan source', () => {
  it('shows the product that suggested matching terms', () => {
    render(
      <CreditStatusPanel
        cartTotal={1_200_000}
        creditSummary={{ availableCredit: 2_000_000, usedCredit: 0 }}
        terms={{ count: 12, interestRate: 12, frequency: 'monthly' }}
        suggestion={suggestion}
        onTermsChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Plan sugerido por Notebook')).toBeInTheDocument()
    expect(screen.getByText(/total financiado del ticket/)).toBeInTheDocument()
  })

  it('marks the suggestion as manually adjusted when terms differ', () => {
    render(
      <CreditStatusPanel
        cartTotal={1_200_000}
        creditSummary={{ availableCredit: 2_000_000, usedCredit: 0 }}
        terms={{ count: 6, interestRate: 12, frequency: 'monthly' }}
        suggestion={suggestion}
        onTermsChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Condiciones ajustadas manualmente')).toBeInTheDocument()
  })
})
