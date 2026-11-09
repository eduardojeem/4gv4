import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  costIntentWithPurchase,
  partArrivedMessage,
  partPurchaseSchema,
  purchaseConcept,
  purchaseExpenseMarker,
  readWaitingPart,
  suggestedPartPrice,
} from '@/lib/repairs/part-purchase'

const base = {
  idempotencyKey: 'part-purchase-abc12345',
  name: 'Pantalla Samsung A05',
  quantity: 1,
  unitCost: 180000,
  unitPrice: 250000,
  supplier: 'Distribuidora X',
  payment: 'cash' as const,
  arrived: true,
}

describe('«No lo tengo, lo compro»', () => {
  it('no deja cobrar menos de lo que costó el repuesto', () => {
    expect(partPurchaseSchema.safeParse(base).success).toBe(true)
    const below = partPurchaseSchema.safeParse({ ...base, unitPrice: 100000 })
    expect(below.success).toBe(false)
    expect(below.error?.issues[0]).toMatchObject({ path: ['unitPrice'] })
  })

  it('agrega el repuesto a lo que la reparación ya tenía, sin tocarlo', () => {
    const intent = costIntentWithPurchase({
      labor_cost: 100000,
      discount_amount: 0,
      parts: [{ part_name: 'Mano de obra pantalla', quantity: 1, unit_price: 80000, unit_cost: 0, line_type: 'service', tax_rate: 10 }],
    }, partPurchaseSchema.parse(base))
    expect(intent.laborAmount).toBe(100000)
    expect(intent.idempotencyKey).toBe('part-purchase-abc12345:costs')
    expect(intent.parts).toHaveLength(2)
    expect(intent.parts[0]).toMatchObject({ name: 'Mano de obra pantalla', lineType: 'service', taxRate: 10, unitPrice: 80000 })
    expect(intent.parts[1]).toMatchObject({ name: 'Pantalla Samsung A05', unitCost: 180000, unitPrice: 250000, supplier: 'Distribuidora X', lineType: 'charged_part', productId: null })
  })

  it('el gasto se reconoce en Finanzas por su concepto y su marca', () => {
    expect(purchaseConcept({ name: 'Batería', quantity: 2 }, 'R-1042')).toBe('Repuesto: 2 × Batería · Reparación R-1042')
    expect(purchaseExpenseMarker('part-purchase-abc12345')).toBe('repair-part-purchase:part-purchase-abc12345')
  })

  it('sugiere el precio con 40% sobre el costo, redondeado a mil', () => {
    expect(suggestedPartPrice(180000)).toBe(252000)
    expect(suggestedPartPrice(0)).toBe(0)
  })

  it('lee el repuesto que se espera; sin datos válidos no hay espera', () => {
    expect(readWaitingPart({ waiting_part: { name: 'Pantalla', supplier: 'X', expected_on: '2026-10-16', ordered_at: '2026-10-13T12:00:00Z' } }))
      .toEqual({ name: 'Pantalla', supplier: 'X', expected_on: '2026-10-16', ordered_at: '2026-10-13T12:00:00Z' })
    expect(readWaitingPart({})).toBeNull()
    expect(readWaitingPart(null)).toBeNull()
    expect(readWaitingPart({ waiting_part: { supplier: 'X' } })).toBeNull()
  })

  it('el aviso al cliente usa su primer nombre', () => {
    expect(partArrivedMessage('Ana Pérez', 'Pantalla', 'Samsung A05')).toBe(
      'Hola Ana, te avisamos que ya llegó el repuesto (Pantalla) para tu Samsung A05. Seguimos con la reparación y te avisamos cuando esté listo.',
    )
  })

  it('la ruta revisa la caja antes de escribir y no duplica el gasto al reintentar', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/repairs/[id]/part-purchase/route.ts'), 'utf8')
    expect(route.indexOf("code: 'REPAIR_CASH_REGISTER_NOT_OPEN'")).toBeLessThan(route.indexOf('await saveRepairCostRevision('))
    expect(route).toContain(".eq('notes', marker)")
    expect(route).toContain("p_idempotency_key: `${input.idempotencyKey}:pay`")
    expect(route).toContain("from('repair_status_history').insert")
  })
})
