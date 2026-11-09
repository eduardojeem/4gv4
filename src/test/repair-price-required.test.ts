import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deliveryPricePatch, repairHasDefinedPrice, uiRepairHasDefinedPrice } from '@/lib/repairs/price-required'

describe('una reparación tiene precio', () => {
  it('con precio final (aunque sea 0, sin cargo), presupuesto, mano de obra o repuestos cobrados', () => {
    expect(repairHasDefinedPrice({ final_cost: 0 })).toBe(true)
    expect(repairHasDefinedPrice({ final_cost: null, estimated_cost: 150000 })).toBe(true)
    expect(repairHasDefinedPrice({ final_cost: null, labor_cost: 80000 })).toBe(true)
    expect(repairHasDefinedPrice({ final_cost: null, parts: [{ unit_price: 50000, quantity: 1 }] })).toBe(true)
  })

  it('sin nada de eso no tiene: así quedaban las 70 entregadas en ₲ 0', () => {
    expect(repairHasDefinedPrice({ final_cost: null, estimated_cost: 0, labor_cost: 0, parts: [] })).toBe(false)
    expect(repairHasDefinedPrice({ final_cost: null, parts: [{ unit_price: 50000, quantity: 0 }] })).toBe(false)
  })

  it('la pantalla usa la misma regla', () => {
    expect(uiRepairHasDefinedPrice({ finalCost: null, estimatedCost: 0, laborCost: 0, parts: [{ cost: 30000, quantity: 2 }] })).toBe(true)
    expect(uiRepairHasDefinedPrice({ finalCost: null, estimatedCost: 0, laborCost: 0, parts: [] })).toBe(false)
  })

  it('el precio que fija la entrega es un presupuesto; sin cargo lleva su motivo', () => {
    expect(deliveryPricePatch(350000.4, false)).toEqual({ pricingMode: 'budget', finalCost: 350000 })
    expect(deliveryPricePatch(999, true)).toEqual({ pricingMode: 'budget', finalCost: 0, priceOverrideReason: 'Sin cargo: garantía o cortesía' })
  })

  it('el servidor no deja entregar reparado sin precio', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/repairs/[id]/delivery/route.ts'), 'utf8')
    expect(route).toContain('if (!repairHasDefinedPrice(currentRepair))')
    expect(route).toContain("code: 'REPAIR_PRICE_REQUIRED'")
    // Solo en la entrega «reparado»: retirado o irreparable tienen su propio cierre.
    expect(route.indexOf('if (!repairHasDefinedPrice(currentRepair))')).toBeGreaterThan(route.indexOf('if (unrepaired) {'))
  })
})
