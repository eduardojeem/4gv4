import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildPublicOrderRequest } from '@/components/public/cart/checkout-contract'
import { matchDeliveryZone } from '@/lib/checkout/delivery-zone'

describe('public cart checkout contract', () => {
  it('keeps the order guide collapsed and includes practical examples', () => {
    const cartPage = readFileSync(resolve(process.cwd(), 'src/components/public/cart/CartPageClient.tsx'), 'utf8')
    expect(cartPage).toContain('const [expanded, setExpanded] = useState(false)')
    expect(cartPage).toContain('Delivery fuera de la zona gratuita')
    expect(cartPage).toContain('Ver ejemplos')
  })

  it('sends the idempotency attempt and client prices for server reconciliation', () => {
    const request = buildPublicOrderRequest({
      checkoutAttemptId: '11111111-1111-4111-8111-111111111111',
      customer: { name: 'Ana', email: null, phone: '0981000000', address: null },
      items: [{
        productId: '22222222-2222-4222-8222-222222222222',
        variantId: '33333333-3333-4333-8333-333333333333',
        quantity: 2,
        unitPrice: 85_000,
      }],
      fulfillmentType: 'PICKUP',
      paymentMethod: 'CASH',
      shippingCost: 0,
      deliveryZoneId: null,
      deliveryCity: null,
      deliveryNeighborhood: null,
      notes: null,
      promotionCode: null,
      storeCreditAmount: 0,
    })

    expect(request.checkoutAttemptId).toBe('11111111-1111-4111-8111-111111111111')
    expect(request.items[0]).toMatchObject({ unitPrice: 85_000, quantity: 2 })
  })

  it('detects a configured delivery zone from city and neighborhood', () => {
    const zones = [
      { id: 'central', name: 'Encarnación, Centro', cost: 0 },
      { id: 'san-roque', name: 'Encarnación, San Roque', cost: 15000 },
    ]

    expect(matchDeliveryZone(zones, 'Encarnacion', 'centro')?.id).toBe('central')
    expect(matchDeliveryZone(zones, 'Encarnación', 'otro barrio')).toBeNull()
  })
})
