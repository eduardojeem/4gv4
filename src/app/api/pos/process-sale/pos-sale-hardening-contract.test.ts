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

  it('valida el control técnico antes de cobrar y entregar una reparación', () => {
    const validationAt = route.indexOf('validateDeliveryQualityCheck')
    const saleAt = route.indexOf("supabase.rpc('process_pos_sale_atomic_v5'")

    expect(validationAt).toBeGreaterThan(-1)
    expect(validationAt).toBeLessThan(saleAt)
    expect(route).toContain('REPAIR_QUALITY_CHECK_REQUIRED')
  })

  it('rechaza una reparación cuyo cliente no coincide antes de invocar el RPC', () => {
    const customerValidationAt = route.indexOf("code: 'REPAIR_CUSTOMER_MISMATCH'")
    const saleAt = route.indexOf("supabase.rpc('process_pos_sale_atomic_v5'")

    expect(customerValidationAt).toBeGreaterThan(-1)
    expect(customerValidationAt).toBeLessThan(saleAt)
    expect(route).toContain("repair.customer_id !== customerId")
    expect(route).toContain(".select('id, customer_id, status, qualityCheck:")
  })
})
