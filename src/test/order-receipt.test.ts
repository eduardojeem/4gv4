import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateOrderReceiptHTML, orderReceiptPageSize } from '@/lib/orders/order-receipt'
import type { CustomerOrder } from '@/lib/orders/types'

const order = {
  id: '11111111-2222-4333-8444-555555555555', organization_id: 'org', branch_id: null, channel: 'WEB', customer_id: null,
  order_number: 'PED-0042', status: 'CONFIRMED', payment_status: 'PARTIAL', payment_method: 'TRANSFER', fulfillment_type: 'DELIVERY',
  customer_name: 'Ana <b>Pérez</b>', customer_email: 'ana@example.test', customer_phone: '0981 123 456', customer_address: 'Av. España 123',
  subtotal: 150000, tax_amount: 0, shipping_cost: 20000, discount_amount: 10000, total: 160000,
  store_credit_reserved: 0, store_credit_applied: 0, collected_amount: 60000, amount_due: 100000,
  notes: 'Tocar timbre', created_at: '2026-11-17T15:00:00Z', updated_at: '2026-11-17T15:00:00Z',
  estimated_delivery_date: null, delivered_at: null, cancelled_at: null, stock_reserved: false,
  order_items: [
    { id: 'i1', product_id: 'p1', variant_id: null, variant_name: 'Rojo', product_name: 'Remera', product_sku: 'REM-01', quantity: 2, unit_price: 50000, subtotal: 100000 },
    { id: 'i2', product_id: 'p2', variant_id: null, variant_name: null, product_name: 'Gorra', product_sku: null, quantity: 1, unit_price: 50000, subtotal: 50000 },
  ],
} as unknown as CustomerOrder

const company = { name: 'Tienda Demo', phone: '021 555 000', address: 'Asunción' }

describe('comprobante del pedido', () => {
  it('trae número, cliente, productos, totales, envío, descuento y saldo pendiente', () => {
    const html = generateOrderReceiptHTML(order, company, '80mm')
    expect(html).toContain('PEDIDO PED-0042')
    expect(html).toContain('Remera')
    expect(html).toContain('(Rojo)')
    expect(html).toContain('SKU REM-01')
    expect(html).toContain('Envío a domicilio')
    expect(html).toContain('Entrega: Av. España 123')
    expect(html).toContain('Descuento')
    expect(html).toContain('Gs. 160.000')
    expect(html).toContain('Saldo pendiente')
    expect(html).toContain('Gs. 100.000')
    expect(html).toContain('Transferencia · Pago parcial')
    expect(html).toContain('Tocar timbre')
  })

  it('escapa lo que escribe el cliente', () => {
    const html = generateOrderReceiptHTML(order, company, '80mm')
    expect(html).toContain('Ana &lt;b&gt;Pérez&lt;/b&gt;')
    expect(html).not.toContain('<b>Pérez</b>')
  })

  it('cada papel tiene su ancho; A4 usa tabla con encabezados', () => {
    expect(generateOrderReceiptHTML(order, company, '58mm')).toContain('width:54mm')
    expect(generateOrderReceiptHTML(order, company, 'A4')).toContain('<th class="num">Cant.</th>')
    expect(orderReceiptPageSize('58mm')).toEqual({ width: 164 })
    expect(orderReceiptPageSize('A4')).toEqual({ width: 595, height: 842 })
  })

  it('un pedido pagado no muestra saldo', () => {
    const paid = { ...order, payment_status: 'PAID', amount_due: 0 } as CustomerOrder
    expect(generateOrderReceiptHTML(paid, company, '80mm')).not.toContain('Saldo pendiente')
  })
})

const mocks = vi.hoisted(() => ({ order: null as unknown, from: vi.fn() }))
vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_options: unknown, handler: (request: Request, context: unknown, route: unknown) => unknown) =>
    (request: Request, route: unknown) => handler(request, { organization: { id: 'org' } }, route),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      mocks.from(table)
      const q: Record<string, unknown> = {}
      for (const key of ['select', 'eq']) q[key] = () => q
      q.maybeSingle = async () => ({ data: table === 'customer_orders' ? mocks.order : null, error: null })
      q.single = async () => ({ data: { name: 'Tienda Demo', logo_url: null }, error: null })
      return q
    },
  }),
}))

describe('API del comprobante del pedido', () => {
  beforeEach(() => { mocks.order = { ...order, order_items: order.order_items }; mocks.from.mockClear() })
  const get = async (query = '') => {
    const { GET } = await import('@/app/api/orders/[id]/receipt/route')
    return (GET as unknown as (request: Request, route: unknown) => Promise<Response>)(
      new Request(`http://localhost/api/orders/${order.id}/receipt${query}`),
      { params: Promise.resolve({ id: order.id }) },
    )
  }

  it('devuelve el html y el tamaño del papel (80 mm por defecto)', async () => {
    const response = await get()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ paper: '80mm', width: 227 })
    expect(body.html).toContain('PEDIDO PED-0042')
    expect(response.headers.get('Cache-Control')).toContain('no-store')
  })

  it('respeta el papel pedido y rechaza uno inventado', async () => {
    expect((await (await get('?paper=A4')).json()).paper).toBe('A4')
    expect((await get('?paper=carta')).status).toBe(400)
  })

  it('un pedido de otro comercio no se encuentra', async () => {
    mocks.order = null
    expect((await get()).status).toBe(404)
  })
})

describe('pantallas', () => {
  const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')
  it('la web imprime el comprobante en vez de la pantalla', () => {
    const dashboard = read('src/components/dashboard/orders/OrdersDashboard.tsx')
    expect(dashboard).toContain('<OrderReceiptPrintButton orderId={order.id} />')
    expect(dashboard).not.toContain('Imprimir detalle')
  })
  it('la app ofrece imprimir, PDF y WhatsApp en el detalle del pedido', () => {
    expect(read('mobile/src/app/panel/orders/[id].tsx')).toContain("path={'/api/orders/' + encodeURIComponent(order.id) + '/receipt'}")
  })
})
