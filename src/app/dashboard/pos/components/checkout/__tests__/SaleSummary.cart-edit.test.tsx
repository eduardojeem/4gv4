import React, { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SaleSummary } from '../SaleSummary'

vi.mock('../../../contexts/CheckoutContext', () => ({ useCheckout: () => ({
  discount: 0, paymentMethod: 'credit', isMixedPayment: false, paymentSplit: [],
  creditTerms: { count: 3, frequency: 'monthly', interestRate: 10, startDate: '2026-10-26', firstInstallmentTiming: 'next_cycle' },
  setCreditTerms: vi.fn(), storeCreditApplied: 0, paymentStatus: 'idle',
}) }))

function EditableSale() {
  const [cart, setCart] = useState([
    { id: 'a', name: 'Remera', price: 50000, quantity: 2 },
    { id: 'b', name: 'Pantalón', price: 200000, quantity: 1 },
  ])
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return <SaleSummary cart={cart} onRemoveItem={id => setCart(items => items.filter(item => item.id !== id))}
    cartCalculations={{ subtotal: total, subtotalAfterAllDiscounts: total, generalDiscount: 0, wholesaleDiscount: 0, wholesaleDiscountRate: 0, tax: 0, total }}
    isWholesale={false} WHOLESALE_DISCOUNT_RATE={0} formatCurrency={amount => `Gs. ${amount}`} />
}

describe('editar productos durante la revisión del cobro', () => {
  it('actualiza el precio al contado y el detalle al quitar productos sin confundirlo con el total financiado', () => {
    render(<EditableSale />)
    const cashPrice = () => within(screen.getByLabelText('Precio al contado'))
    expect(cashPrice().getByText('Gs. 300000')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Remera de la venta' }))
    expect(cashPrice().getByText('Gs. 200000')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Remera' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pantalón' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Pantalón de la venta' }))
    expect(screen.getByRole('status')).toHaveTextContent('La venta quedó vacía')
    expect(cashPrice().getByText('Gs. 0')).toBeVisible()
  })
})
