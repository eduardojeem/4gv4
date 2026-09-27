import { describe, expect, it } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { ProductCreditDefaults } from '@/types/website-settings'
import {
  buildCreditPlanPreview,
  buildCreditPlanPreviews,
  resolveCreditBase,
  toProductInstallmentPlans,
} from '@/lib/credits/product-credit-defaults'

const baseDefaults = getWebsiteSettingsDefaults().product_credit_defaults!

function defaults(overrides: Partial<ProductCreditDefaults> = {}): ProductCreditDefaults {
  return { ...baseDefaults, ...overrides }
}

const product = {
  purchase_price: 600_000,
  sale_price: 1_000_000,
  offer_price: 800_000,
  has_offer: true,
}

describe('resolveCreditBase', () => {
  it('usa el precio de venta cuando la base es "sale" y no hay oferta', () => {
    const result = resolveCreditBase({ ...product, has_offer: false }, defaults({ calculationBase: 'sale' }))

    expect(result.baseAmount).toBe(1_000_000)
    expect(result.source).toBe('sale')
  })

  it('usa el precio de oferta cuando respectOffer está activo', () => {
    const result = resolveCreditBase(product, defaults({ calculationBase: 'sale', respectOffer: true }))

    expect(result.baseAmount).toBe(800_000)
    expect(result.source).toBe('offer')
  })

  it('ignora la oferta cuando respectOffer está apagado', () => {
    const result = resolveCreditBase(product, defaults({ calculationBase: 'sale', respectOffer: false }))

    expect(result.baseAmount).toBe(1_000_000)
    expect(result.source).toBe('sale')
  })

  it('descarta una oferta que no rebaja: no puede subir el precio', () => {
    const result = resolveCreditBase(
      { ...product, offer_price: 1_200_000 },
      defaults({ calculationBase: 'sale', respectOffer: true }),
    )

    expect(result.baseAmount).toBe(1_000_000)
    expect(result.source).toBe('sale')
  })

  it('usa el precio de costo cuando la base es "cost"', () => {
    const result = resolveCreditBase(product, defaults({ calculationBase: 'cost' }))

    expect(result.baseAmount).toBe(600_000)
    expect(result.source).toBe('cost')
  })

  it('aplica el margen sobre el costo', () => {
    const result = resolveCreditBase(product, defaults({ calculationBase: 'cost', costMarkupPercent: 25 }))

    expect(result.baseAmount).toBe(750_000)
    expect(result.source).toBe('cost')
  })

  it('la base "cost" ignora la oferta aunque respectOffer esté activo', () => {
    const result = resolveCreditBase(product, defaults({ calculationBase: 'cost', respectOffer: true }))

    expect(result.baseAmount).toBe(600_000)
  })

  it('descuenta la entrega inicial de lo que se financia', () => {
    const result = resolveCreditBase(
      { ...product, has_offer: false },
      defaults({ calculationBase: 'sale', downPaymentPercent: 30 }),
    )

    expect(result.baseAmount).toBe(1_000_000)
    expect(result.downPayment).toBe(300_000)
    expect(result.financedAmount).toBe(700_000)
  })

  it('no rompe con precios faltantes o negativos', () => {
    const result = resolveCreditBase(
      { purchase_price: null, sale_price: -5, offer_price: undefined, has_offer: true },
      defaults(),
    )

    expect(result.baseAmount).toBe(0)
    expect(result.financedAmount).toBe(0)
  })
})

describe('buildCreditPlanPreview', () => {
  it('divide sin recargo en cuotas iguales', () => {
    const base = resolveCreditBase({ ...product, has_offer: false }, defaults({ calculationBase: 'sale' }))
    const preview = buildCreditPlanPreview({ count: 4, rate: 0 }, base, 'monthly')

    expect(preview.installmentAmount).toBe(250_000)
    expect(preview.financedTotal).toBe(1_000_000)
  })

  it('aplica el recargo sobre el monto financiado', () => {
    const base = resolveCreditBase({ ...product, has_offer: false }, defaults({ calculationBase: 'sale' }))
    const preview = buildCreditPlanPreview({ count: 10, rate: 20 }, base, 'monthly')

    // 1.000.000 + 20% = 1.200.000 en 10 cuotas
    expect(preview.financedTotal).toBe(1_200_000)
    expect(preview.installmentAmount).toBe(120_000)
  })

  it('el total incluye la entrega inicial, la cuota no', () => {
    const base = resolveCreditBase(
      { ...product, has_offer: false },
      defaults({ calculationBase: 'sale', downPaymentPercent: 20 }),
    )
    const preview = buildCreditPlanPreview({ count: 4, rate: 0 }, base, 'monthly')

    expect(base.downPayment).toBe(200_000)
    expect(preview.installmentAmount).toBe(200_000) // 800.000 / 4
    expect(preview.financedTotal).toBe(800_000)
    expect(preview.totalWithDownPayment).toBe(1_000_000)
  })

  it('cambiar la base de venta a costo cambia la cuota', () => {
    const saleBase = resolveCreditBase({ ...product, has_offer: false }, defaults({ calculationBase: 'sale' }))
    const costBase = resolveCreditBase(product, defaults({ calculationBase: 'cost' }))

    const salePlan = buildCreditPlanPreview({ count: 6, rate: 0 }, saleBase, 'monthly')
    const costPlan = buildCreditPlanPreview({ count: 6, rate: 0 }, costBase, 'monthly')

    expect(salePlan.installmentAmount).toBeGreaterThan(costPlan.installmentAmount)
  })
})

describe('buildCreditPlanPreviews', () => {
  it('devuelve un preview por plan, ordenados por cantidad de cuotas', () => {
    const { previews, base } = buildCreditPlanPreviews(
      { ...product, has_offer: false },
      defaults({ plans: [{ count: 12, rate: 20 }, { count: 3, rate: 0 }, { count: 6, rate: 10 }] }),
    )

    expect(base.baseAmount).toBe(1_000_000)
    expect(previews.map((p) => p.count)).toEqual([3, 6, 12])
  })

  it('sin planes configurados devuelve una lista vacía, no un error', () => {
    const { previews } = buildCreditPlanPreviews(product, defaults({ plans: [] }))
    expect(previews).toEqual([])
  })
})

describe('toProductInstallmentPlans', () => {
  it('exporta los planes en el formato que guarda el producto', () => {
    const plans = toProductInstallmentPlans(
      defaults({ plans: [{ count: 6, rate: 10 }, { count: 3, rate: 0 }] }),
    )

    expect(plans).toEqual([{ count: 3, rate: 0 }, { count: 6, rate: 10 }])
  })
})
