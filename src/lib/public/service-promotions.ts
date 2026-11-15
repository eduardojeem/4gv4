import { isPromotionActive, mapPublicPromotion } from '@/lib/public-promotions'

/**
 * Promociones de la tienda que aplican a un servicio de la agenda.
 *
 * La reserva online no cobra: el descuento se aplica al cobrar el turno en el
 * local (POS), donde una promo vale para un servicio si el producto del
 * servicio está entre sus productos. Por eso acá solo cuentan las promos que
 * nombran el servicio: una promo general (sin productos) o «para reparaciones»
 * (categoría `service`) no se anuncia en cada servicio, porque prometería un
 * descuento que en el local no corresponde.
 */
export type ServicePromotion = {
  id: string
  name: string
  description: string | null
  /** Solo las promos «canjeables en la tienda pública» muestran su código. */
  code: string | null
  type: 'percentage' | 'fixed'
  value: number
  maxDiscount: number | null
  minPurchase: number | null
  endsAt: string | null
}

/** Columnas que necesita la agenda pública para decidir; la respuesta no expone usos ni límites. */
export const SERVICE_PROMOTION_COLUMNS =
  'id, code, name, description, type, value, min_purchase, max_discount, applicable_products, applicable_categories, start_date, end_date, is_active, usage_count, usage_limit, public_mode'

export function servicePromotionsByService(
  rows: Array<Record<string, unknown>>,
  serviceIds: string[],
  now = new Date(),
): Record<string, ServicePromotion[]> {
  const wanted = new Set(serviceIds)
  const result: Record<string, ServicePromotion[]> = {}
  for (const row of rows) {
    const promotion = mapPublicPromotion(row)
    if (promotion.public_mode === 'disabled' || !isPromotionActive(promotion, now)) continue
    if (!(promotion.value > 0)) continue
    const description = typeof row.description === 'string' && row.description.trim() ? row.description.trim() : null
    for (const serviceId of new Set(promotion.applicable_products ?? [])) {
      if (!wanted.has(serviceId)) continue
      const list = result[serviceId] ?? (result[serviceId] = [])
      list.push({
        id: promotion.id,
        name: promotion.name,
        description,
        code: promotion.public_mode === 'coupon' && promotion.code ? promotion.code : null,
        type: promotion.type,
        value: promotion.value,
        maxDiscount: promotion.max_discount,
        minPurchase: promotion.min_purchase && promotion.min_purchase > 0 ? promotion.min_purchase : null,
        endsAt: promotion.end_date,
      })
    }
  }
  // La que más conviene primero: es la que muestra la tarjeta.
  for (const list of Object.values(result)) list.sort((a, b) => b.value - a.value)
  return result
}

/** «20% OFF» o el monto fijo, formateado por quien llama. */
export function servicePromotionLabel(promotion: Pick<ServicePromotion, 'type' | 'value'>, formatAmount: (value: number) => string) {
  return promotion.type === 'percentage' ? `${promotion.value}% OFF` : `${formatAmount(promotion.value)} OFF`
}

/** Precio estimado con la promo, para mostrar «antes / ahora». Null si no aplica. */
export function priceWithServicePromotion(price: number | null, promotion: ServicePromotion): number | null {
  if (price == null || price <= 0) return null
  if (promotion.minPurchase != null && price < promotion.minPurchase) return null
  let discount = promotion.type === 'percentage' ? Math.round((price * promotion.value) / 100) : promotion.value
  if (promotion.maxDiscount != null && promotion.maxDiscount > 0) discount = Math.min(discount, promotion.maxDiscount)
  return Math.max(0, price - Math.min(discount, price))
}
