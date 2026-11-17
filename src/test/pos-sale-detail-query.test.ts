import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// En producción `sales` ya no tiene relación declarada con `payments`
// (PGRST200): pedirla dentro de la consulta daba 400 y el detalle de la venta
// del POS no abría.
describe('detalle de venta del POS', () => {
  const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useSales.ts'), 'utf8')
  const getSale = hook.slice(hook.indexOf('const getSale'), hook.indexOf('// Cancel sale'))

  it('no pide `payments` como relación de `sales`', () => {
    expect(getSale).not.toMatch(/^\s*payments \(\*\)/m)
    expect(getSale).toContain('sale_payments (id, payment_index')
  })

  it('las ventas viejas buscan sus pagos aparte, solo si no tienen pagos nuevos', () => {
    expect(getSale).toContain(".from('payments')")
    expect(getSale).toContain(".eq('sale_id', saleId)")
    expect(getSale).toContain('data.sale_payments.length')
  })
})
