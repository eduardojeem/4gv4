import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { POSCart } from '../POSCart'
import { POSHeader } from '../POSHeader'
import { POSShortcutsBar } from '../POSShortcutsBar'
import type { CheckoutEligibility } from '../../lib/checkout-eligibility'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { role: 'cashier' }, isAdmin: false }),
}))

const closedRegister: CheckoutEligibility = {
  canOpen: true,
  canConfirm: false,
  reason: 'Abrí la caja para continuar',
}

describe('POS checkout actions', () => {
  it('shows the same disabled reason in cart and keyboard shortcut', () => {
    render(
      <>
        <POSCart
          items={[{ id: 'p-1', name: 'Producto', price: 100, quantity: 1 }]}
          onUpdateQuantity={vi.fn()} onRemoveItem={vi.fn()} onCheckout={vi.fn()} onClearCart={vi.fn()}
          isWholesale={false} onToggleWholesale={vi.fn()} discount={0} onUpdateDiscount={vi.fn()}
          subtotalApplied={100} subtotalNonWholesale={100} generalDiscountAmount={0}
          wholesaleDiscountAmount={0} totalSavings={0} cartTax={0} cartTotal={100} cartItemCount={1}
          checkoutEligibility={closedRegister}
        />
        <POSShortcutsBar
          onFocusSearch={vi.fn()} onOpenCustomer={vi.fn()} onCheckout={vi.fn()}
          onHoldSale={vi.fn()} onOpenHeldSales={vi.fn()} heldSalesCount={0}
          onToggleWholesale={vi.fn()} isWholesale={false} onClearCart={vi.fn()}
          checkoutEligibility={closedRegister} cartItemCount={1}
        />
      </>,
    )

    expect(screen.getAllByText('Abrí la caja para continuar').length).toBeGreaterThan(1)
    expect(screen.getAllByRole('button', { name: /cobrar/i }).every(button => button.hasAttribute('disabled'))).toBe(true)
    expect(screen.queryByText(/Impuesto \(/)).not.toBeInTheDocument()
  })

  it('exposes the cart trigger state semantically', () => {
    render(
      <POSHeader
        registers={[{ id: 'register-1', name: 'Caja principal' }]}
        activeRegisterId="register-1" onRegisterChange={vi.fn()} onOpenRegisterManager={vi.fn()}
        onOpenMovements={vi.fn()} isFullscreen={false} onToggleFullscreen={vi.fn()}
        onOpenCart={vi.fn()} cartItemCount={1} cartExpanded={false}
      />,
    )

    expect(screen.getByRole('button', { name: /abrir carrito/i })).toHaveAttribute('aria-expanded', 'false')
  })
})
