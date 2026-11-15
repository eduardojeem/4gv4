import { describe, expect, it } from 'vitest'
import { priceWithServicePromotion, servicePromotionLabel, servicePromotionsByService } from '@/lib/public/service-promotions'

const NOW = new Date('2026-11-15T12:00:00Z')
const CORTE = '11111111-1111-4111-8111-111111111111'
const BARBA = '22222222-2222-4222-8222-222222222222'
const base = { is_active: true, usage_count: 0, usage_limit: null, start_date: '2026-11-01T00:00:00Z', end_date: '2026-12-01T00:00:00Z', min_purchase: 0, max_discount: null, applicable_categories: [], description: null }

describe('promociones de servicios para la agenda pública', () => {
  it('solo anuncia en cada servicio las promos que lo nombran y muestra el código si es canjeable', () => {
    const rows = [
      { ...base, id: 'p1', code: 'COMBO20', name: 'Combo 20%', type: 'percentage', value: 20, public_mode: 'coupon', applicable_products: [CORTE], description: ' Reservando online ' },
      { ...base, id: 'p2', code: 'AUTO10', name: 'Martes 10%', type: 'percentage', value: 10, public_mode: 'automatic', applicable_products: [CORTE, BARBA] },
      // Interna del POS: no se anuncia.
      { ...base, id: 'p3', code: 'EMPLEADO', name: 'Personal', type: 'percentage', value: 50, public_mode: 'disabled', applicable_products: [CORTE] },
      // General o «para reparaciones»: no se promete en cada servicio.
      { ...base, id: 'p4', code: 'TODO5', name: 'General', type: 'percentage', value: 5, public_mode: 'coupon', applicable_products: [] },
      { ...base, id: 'p5', code: 'REPA', name: 'Reparaciones', type: 'percentage', value: 15, public_mode: 'coupon', applicable_products: [], applicable_categories: ['service'] },
      // Vencida o agotada.
      { ...base, id: 'p6', code: 'VIEJA', name: 'Vieja', type: 'percentage', value: 30, public_mode: 'coupon', applicable_products: [CORTE], end_date: '2026-11-10T00:00:00Z' },
      { ...base, id: 'p7', code: 'AGOTADA', name: 'Agotada', type: 'percentage', value: 30, public_mode: 'coupon', applicable_products: [CORTE], usage_count: 5, usage_limit: 5 },
    ]
    const result = servicePromotionsByService(rows, [CORTE, BARBA], NOW)
    expect(result[CORTE].map((p) => [p.id, p.code])).toEqual([['p1', 'COMBO20'], ['p2', null]])
    expect(result[CORTE][0].description).toBe('Reservando online')
    expect(result[BARBA].map((p) => p.id)).toEqual(['p2'])
    // La respuesta pública no expone usos ni límites.
    expect(Object.keys(result[CORTE][0])).not.toContain('usage_count')
  })

  it('ignora servicios que no se reservan online', () => {
    const rows = [{ ...base, id: 'p1', code: 'X', name: 'X', type: 'fixed', value: 10000, public_mode: 'coupon', applicable_products: ['otro'] }]
    expect(servicePromotionsByService(rows, [CORTE], NOW)).toEqual({})
  })

  it('calcula el precio estimado con tope y mínimo', () => {
    const promo = { id: 'p', name: 'p', description: null, code: null, type: 'percentage' as const, value: 20, maxDiscount: 10000, minPurchase: null, endsAt: null }
    expect(priceWithServicePromotion(80000, promo)).toBe(70000)
    expect(priceWithServicePromotion(80000, { ...promo, maxDiscount: null })).toBe(64000)
    expect(priceWithServicePromotion(80000, { ...promo, minPurchase: 100000 })).toBeNull()
    expect(priceWithServicePromotion(null, promo)).toBeNull()
    expect(priceWithServicePromotion(5000, { ...promo, type: 'fixed', value: 20000, maxDiscount: null })).toBe(0)
    expect(servicePromotionLabel({ type: 'fixed', value: 20000 }, (v) => `Gs. ${v}`)).toBe('Gs. 20000 OFF')
    expect(servicePromotionLabel({ type: 'percentage', value: 20 }, String)).toBe('20% OFF')
  })
})
