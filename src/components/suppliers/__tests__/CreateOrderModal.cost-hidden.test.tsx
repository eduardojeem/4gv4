import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useActiveOrganization: () => ({ organization: { id: 'org-test' } }) }))

// Sin permiso de costos, get_product_costs no devuelve el costo del producto propio.
const rows = [{ id: 'own-1', name: 'Pantalla', sku: 'PAN-1', stock_quantity: 1, min_stock: 2, image_url: null, images: [] }]
const query = (data: unknown) => {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'in', 'limit']) builder[method] = vi.fn(() => builder)
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve)
  return builder
}
const client = {
  from: vi.fn((table: string) => query(table === 'products' ? rows : [])),
  rpc: vi.fn(async () => ({ data: [], error: null })),
}
vi.mock('@/lib/supabase/client', () => ({ createClient: () => client }))

import { CreateOrderModal } from '../CreateOrderModal'

describe('CreateOrderModal sin permiso de costos', () => {
  it('no ofrece un costo de 0 ni deja crear el pedido', async () => {
    render(
      <CreateOrderModal
        isOpen
        onClose={() => {}}
        supplierId="sup-1"
        supplierName="Proveedor"
        onOrderCreated={() => {}}
        initialProduct={{ id: 'own-1', name: 'Pantalla', suppliersku: 'PAN-1', unitprice: 0, currency: 'PYG', source: 'own', costHidden: true }}
      />,
    )
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('get_product_costs', { p_product_ids: ['own-1'], p_organization_id: 'org-test' }))
    expect(await screen.findByText(/no puede ver el costo de un producto/i)).toBeInTheDocument()
    expect(screen.getByText('Costo no visible para tu usuario')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear pedido/i })).toBeDisabled()
    expect(screen.getAllByText('Costo no visible').length).toBeGreaterThan(0)
  })
})
