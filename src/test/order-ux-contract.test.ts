import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const dashboard = readFileSync(resolve(process.cwd(), 'src/components/dashboard/orders/OrdersDashboard.tsx'), 'utf8')
const checkout = readFileSync(resolve(process.cwd(), 'src/components/public/cart/CartPageClient.tsx'), 'utf8')

describe('order experience contracts', () => {
  it('refreshes incoming orders and confirms terminal actions', () => {
    expect(dashboard).toContain('ORDERS_REFRESH_INTERVAL_MS')
    expect(dashboard).toContain("nextStatus === 'DELIVERED'")
    expect(dashboard).not.toContain('window.confirm')
    expect(dashboard).toContain('Registrar cobro')
    expect(dashboard).toContain('Confirmar entrega')
    expect(dashboard).toContain('loadError ?')
  })

  it('shows collection amount, method and reconciliation reference', () => {
    expect(dashboard).toContain('Monto recibido')
    expect(dashboard).toContain('Referencia o comprobante')
    expect(dashboard).toContain('Cobrado hasta ahora')
  })

  it('uses a responsive order action layout', () => {
    expect(dashboard).toContain("'flex flex-col overflow-hidden")
    expect(dashboard).toContain('border-t sm:border-l sm:border-t-0')
  })

  it('does not call a newly submitted order confirmed', () => {
    expect(checkout).toContain('¡Pedido recibido!')
    expect(checkout).toContain('pending confirmation')
  })
})
