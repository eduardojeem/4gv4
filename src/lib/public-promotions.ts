export type PublicPromotionMode = 'disabled' | 'coupon' | 'automatic'

export type PublicPromotion = {
  id: string
  code: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  min_purchase: number | null
  max_discount: number | null
  applicable_products: string[] | null
  applicable_categories: string[] | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  usage_count: number
  usage_limit: number | null
  public_mode: PublicPromotionMode
}

export type PublicPromotionCartLine = {
  product_id: string
  category_id: string | null
  quantity: number
  unit_price: number
}

export function isPromotionActive(promotion: PublicPromotion, now = new Date()) {
  if (!promotion.is_active) return false
  if (promotion.start_date && now < new Date(promotion.start_date)) return false
  if (promotion.end_date && now > new Date(promotion.end_date)) return false
  if (promotion.usage_limit != null && promotion.usage_count >= promotion.usage_limit) return false
  return true
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildPublicOfferCandidateFilter(promotions: PublicPromotion[], now = new Date()) {
  const activeAutomaticPromotions = promotions
    .filter((promotion) => promotion.public_mode === 'automatic')
    .filter((promotion) => promotion.type === 'percentage' && isPromotionActive(promotion, now))

  // applicable_categories puede traer centinelas que no son UUID (el formulario
  // del dashboard guarda 'service' para promos de reparaciones). Mandarlos a un
  // filtro sobre una columna uuid aborta la query entera, así que se descartan.
  // También evita inyección en el filtro de PostgREST vía ids manipulados.
  const asUuidList = (ids: string[]) => Array.from(new Set(ids)).filter((id) => UUID_PATTERN.test(id))

  const productIds = asUuidList(
    activeAutomaticPromotions.flatMap((promotion) => promotion.applicable_products ?? []),
  )
  const categoryIds = asUuidList(
    activeAutomaticPromotions.flatMap((promotion) => promotion.applicable_categories ?? []),
  )
  const filters = ['has_offer.eq.true']

  if (productIds.length > 0) filters.push(`id.in.(${productIds.join(',')})`)
  if (categoryIds.length > 0) filters.push(`category_id.in.(${categoryIds.join(',')})`)

  return filters.join(',')
}

function appliesToLine(promotion: PublicPromotion, line: Pick<PublicPromotionCartLine, 'product_id' | 'category_id'>) {
  const hasProducts = Boolean(promotion.applicable_products?.length)
  const hasCategories = Boolean(promotion.applicable_categories?.length)
  if (!hasProducts && !hasCategories) return true
  return Boolean(
    promotion.applicable_products?.includes(line.product_id)
    || (line.category_id && promotion.applicable_categories?.includes(line.category_id)),
  )
}

export function evaluatePublicCoupon(
  promotion: PublicPromotion,
  lines: PublicPromotionCartLine[],
  now = new Date(),
): { valid: boolean; discount_amount: number; reason?: string } {
  if (promotion.public_mode !== 'coupon') return { valid: false, discount_amount: 0, reason: 'Este código no está disponible en la tienda pública.' }
  if (!promotion.is_active) return { valid: false, discount_amount: 0, reason: 'Este código no está activo.' }
  if (promotion.start_date && now < new Date(promotion.start_date)) return { valid: false, discount_amount: 0, reason: 'Este código todavía no está vigente.' }
  if (promotion.end_date && now > new Date(promotion.end_date)) return { valid: false, discount_amount: 0, reason: 'Este código está vencido.' }
  if (promotion.usage_limit != null && promotion.usage_count >= promotion.usage_limit) {
    return { valid: false, discount_amount: 0, reason: 'Este código alcanzó su límite de usos.' }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0)
  if (promotion.min_purchase && subtotal < promotion.min_purchase) {
    return { valid: false, discount_amount: 0, reason: `La compra mínima es ${promotion.min_purchase}.` }
  }

  const eligibleSubtotal = lines
    .filter((line) => appliesToLine(promotion, line))
    .reduce((sum, line) => sum + line.quantity * line.unit_price, 0)
  if (eligibleSubtotal <= 0) return { valid: false, discount_amount: 0, reason: 'El código no aplica a los productos del carrito.' }

  const rawDiscount = promotion.type === 'percentage'
    ? eligibleSubtotal * (promotion.value / 100)
    : promotion.value
  const cappedDiscount = promotion.max_discount ? Math.min(rawDiscount, promotion.max_discount) : rawDiscount
  const discountAmount = Math.max(0, Math.min(subtotal, Math.round(cappedDiscount)))
  if (discountAmount <= 0) return { valid: false, discount_amount: 0, reason: 'El código no genera un descuento válido.' }
  return { valid: true, discount_amount: discountAmount }
}

export function applyAutomaticPromotionToProduct<
  T extends { id: string; category_id?: string | null; sale_price: number; has_offer?: boolean | null; offer_price?: number | null }
>(product: T, promotions: PublicPromotion[], now = new Date()) {
  const existingOffer = product.has_offer && product.offer_price != null && product.offer_price > 0 && product.offer_price < product.sale_price
    ? product.offer_price
    : null

  const candidates = promotions
    .filter((promotion) => promotion.public_mode === 'automatic')
    .filter((promotion) => promotion.type === 'percentage' && isPromotionActive(promotion, now))
    .filter((promotion) => Boolean(promotion.applicable_products?.length || promotion.applicable_categories?.length))
    .filter((promotion) => appliesToLine(promotion, { product_id: product.id, category_id: product.category_id ?? null }))
    .map((promotion) => ({
      promotion,
      price: Math.max(0, Math.round(product.sale_price * (1 - promotion.value / 100))),
    }))
    .filter(({ price }) => price > 0 && price < product.sale_price)
    .sort((a, b) => a.price - b.price)

  const best = candidates[0]
  if (!best || (existingOffer != null && existingOffer <= best.price)) {
    return { ...product, has_offer: existingOffer != null, offer_price: existingOffer, promotion_name: null as string | null }
  }

  return { ...product, has_offer: true, offer_price: best.price, promotion_name: best.promotion.name }
}

export function mapPublicPromotion(row: Record<string, unknown>): PublicPromotion {
  return {
    id: String(row.id),
    code: String(row.code ?? ''),
    name: String(row.name ?? ''),
    type: row.type === 'fixed' ? 'fixed' : 'percentage',
    value: Number(row.value ?? 0),
    min_purchase: row.min_purchase == null ? null : Number(row.min_purchase),
    max_discount: row.max_discount == null ? null : Number(row.max_discount),
    applicable_products: Array.isArray(row.applicable_products) ? row.applicable_products.map(String) : null,
    applicable_categories: Array.isArray(row.applicable_categories) ? row.applicable_categories.map(String) : null,
    start_date: row.start_date ? String(row.start_date) : null,
    end_date: row.end_date ? String(row.end_date) : null,
    is_active: row.is_active !== false,
    usage_count: Number(row.usage_count ?? 0),
    usage_limit: row.usage_limit == null ? null : Number(row.usage_limit),
    public_mode: row.public_mode === 'coupon' || row.public_mode === 'automatic' ? row.public_mode : 'disabled',
  }
}
