import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProductCreditPlanPicker } from '../ProductCreditPlanPicker'

describe('ProductCreditPlanPicker', () => {
  it('shows product plans and applies the selected conditions', () => {
    const onSelect = vi.fn()
    render(
      <ProductCreditPlanPicker
        cartTotal={1_200_000}
        plans={[
          { productId: 'phone', productName: 'Teléfono', count: 6, interestRate: 0, frequency: 'monthly', productSubtotal: 1_200_000, cartSubtotal: 1_200_000 },
          { productId: 'phone', productName: 'Teléfono', count: 12, interestRate: 12, frequency: 'monthly', productSubtotal: 1_200_000, cartSubtotal: 1_200_000 },
        ]}
        selectedPlan={null}
        onSelect={onSelect}
        formatCurrency={amount => `Gs. ${amount}`}
      />,
    )

    expect(screen.getByText('Planes disponibles en el carrito')).toBeInTheDocument()
    expect(screen.getAllByText('Teléfono')).toHaveLength(2)
    expect(screen.getByText('12 cuotas')).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === 'Interés 12% · Total Gs. 1344000')).toBeInTheDocument()
    expect(screen.getAllByText('¿Cómo funcionan los créditos?')).toHaveLength(2)
    expect(screen.getAllByText(/Solo se financia el producto asociado al plan/)).toHaveLength(2)
    expect(screen.getAllByText(/Los demás productos se pagan en el momento/)).toHaveLength(2)
    expect(screen.getAllByText(/línea de crédito suficiente/)).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /Elegir 12 cuotas de Teléfono/i }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ count: 12, interestRate: 12 }))
  })

  it('renders nothing when the cart has no configured plans', () => {
    const { container } = render(
      <ProductCreditPlanPicker
        cartTotal={100_000}
        plans={[]}
        selectedPlan={null}
        onSelect={() => undefined}
        formatCurrency={amount => String(amount)}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
