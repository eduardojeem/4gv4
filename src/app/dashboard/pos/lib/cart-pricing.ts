import { config } from '@/lib/config'
import { getCurrencyFractionDigits } from '@/lib/currency'
import { hasActiveCatalogOffer } from '@/lib/products/offer-filter'
import { resolveOfferPrice } from '@/lib/public/offer-pricing'

/** Descuento mayorista cuando el producto no tiene precio mayorista propio (igual que el RPC). */
export const WHOLESALE_DISCOUNT_RATE = 10

export type PricedCartLineInput = {
  price: number
  quantity: number
  /** Descuento manual o de código promocional, en porcentaje (0-100). */
  discount?: number
  wholesalePrice?: number | null
  /** Precio de oferta vigente por unidad (ya resuelto al agregar al carrito). */
  offerPrice?: number | null
  isService?: boolean
}

export type PricedCartLine = {
  /** Precio unitario cobrado antes de descuentos: mayorista o lista. */
  unitPrice: number
  /** unitPrice × cantidad. */
  gross: number
  /** Descuento de la línea en moneda, el que viaja como `discount_amount`. */
  discountAmount: number
  net: number
  /** Qué descuento quedó: nunca se suman la oferta y el descuento manual. */
  discountSource: 'offer' | 'manual' | null
}

function roundTo(value: number, fractionDigits: number) {
  const step = 10 ** fractionDigits
  return Math.round((value + Number.EPSILON) * step) / step
}

function positive(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

/**
 * Precio de oferta vigente de un producto (o de una variante del mismo precio).
 *
 * Misma regla que la tienda: `has_offer` encendido y un precio de oferta que
 * baje del de lista. Las variantes heredan la oferta en proporción, como en la
 * vitrina, para que el POS y la web cobren lo mismo.
 */
export function getActiveOfferPrice(
  product: { sale_price?: unknown; offer_price?: unknown; has_offer?: unknown } | null | undefined,
  variantPrice?: number,
): number | null {
  if (!product || !hasActiveCatalogOffer(product as Record<string, unknown>)) return null
  const salePrice = Number(product.sale_price)
  const offerPrice = Number(product.offer_price)
  if (variantPrice === undefined || variantPrice === salePrice) return offerPrice
  const resolved = resolveOfferPrice(salePrice, offerPrice, variantPrice)
  return resolved > 0 && resolved < variantPrice ? resolved : null
}

/**
 * Precio de una línea del carrito, igual a como lo recalcula el servidor.
 *
 * Reglas:
 * - En mayorista se cobra el precio mayorista y la oferta minorista no aplica
 *   (son dos esquemas de descuento distintos, como en la tienda).
 * - La oferta y el descuento manual/promocional no se acumulan: queda el mayor.
 * - El descuento se redondea a los decimales de la moneda (Gs. sin decimales),
 *   porque es el importe que se guarda en la venta.
 */
export function priceCartLine(
  item: PricedCartLineInput,
  options: { isWholesale: boolean; fractionDigits?: number },
): PricedCartLine {
  const fractionDigits = options.fractionDigits ?? getCurrencyFractionDigits(config.currency)
  const listPrice = Number(item.price) || 0
  const quantity = Math.max(0, Number(item.quantity) || 0)
  const useWholesale = options.isWholesale && !item.isService
  const unitPrice = useWholesale
    ? (positive(item.wholesalePrice) ?? roundTo(listPrice * (1 - WHOLESALE_DISCOUNT_RATE / 100), 2))
    : listPrice
  const gross = roundTo(unitPrice * quantity, 2)

  const rate = Math.min(100, Math.max(0, Number(item.discount) || 0))
  const manualDiscount = roundTo(gross * rate / 100, fractionDigits)
  const offerPrice = positive(item.offerPrice)
  const offerDiscount = !useWholesale && !item.isService && offerPrice !== null && offerPrice < listPrice
    ? roundTo((listPrice - offerPrice) * quantity, fractionDigits)
    : 0

  const discountAmount = Math.min(gross, Math.max(offerDiscount, manualDiscount))
  const discountSource = discountAmount <= 0
    ? null
    : offerDiscount >= manualDiscount ? 'offer' : 'manual'

  return {
    unitPrice,
    gross,
    discountAmount,
    net: roundTo(gross - discountAmount, 2),
    discountSource,
  }
}

/**
 * Líneas del ticket con montos, no porcentajes.
 *
 * El carrito guarda el descuento por ítem como porcentaje y el ticket lo
 * imprime como importe: un 10% salía «Descuento: -Gs. 10». Acá se pasa el
 * precio unitario efectivamente cobrado (mayorista incluido) y el descuento
 * de la línea en moneda, igual que en la reimpresión desde la venta guardada.
 */
export function buildReceiptLines<T extends PricedCartLineInput>(
  items: T[],
  options: { isWholesale: boolean; orderDiscountRate?: number; fractionDigits?: number },
) {
  const lines = items.map(item => priceCartLine(item, options))
  const productsNet = lines.reduce((sum, line, index) => sum + (items[index].isService ? 0 : line.net), 0)
  const orderDiscount = orderDiscountAmount(productsNet, options.orderDiscountRate, options.fractionDigits)
  return {
    items: toReceiptLines(items, options),
    /** Bruto de las líneas: el descuento se muestra aparte, una sola vez. */
    subtotal: roundTo(lines.reduce((sum, line) => sum + line.gross, 0), 2),
    totalDiscount: roundTo(lines.reduce((sum, line) => sum + line.discountAmount, 0) + orderDiscount, 2),
  }
}

/**
 * El servidor aplica la oferta vigente aunque el cliente no la haya mandado.
 *
 * El RPC cobra `sale_price` y solo conoce el descuento que llega por línea. Si
 * el carrito venía sin la oferta (pestaña vieja, venta en espera), la venta se
 * cobraba a precio de lista. Se toma el mayor entre lo enviado y la oferta,
 * igual que `priceCartLine`: nunca se suman. En mayorista no hay oferta.
 */
export function applyCatalogOfferDiscounts<T extends { product_id: string; quantity: number; discount_amount: number }>(
  items: T[],
  products: Array<{ id: string; sale_price?: unknown; offer_price?: unknown; has_offer?: unknown }>,
  options: { priceMode: 'retail' | 'wholesale'; fractionDigits: number },
): T[] {
  if (options.priceMode !== 'retail') return items
  const byId = new Map(products.map(product => [product.id, product]))
  return items.map(item => {
    const product = byId.get(item.product_id)
    const offerPrice = getActiveOfferPrice(product)
    if (!product || offerPrice === null) return item
    const offerDiscount = roundTo((Number(product.sale_price) - offerPrice) * item.quantity, options.fractionDigits)
    return offerDiscount > item.discount_amount ? { ...item, discount_amount: offerDiscount } : item
  })
}

/**
 * Descuento general en moneda, sobre los productos ya netos de sus descuentos.
 * Se redondea a los decimales de la moneda: en guaraníes, a enteros.
 */
export function orderDiscountAmount(productsNet: number, rate: unknown, fractionDigits?: number) {
  const digits = fractionDigits ?? getCurrencyFractionDigits(config.currency)
  const safeRate = Math.min(100, Math.max(0, Number(rate) || 0))
  return roundTo(Math.max(0, Number(productsNet) || 0) * safeRate / 100, digits)
}

/**
 * Reparte el descuento general entre las líneas, como descuento de cada una.
 *
 * El RPC calculaba el descuento general con 2 decimales y en guaraníes dejaba
 * céntimos en el total. La ruta lo convierte en importes por línea con los
 * decimales de la moneda (la misma cuenta que el carrito) y manda la tasa en 0.
 * De paso, el subtotal de cada línea refleja lo que realmente se cobró, para
 * comisiones y productos más vendidos. Devuelve null si falta el precio de
 * alguna línea: entonces la ruta deja la tasa como venía.
 */
export function distributeOrderDiscount<T extends { product_id: string; quantity: number; discount_amount: number }>(
  items: T[],
  products: Array<{ id: string; sale_price?: unknown; wholesale_price?: unknown }>,
  options: { priceMode: 'retail' | 'wholesale'; rate: number; fractionDigits: number },
): T[] | null {
  if (!(options.rate > 0) || items.length === 0) return items
  const byId = new Map(products.map(product => [product.id, product]))
  const lines: Array<{ gross: number; net: number }> = []
  for (const item of items) {
    const product = byId.get(item.product_id)
    if (!product) return null
    const listPrice = Number(product.sale_price) || 0
    const unitPrice = options.priceMode === 'wholesale'
      ? (positive(product.wholesale_price) ?? roundTo(listPrice * (1 - WHOLESALE_DISCOUNT_RATE / 100), 2))
      : listPrice
    const gross = roundTo(unitPrice * item.quantity, 2)
    lines.push({ gross, net: roundTo(gross - Math.min(gross, item.discount_amount), 2) })
  }
  const productsNet = roundTo(lines.reduce((sum, line) => sum + line.net, 0), 2)
  const total = orderDiscountAmount(productsNet, options.rate, options.fractionDigits)
  if (total <= 0 || productsNet <= 0) return items
  const step = 10 ** options.fractionDigits
  const shares = lines.map(line => Math.floor((total * line.net / productsNet) * step + Number.EPSILON) / step)
  // El sobrante del redondeo va a la línea de mayor importe.
  let largest = 0
  lines.forEach((line, index) => { if (line.net > lines[largest].net) largest = index })
  shares[largest] = roundTo(shares[largest] + total - shares.reduce((sum, share) => sum + share, 0), options.fractionDigits)
  return items.map((item, index) => shares[index] > 0
    ? { ...item, discount_amount: roundTo(Math.min(lines[index].gross, item.discount_amount + shares[index]), 2) }
    : item)
}

/** Línea tal como viaja a `/api/pos/process-sale`: el descuento siempre en moneda. */
export function saleItemDiscountAmount(item: PricedCartLineInput, isWholesale: boolean) {
  return priceCartLine(item, { isWholesale }).discountAmount
}

export function toReceiptLines<T extends PricedCartLineInput>(
  items: T[],
  options: { isWholesale: boolean; fractionDigits?: number },
): Array<T & { price: number; discount: number | undefined }> {
  return items.map(item => {
    const line = priceCartLine(item, options)
    return { ...item, price: line.unitPrice, discount: line.discountAmount > 0 ? line.discountAmount : undefined }
  })
}
