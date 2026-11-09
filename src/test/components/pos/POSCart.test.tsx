import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POSCart } from '@/app/dashboard/pos/components/POSCart'

const handlers = {
  onUpdateQuantity: vi.fn(), onRemoveItem: vi.fn(), onCheckout: vi.fn(),
  onClearCart: vi.fn(), onToggleWholesale: vi.fn(), onUpdateDiscount: vi.fn(),
}
const baseProps = {
  items: [], ...handlers, isWholesale: false, discount: 0, subtotalApplied: 0,
  subtotalNonWholesale: 0, generalDiscountAmount: 0, wholesaleDiscountAmount: 0,
  totalSavings: 0, cartTax: 0, cartTotal: 0, cartItemCount: 0,
  checkoutEligibility: { canOpen: true, canConfirm: true },
}

describe('POSCart current component contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the empty state and repair shortcut', () => {
    const onOpenRepairModal = vi.fn()
    render(<POSCart {...baseProps} onOpenRepairModal={onOpenRepairModal} />)
    expect(screen.getByText('Carrito vacío')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cobrar una reparación/i }))
    expect(onOpenRepairModal).toHaveBeenCalledOnce()
  })

  it('renders items and sends quantity changes with the cart id', () => {
    render(<POSCart {...baseProps}
      items={[{ id: 'cart-1', name: 'Remera', sku: 'REM-1', price: 100_000, quantity: 2, stock: 8 }]}
      subtotalApplied={200_000} subtotalNonWholesale={200_000} cartTotal={200_000} cartItemCount={2}
    />)
    expect(screen.getByText('Remera')).toBeInTheDocument()
    const quantity = screen.getByRole('spinbutton')
    fireEvent.change(quantity, { target: { value: '3' } })
    fireEvent.blur(quantity)
    expect(handlers.onUpdateQuantity).toHaveBeenCalledWith('cart-1', 3)
  })

  it('removes an item through its accessible delete action', () => {
    render(<POSCart {...baseProps}
      items={[{ id: 'cart-1', name: 'Short', price: 75_000, quantity: 1, stock: 5 }]}
      subtotalApplied={75_000} subtotalNonWholesale={75_000} cartTotal={75_000} cartItemCount={1}
    />)
    fireEvent.click(screen.getByRole('button', { name: /eliminar short/i }))
    expect(handlers.onRemoveItem).toHaveBeenCalledWith('cart-1')
  })

  it('blocks checkout when the caller reports an invalid sale', () => {
    render(<POSCart {...baseProps}
      items={[{ id: 'cart-1', name: 'Producto', price: 50_000, quantity: 1 }]}
      subtotalApplied={50_000} subtotalNonWholesale={50_000} cartTotal={50_000} cartItemCount={1}
      checkoutEligibility={{ canOpen: true, canConfirm: false, reason: 'Seleccioná una caja abierta' }}
    />)
    expect(screen.getByRole('button', { name: /cobrar ahora/i })).toBeDisabled()
    expect(screen.getByText('Seleccioná una caja abierta')).toBeInTheDocument()
  })

  it('opens checkout when the sale is valid', () => {
    render(<POSCart {...baseProps}
      items={[{ id: 'cart-1', name: 'Producto', price: 50_000, quantity: 1 }]}
      subtotalApplied={50_000} subtotalNonWholesale={50_000} cartTotal={50_000} cartItemCount={1}
    />)
    fireEvent.click(screen.getByRole('button', { name: /cobrar ahora/i }))
    expect(handlers.onCheckout).toHaveBeenCalledOnce()
  })
})

describe('cash register primary action', () => {
 it('offers opening the register without triggering checkout', () => {
  const open = vi.fn()
  render(<POSCart {...baseProps} items={[{id:'s',name:'Corte',price:50000,quantity:1,isService:true}]} cartItemCount={1} cashRegisterClosed onOpenCash={open} checkoutEligibility={{canOpen:true,canConfirm:false,reason:'Abrí la caja para continuar'}} />)
  const action = screen.getByRole('button',{name:'Abrir caja para cobrar'})
  expect(action).toBeEnabled()
  fireEvent.click(action)
  expect(open).toHaveBeenCalledOnce()
  expect(handlers.onCheckout).not.toHaveBeenCalled()
 })
})

describe('cart scrolling boundaries', () => {
 it('keeps the primary action outside the scrolling items and pricing area', () => {
  render(<POSCart {...baseProps} items={[{id:'s',name:'Corte',price:50000,quantity:1,isService:true}]} cartItemCount={1} />)
  const details = screen.getByRole('region', {name:'Detalle del carrito y ajustes'})
  expect(details).toContainElement(screen.getByText('Corte'))
  expect(details).not.toContainElement(screen.getByRole('button', {name:'Cobrar ahora'}))
 })
})
