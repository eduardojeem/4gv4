import { describe, expect, it } from 'vitest'
import {
  applyCatalogOfferDiscounts,
  buildReceiptLines,
  distributeOrderDiscount,
  orderDiscountAmount,
  getActiveOfferPrice,
  priceCartLine,
  saleItemDiscountAmount,
} from '../cart-pricing'

const PYG = { fractionDigits: 0 }

describe('getActiveOfferPrice', () => {
  it('usa la oferta solo con has_offer y un precio menor al de lista', () => {
    expect(getActiveOfferPrice({ sale_price: 100000, offer_price: 80000, has_offer: true })).toBe(80000)
    expect(getActiveOfferPrice({ sale_price: 100000, offer_price: 80000, has_offer: false })).toBeNull()
    expect(getActiveOfferPrice({ sale_price: 100000, offer_price: 120000, has_offer: true })).toBeNull()
    expect(getActiveOfferPrice({ sale_price: 100000, offer_price: 0, has_offer: true })).toBeNull()
    expect(getActiveOfferPrice(undefined)).toBeNull()
  })

  it('aplica la oferta del producto en proporción a una variante de otro precio', () => {
    expect(getActiveOfferPrice({ sale_price: 100000, offer_price: 80000, has_offer: true }, 150000)).toBe(120000)
  })
})

describe('priceCartLine', () => {
  it('cobra el precio de oferta en minorista', () => {
    const line = priceCartLine({ price: 100000, quantity: 3, offerPrice: 80000 }, { isWholesale: false, ...PYG })
    expect(line).toMatchObject({ unitPrice: 100000, gross: 300000, discountAmount: 60000, net: 240000, discountSource: 'offer' })
  })

  it('no suma oferta y descuento manual: queda el mayor', () => {
    // Oferta 20% vs manual 10%: gana la oferta, no 30%.
    expect(priceCartLine({ price: 100000, quantity: 1, offerPrice: 80000, discount: 10 }, { isWholesale: false, ...PYG }))
      .toMatchObject({ discountAmount: 20000, net: 80000, discountSource: 'offer' })
    // Manual 25% supera a la oferta del 20%.
    expect(priceCartLine({ price: 100000, quantity: 1, offerPrice: 80000, discount: 25 }, { isWholesale: false, ...PYG }))
      .toMatchObject({ discountAmount: 25000, net: 75000, discountSource: 'manual' })
  })

  it('en mayorista cobra el mayorista y no aplica la oferta minorista', () => {
    expect(priceCartLine({ price: 100000, quantity: 2, wholesalePrice: 85000, offerPrice: 70000 }, { isWholesale: true, ...PYG }))
      .toMatchObject({ unitPrice: 85000, gross: 170000, discountAmount: 0, net: 170000 })
  })

  it('el descuento manual en mayorista se calcula sobre el precio mayorista', () => {
    // Antes viajaba 10% del minorista (10.000) y el servidor rechazaba el pago
    // por no coincidir: el cliente cobraba 72.000 y el servidor calculaba 70.000.
    const item = { price: 100000, quantity: 1, wholesalePrice: 80000, discount: 10 }
    expect(saleItemDiscountAmount(item, true)).toBe(8000)
    expect(priceCartLine(item, { isWholesale: true, ...PYG }).net).toBe(72000)
  })

  it('sin precio mayorista usa el 10% de descuento, igual que el RPC, aunque venga en 0', () => {
    expect(priceCartLine({ price: 100000, quantity: 1, wholesalePrice: 0 }, { isWholesale: true, ...PYG }).unitPrice).toBe(90000)
  })

  it('redondea el descuento a guaraníes enteros', () => {
    expect(priceCartLine({ price: 15555, quantity: 1, discount: 10 }, { isWholesale: false, ...PYG }).discountAmount).toBe(1556)
  })

  it('los servicios no toman oferta ni mayorista', () => {
    expect(priceCartLine({ price: 50000, quantity: 1, isService: true, offerPrice: 40000 }, { isWholesale: true, ...PYG }))
      .toMatchObject({ unitPrice: 50000, discountAmount: 0 })
  })
})

describe('buildReceiptLines', () => {
  it('imprime el descuento de la línea en guaraníes, no el porcentaje', () => {
    const receipt = buildReceiptLines([{ price: 150000, quantity: 1, discount: 10 }], { isWholesale: false, ...PYG })
    expect(receipt.items[0].discount).toBe(15000)
  })

  it('subtotal bruto menos descuentos da el total cobrado', () => {
    const receipt = buildReceiptLines([
      { price: 100000, quantity: 2, offerPrice: 90000 },
      { price: 50000, quantity: 1, discount: 10 },
      { price: 70000, quantity: 1, isService: true },
    ], { isWholesale: false, orderDiscountRate: 5, ...PYG })
    // Productos netos: 180.000 + 45.000 = 225.000; 5% general = 11.250.
    expect(receipt.subtotal).toBe(320000)
    expect(receipt.totalDiscount).toBe(20000 + 5000 + 11250)
    expect(receipt.subtotal - receipt.totalDiscount).toBe(225000 - 11250 + 70000)
  })

  it('en mayorista muestra el precio mayorista cobrado', () => {
    const receipt = buildReceiptLines([{ price: 100000, quantity: 1, wholesalePrice: 80000 }], { isWholesale: true, ...PYG })
    expect(receipt.items[0].price).toBe(80000)
    expect(receipt.subtotal).toBe(80000)
  })
})

describe('applyCatalogOfferDiscounts', () => {
  const products = [
    { id: 'p1', sale_price: 100000, offer_price: 80000, has_offer: true },
    { id: 'p2', sale_price: 50000, offer_price: null, has_offer: false },
  ]

  it('el servidor aplica la oferta aunque el carrito no la mande', () => {
    const items = applyCatalogOfferDiscounts(
      [{ product_id: 'p1', quantity: 2, discount_amount: 0 }, { product_id: 'p2', quantity: 1, discount_amount: 0 }],
      products,
      { priceMode: 'retail', fractionDigits: 0 },
    )
    expect(items.map(item => item.discount_amount)).toEqual([40000, 0])
  })

  it('no acumula: respeta un descuento manual mayor y no suma la oferta', () => {
    const [item] = applyCatalogOfferDiscounts([{ product_id: 'p1', quantity: 1, discount_amount: 30000 }], products, { priceMode: 'retail', fractionDigits: 0 })
    expect(item.discount_amount).toBe(30000)
    const [same] = applyCatalogOfferDiscounts([{ product_id: 'p1', quantity: 1, discount_amount: 20000 }], products, { priceMode: 'retail', fractionDigits: 0 })
    expect(same.discount_amount).toBe(20000)
  })

  it('en mayorista no toca los descuentos', () => {
    const [item] = applyCatalogOfferDiscounts([{ product_id: 'p1', quantity: 1, discount_amount: 0 }], products, { priceMode: 'wholesale', fractionDigits: 0 })
    expect(item.discount_amount).toBe(0)
  })
})

describe('descuento general sin céntimos', () => {
  it('se redondea a guaraníes enteros', () => {
    // 5% de 12.345 = 617,25: antes quedaba con céntimos en el total.
    expect(orderDiscountAmount(12345, 5, 0)).toBe(617)
    expect(orderDiscountAmount(12345, 5, 2)).toBe(617.25)
  })

  const products = [
    { id: 'a', sale_price: 12345, wholesale_price: null },
    { id: 'b', sale_price: 7000, wholesale_price: 6000 },
  ]

  it('la ruta lo reparte en las líneas y suma lo mismo que el carrito', () => {
    const items = [
      { product_id: 'a', quantity: 1, discount_amount: 0 },
      { product_id: 'b', quantity: 3, discount_amount: 1000 },
    ]
    const distributed = distributeOrderDiscount(items, products, { priceMode: 'retail', rate: 5, fractionDigits: 0 })!
    const shares = distributed.map((item, index) => item.discount_amount - items[index].discount_amount)
    // Netos: 12.345 + 20.000 = 32.345; 5% = 1.617,25 → 1.617 como en el carrito.
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(orderDiscountAmount(32345, 5, 0))
    expect(shares.every(share => Number.isInteger(share))).toBe(true)
  })

  it('en mayorista usa el precio mayorista o el 90% de lista', () => {
    const distributed = distributeOrderDiscount(
      [{ product_id: 'a', quantity: 1, discount_amount: 0 }, { product_id: 'b', quantity: 1, discount_amount: 0 }],
      products,
      { priceMode: 'wholesale', rate: 10, fractionDigits: 0 },
    )!
    // 11.110,5 + 6.000 = 17.110,5; 10% = 1.711.
    expect(distributed.reduce((sum, item) => sum + item.discount_amount, 0)).toBe(1711)
  })

  it('sin descuento general no toca nada y sin precio de una línea devuelve null', () => {
    const items = [{ product_id: 'a', quantity: 1, discount_amount: 0 }]
    expect(distributeOrderDiscount(items, products, { priceMode: 'retail', rate: 0, fractionDigits: 0 })).toBe(items)
    expect(distributeOrderDiscount([{ product_id: 'x', quantity: 1, discount_amount: 0 }], products, { priceMode: 'retail', rate: 5, fractionDigits: 0 })).toBeNull()
  })
})
