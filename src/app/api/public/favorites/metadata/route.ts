import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { z } from 'zod'

const requestSchema = z.object({
  productIds: z.array(z.string().min(1).max(100)).max(200),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'IDs de productos inválidos' }, { status: 400 })
    }

    const { productIds } = parsed.data
    if (productIds.length === 0) {
      return NextResponse.json({ metadata: {} })
    }

    const supabase = createAdminSupabase()
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, image_url, images, sale_price, offer_price, has_offer, is_active, stock_quantity')
      .in('id', productIds)

    if (error) {
      return NextResponse.json({ metadata: {} })
    }

    const metadata: Record<string, {
      image: string | null
      price: number | null
      hasOffer: boolean
      offerPrice: number | null
      inStock: boolean
    }> = {}

    for (const p of products ?? []) {
      const img = (Array.isArray(p.images) && p.images.length > 0 && typeof p.images[0] === 'string' && p.images[0].trim())
        ? p.images[0]
        : (typeof p.image_url === 'string' && p.image_url.trim() ? p.image_url : null)

      metadata[p.id] = {
        image: img,
        price: Number(p.sale_price ?? 0),
        hasOffer: Boolean(p.has_offer),
        offerPrice: typeof p.offer_price === 'number' ? p.offer_price : null,
        inStock: Number(p.stock_quantity ?? 0) > 0,
      }
    }

    return NextResponse.json(
      { metadata },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } }
    )
  } catch {
    return NextResponse.json({ metadata: {} }, { status: 500 })
  }
}
