import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomerOrder } from '@/lib/orders/types'

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  effectiveModules: ['orders', 'delivery', 'pos'],
}))

vi.mock('@/contexts/SubscriptionStatusContext', () => ({
  useSubscriptionStatus: () => ({
    effectiveModules: mocks.effectiveModules,
  }),
}))

vi.mock('@/hooks/use-commerce-payment-controls', () => ({
  useCommercePaymentControls: () => ({
    ready: true,
    error: null,
    allows: () => true,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}))

import { EditOrderDialog } from '@/components/dashboard/orders/EditOrderDialog'
import { ShippingLabelDialog } from '@/components/dashboard/orders/ShippingLabelDialog'

function makeOrder(overrides: Partial<CustomerOrder> = {}): CustomerOrder {
  return {
    id: 'order-1',
    organization_id: 'org-1',
    branch_id: 'branch-1',
    channel: 'WEB',
    order_number: 'PED-1001',
    status: 'PENDING',
    payment_status: 'PENDING',
    payment_method: 'CASH',
    fulfillment_type: 'DELIVERY',
    customer_id: 'cust-1',
    customer_name: 'Ana Pérez',
    customer_email: 'ana@cliente.test',
    customer_phone: '0981111222',
    customer_address: 'Av. España 123',
    subtotal: 120000,
    tax_amount: 0,
    shipping_cost: 15000,
    discount_amount: 5000,
    total: 130000,
    collected_amount: 0,
    store_credit_reserved: 0,
    store_credit_applied: 0,
    amount_due: 130000,
    notes: 'Tocar timbre',
    estimated_delivery_date: null,
    delivered_at: null,
    created_at: '2026-11-10T10:00:00Z',
    updated_at: '2026-11-10T10:00:00Z',
    order_items: [
      {
        id: 'item-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        variant_name: 'M / Negro',
        product_name: 'Remera Club (M / Negro)',
        product_sku: 'REM-M',
        quantity: 2,
        unit_price: 60000,
        subtotal: 120000,
      },
    ],
    ...overrides,
  }
}

describe('EditOrderDialog & ShippingLabelDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.effectiveModules = ['orders', 'delivery', 'pos']
  })

  it('allows editing unlocked orders including financial fields and sends PUT payload', async () => {
    const order = makeOrder()
    const updatedOrder = makeOrder({ customer_name: 'Ana Editada', discount_amount: 10000, total: 125000 })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: updatedOrder }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const onUpdated = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <EditOrderDialog order={order} open onOpenChange={onOpenChange} onUpdated={onUpdated} />
    )

    expect(screen.queryByText('Importes bloqueados')).not.toBeInTheDocument()

    const nameInput = screen.getByLabelText(/Nombre/i) as HTMLInputElement
    const discountInput = screen.getByLabelText(/Descuento/i) as HTMLInputElement
    expect(discountInput).not.toBeDisabled()

    fireEvent.change(nameInput, { target: { value: 'Ana Editada' } })
    fireEvent.change(discountInput, { target: { value: '10000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/orders/order-1')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toMatchObject({
      customer_name: 'Ana Editada',
      shipping_cost: 15000,
      discount_amount: 10000,
    })
    expect(onUpdated).toHaveBeenCalledWith(updatedOrder)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('locks monetary inputs on paid orders and omits shipping_cost/discount_amount from PUT', async () => {
    const paidOrder = makeOrder({ payment_status: 'PAID', amount_due: 0, collected_amount: 130000 })
    const updatedOrder = makeOrder({ payment_status: 'PAID', notes: 'Entregar en portería' })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: updatedOrder }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const onUpdated = vi.fn()

    render(
      <EditOrderDialog order={paidOrder} open onOpenChange={vi.fn()} onUpdated={onUpdated} />
    )

    expect(screen.getByText('Importes bloqueados')).toBeInTheDocument()
    expect(screen.getByLabelText(/Costo de envío/i)).toBeDisabled()
    expect(screen.getByLabelText(/Descuento/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /Retiro/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Notas/i), { target: { value: 'Entregar en portería' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body))
    expect(body).not.toHaveProperty('shipping_cost')
    expect(body).not.toHaveProperty('discount_amount')
    expect(body.notes).toBe('Entregar en portería')
  })

  it('renders single and bulk shipping labels with deduplicated variants, branch names and scoped print CSS', () => {
    const order1 = makeOrder({ id: 'o1', order_number: 'PED-1001', branch_id: 'branch-1' })
    const order2 = makeOrder({ id: 'o2', order_number: 'PED-1002', fulfillment_type: 'PICKUP', branch_id: 'branch-2' })

    const { rerender, baseElement } = render(
      <ShippingLabelDialog
        order={order1}
        open
        onOpenChange={vi.fn()}
        storeName="MiTienda Demo"
        branchNamesById={{ 'branch-1': 'Casa Central', 'branch-2': 'Sucursal Norte' }}
      />
    )

    expect(screen.getByText('Rótulo de despacho y envío #PED-1001')).toBeInTheDocument()
    expect(screen.getByText('Casa Central')).toBeInTheDocument()
    expect(screen.getByText('Remera Club')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('Negro')).toBeInTheDocument()
    expect(baseElement.querySelectorAll('.printable-shipping-container')).toHaveLength(1)
    expect(baseElement.innerHTML).toContain('.printable-shipping-bundle')

    rerender(
      <ShippingLabelDialog
        orders={[order1, order2]}
        open
        onOpenChange={vi.fn()}
        storeName="MiTienda Demo"
        branchNamesById={{ 'branch-1': 'Casa Central', 'branch-2': 'Sucursal Norte' }}
      />
    )

    expect(screen.getByText('Rótulos de despacho (2 pedidos)')).toBeInTheDocument()
    expect(screen.getByText('Imprimir 2 rótulos')).toBeInTheDocument()
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument()
    expect(baseElement.querySelectorAll('.printable-shipping-container')).toHaveLength(2)

    // Cuando open=false, no inyecta estilos @media print globales
    rerender(
      <ShippingLabelDialog
        orders={[order1, order2]}
        open={false}
        onOpenChange={vi.fn()}
        storeName="MiTienda Demo"
      />
    )
    expect(baseElement.innerHTML).not.toContain('.printable-shipping-bundle')
  })
})
