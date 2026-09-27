import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { POSWorkspace } from '../POSWorkspace'
import { POSMobileCheckoutBar } from '../POSMobileCheckoutBar'

describe('POSWorkspace', () => {
  it('exposes catalog and cart landmarks and a consistent disabled checkout action', () => {
    render(
      <>
        <POSWorkspace
          catalog={<div>Productos</div>}
          cart={<div>Resumen</div>}
          statusMessage="Abrí la caja para continuar"
        />
        <POSMobileCheckoutBar
          itemCount={1}
          totalLabel="Gs. 100.000"
          eligibility={{ canOpen: true, canConfirm: false, reason: 'Abrí la caja para continuar' }}
          onOpenCart={vi.fn()}
          onCheckout={vi.fn()}
        />
      </>,
    )

    expect(screen.getByRole('region', { name: 'Catálogo' })).toBeVisible()
    expect(screen.getByRole('complementary', { name: 'Carrito' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cobrar venta' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Abrí la caja para continuar')
  })
})
