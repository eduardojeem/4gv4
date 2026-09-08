import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/pos/process-sale/route.ts'), 'utf8')
const processor = readFileSync(resolve(process.cwd(), 'src/app/dashboard/pos/hooks/usePOSSaleProcessor.ts'), 'utf8')

describe('endurecimiento de venta POS', () => {
  it('limita el tamaño del carrito y conserva la variante validada', () => {
    expect(route).toContain('value.length > 200')
    expect(route).toContain("variant_id: variantId")
    expect(route).toContain("!UUID_PATTERN.test(variantId)")
  })

  it('no devuelve errores SQL desconocidos al navegador', () => {
    expect(route).toContain('Código: ${correlationId}')
    expect(route).not.toContain('`No se pudo registrar la venta: ${rawMessage}`')
  })

  it('usa el total confirmado por el servidor en comprobante y aviso', () => {
    expect(processor).toContain('total: Number.isFinite(Number(saleResult?.data?.total))')
    expect(processor).toContain('formatCurrency(persistedReceipt.total)')
  })
})
