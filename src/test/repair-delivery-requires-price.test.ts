import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deliveryPricePatch, repairHasDefinedPrice } from '@/lib/repairs/price-required'

const root = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

/** Una reparación no se entrega como «reparada» sin precio: Finanzas la contaría en ₲ 0. */
describe('entrega de una reparación sin precio', () => {
  const migration = read('supabase/migrations/20261120090000_repair_delivery_requires_price.sql')

  it('la base la frena aunque el cambio de estado venga directo a la tabla', () => {
    expect(migration).toContain('create or replace function public.capture_pos_repair_payment()')
    expect(migration).toContain("raise exception 'REPAIR_PRICE_REQUIRED'")
    // Mantiene las validaciones que ya tenía el trigger.
    expect(migration).toContain("raise exception 'REPAIR_DELIVERY_INVALID_STATE'")
    expect(migration).toContain("raise exception 'REPAIR_DELIVERY_OUTCOME_INVALID'")
    expect(migration).toContain('new.warranty_expires_at := case')
  })

  it('usa la misma regla que la API: precio final, presupuesto, mano de obra o repuesto cobrado', () => {
    expect(migration).toContain("new.delivery_outcome = 'repaired'")
    expect(migration).toContain('new.final_cost is null')
    expect(migration).toContain('coalesce(new.estimated_cost, 0) <= 0')
    expect(migration).toContain('coalesce(new.labor_cost, 0) <= 0')
    expect(migration).toContain('from public.repair_parts part')
    expect(repairHasDefinedPrice({ final_cost: 0 })).toBe(true)
    expect(repairHasDefinedPrice({ final_cost: null, estimated_cost: 0, labor_cost: 0, parts: [] })).toBe(false)
  })

  it('no toca la RLS ni los permisos', () => {
    expect(migration).not.toMatch(/\b(policy|grant|revoke)\b/i)
  })

  it('el error de la base llega con el mismo mensaje que la API', () => {
    const rpc = read('src/lib/repairs/financial-closure-rpc.ts')
    expect(rpc).toContain('REPAIR_PRICE_REQUIRED: 409')
    expect(rpc).toContain('REPAIR_PRICE_REQUIRED: REPAIR_PRICE_REQUIRED_MESSAGE')
  })

  it('la app pide el precio o «Sin cargo» antes de entregar, y lo guarda primero', () => {
    const sheet = read('mobile/src/components/delivery-sheet.tsx')
    expect(sheet).toContain("const needsPrice = outcome === 'repaired' && !repairHasDefinedPrice(repair)")
    expect(sheet).toContain('Sin cargo (garantía o cortesía)')
    expect(sheet).toContain("return 'Escribí cuánto cobraste o marcá «Sin cargo».'")
    const priceSaved = sheet.indexOf('if (needsPrice) await defineRepairDeliveryPrice(')
    const delivered = sheet.indexOf('updated = await deliverRepair(\n          repair.id,')
    expect(priceSaved).toBeGreaterThan(-1)
    expect(priceSaved).toBeLessThan(delivered)
    expect(read('mobile/src/lib/repairs.ts')).toContain('JSON.stringify(deliveryPricePatch(amount, noCharge))')
    expect(deliveryPricePatch(0, true)).toMatchObject({ finalCost: 0, priceOverrideReason: 'Sin cargo: garantía o cortesía' })
  })
})
