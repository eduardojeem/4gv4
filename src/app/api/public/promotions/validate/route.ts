import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicStorefrontOrganization } from '@/lib/saas/public-tenant'
import { applyAutomaticPromotionToProduct, evaluatePublicCoupon, mapPublicPromotion } from '@/lib/public-promotions'
import { getClientIp, rateLimiter } from '@/lib/rate-limiter'

const schema = z.object({
  code: z.string().trim().min(2).max(80),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(999),
  })).min(1).max(100),
})

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  if (!rateLimiter.check(`public-promotion:${clientIp}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ success: false, error: 'Demasiados intentos. Intenta nuevamente más tarde.' }, { status: 429 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Código o carrito inválido.' }, { status: 400 })

  const supabase = createAdminSupabase()
  const organization = await resolvePublicStorefrontOrganization(request, supabase)
  if (!organization) return NextResponse.json({ success: false, error: 'Organización no encontrada.' }, { status: 404 })

  const productIds = parsed.data.items.map((item) => item.productId)
  const [{ data: products }, { data: promotionRow }, { data: automaticRows }] = await Promise.all([
    supabase.from('products').select('id, category_id, sale_price, has_offer, offer_price, is_active').eq('organization_id', organization.id).eq('is_active', true).in('id', productIds),
    supabase.from('promotions').select('*').eq('organization_id', organization.id).eq('code', parsed.data.code.toUpperCase()).maybeSingle(),
    supabase.from('promotions').select('*').eq('organization_id', organization.id).eq('public_mode', 'automatic').eq('is_active', true),
  ])

  if (!promotionRow) return NextResponse.json({ success: false, error: 'Código promocional inválido.' }, { status: 404 })
  if ((products ?? []).length !== new Set(productIds).size) {
    return NextResponse.json({ success: false, error: 'Uno de los productos ya no está disponible.' }, { status: 400 })
  }

  const automaticPromotions = (automaticRows ?? []).map((row) => mapPublicPromotion(row as Record<string, unknown>))
  const productMap = new Map((products ?? []).map((row) => [String(row.id), row]))
  const lines = parsed.data.items.map((item) => {
    const product = productMap.get(item.productId)!
    const priced = applyAutomaticPromotionToProduct({
      id: String(product.id),
      category_id: product.category_id ? String(product.category_id) : null,
      sale_price: Number(product.sale_price ?? 0),
      has_offer: Boolean(product.has_offer),
      offer_price: product.offer_price == null ? null : Number(product.offer_price),
    }, automaticPromotions)
    return {
      product_id: item.productId,
      category_id: product.category_id ? String(product.category_id) : null,
      quantity: item.quantity,
      unit_price: priced.has_offer && priced.offer_price ? priced.offer_price : priced.sale_price,
    }
  })

  const promotion = mapPublicPromotion(promotionRow as Record<string, unknown>)
  const result = evaluatePublicCoupon(promotion, lines)
  if (!result.valid) return NextResponse.json({ success: false, error: result.reason }, { status: 422 })

  return NextResponse.json({
    success: true,
    data: {
      code: promotion.code,
      name: promotion.name,
      discountAmount: result.discount_amount,
      subtotal: lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0),
    },
  })
}
