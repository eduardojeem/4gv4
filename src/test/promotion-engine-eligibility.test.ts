import { describe, expect, it } from 'vitest'
import { PromotionEngine } from '@/lib/promotion-engine'
import type { Promotion } from '@/types/promotion'

const basePromotion: Promotion = {
  id: 'promo-1',
  name: '10% productos y reparaciones',
  code: 'MIX10',
  type: 'percentage',
  value: 10,
  start_date: null,
  end_date: null,
  is_active: true,
}

const cart = [
  { product_id: 'prod-a', category_id: 'cat-1', quantity: 1, unit_price: 100_000 },
  { product_id: 'repair-1', category_id: 'service', quantity: 1, unit_price: 50_000 },
  { product_id: 'prod-b', category_id: 'cat-2', quantity: 1, unit_price: 30_000 },
]
const context = { order_total: 180_000, cart_items: cart }

describe('PromotionEngine: productos elegidos o reparaciones', () => {
  it('aplica a los productos elegidos y a las reparaciones a la vez', async () => {
    const [result] = await new PromotionEngine().evaluatePromotions(
      [{ ...basePromotion, applicable_products: ['prod-a'], applicable_categories: ['service'] }],
      context,
    )
    // 10% de (100.000 + 50.000); prod-b queda afuera
    expect(result?.discount_amount).toBe(15_000)
  })

  it('aplica solo a reparaciones cuando no hay productos elegidos', async () => {
    const [result] = await new PromotionEngine().evaluatePromotions(
      [{ ...basePromotion, applicable_categories: ['service'] }],
      context,
    )
    expect(result?.discount_amount).toBe(5_000)
  })

  it('no aplica si el carrito no tiene nada elegible', async () => {
    const results = await new PromotionEngine().evaluatePromotions(
      [{ ...basePromotion, applicable_products: ['otro'], applicable_categories: ['service'] }],
      { order_total: 30_000, cart_items: [cart[2]] },
    )
    expect(results).toHaveLength(0)
  })

  it('sin restricciones aplica a todo el carrito', async () => {
    const [result] = await new PromotionEngine().evaluatePromotions([basePromotion], context)
    expect(result?.discount_amount).toBe(18_000)
  })
})
