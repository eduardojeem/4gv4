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
      .select('id, name, description, sku, brand, image_url, images, sale_price, offer_price, has_offer, is_active, stock_quantity')
      .in('id', productIds)

    if (error) {
      return NextResponse.json({ metadata: {} })
    }

    const metadata: Record<string, {
      image: string | null
      images: string[]
      description: string | null
      sku: string | null
      brand: string | null
      price: number | null
      hasOffer: boolean
      offerPrice: number | null
      inStock: boolean
      isActive: boolean
      stockQuantity: number
    }> = {}

    for (const p of products ?? []) {
      const allImgs: string[] = []
      if (Array.isArray(p.images)) {
        for (const img of p.images) {
          if (typeof img === 'string' && img.trim()) allImgs.push(img)
        }
      }
      if (typeof p.image_url === 'string' && p.image_url.trim() && !allImgs.includes(p.image_url)) {
        allImgs.unshift(p.image_url)
      }
      const primaryImg = allImgs[0] ?? (typeof p.image_url === 'string' && p.image_url.trim() ? p.image_url : null)

      metadata[p.id] = {
        image: primaryImg,
        images: allImgs,
        description: p.description ?? null,
        sku: p.sku ?? null,
        brand: p.brand ?? null,
        price: Number(p.sale_price ?? 0),
        hasOffer: Boolean(p.has_offer),
        offerPrice: typeof p.offer_price === 'number' ? p.offer_price : null,
        inStock: Number(p.stock_quantity ?? 0) > 0,
        isActive: p.is_active !== false,
        stockQuantity: Number(p.stock_quantity ?? 0),
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
