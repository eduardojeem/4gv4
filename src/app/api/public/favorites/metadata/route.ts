import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { z } from 'zod'
import { resolvePublicStorefrontOrganizationBySlug, toPublicOrganizationPayload } from '@/lib/saas/public-tenant'
import { getClientIp, rateLimiter } from '@/lib/rate-limiter'
import { productsHaveHidePriceColumn } from '@/lib/products/price-visibility'

// Endpoint anónimo que consulta hasta 200 productos por llamada.
const METADATA_RATE_LIMIT = 60
const METADATA_RATE_WINDOW_MS = 60 * 1000

const requestSchema = z.object({
  productIds: z.array(z.string().min(1).max(100)).max(200),
  variantIds: z.array(z.string().min(1).max(100)).max(200).optional().default([]),
})

export async function POST(request: NextRequest) {
  try {
    const allowed = await rateLimiter.check(
      `favorites-metadata:${getClientIp(request)}`,
      METADATA_RATE_LIMIT,
      METADATA_RATE_WINDOW_MS,
    )
    if (!allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
    }

    const body = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'IDs de productos inválidos' }, { status: 400 })
    }

    const { productIds, variantIds } = parsed.data
    if (productIds.length === 0) {
      return NextResponse.json({ metadata: {} })
    }

    const supabase = createAdminSupabase()
    const requestedOrganization = request.nextUrl.searchParams.get('org')
    const organization = requestedOrganization
      ? await resolvePublicStorefrontOrganizationBySlug(requestedOrganization, supabase)
      : null

    if (requestedOrganization && !organization) {
      return NextResponse.json({ error: 'Tienda no disponible' }, { status: 404 })
    }

    const conPrecioOculto = await productsHaveHidePriceColumn(supabase)
    let productsQuery = supabase
      .from('products')
      .select(`id, organization_id, name, description, sku, brand, image_url, images, sale_price, offer_price, has_offer, is_active, stock_quantity, visibility${conPrecioOculto ? ', hide_price' : ''}`)
      .in('id', productIds)

    if (organization) productsQuery = productsQuery.eq('organization_id', organization.id)

    const { data: rows, error } = await productsQuery

    if (error) {
      return NextResponse.json({ metadata: {} })
    }

    // Este endpoint es anónimo y antes respondía nombre, precio, SKU y
    // descripción de cualquier producto por su id: privados, pausados, de
    // tiendas cerradas y con «Precio a consultar» (cuyo id está en el HTML del
    // marketplace). Ahora solo lo que la tienda publica.
    const products = (rows ?? []) as unknown as Array<{
      id: string
      organization_id: string
      name: string
      description: string | null
      sku: string | null
      brand: string | null
      image_url: string | null
      images: unknown
      sale_price: number | null
      offer_price: number | null
      has_offer: boolean | null
      is_active: boolean | null
      stock_quantity: number | null
      visibility: string | null
      hide_price?: boolean | null
    }>
    const organizationIds = [...new Set(products.map((p) => p.organization_id))]
    const { data: openOrganizations } = organizationIds.length > 0
      ? await supabase.from('organizations').select('id').in('id', organizationIds).eq('storefront_public', true)
      : { data: [] }
    const openOrganizationIds = new Set((openOrganizations ?? []).map((row) => String(row.id)))
    const isPublished = (p: (typeof products)[number]) =>
      p.is_active !== false && p.visibility === 'public' && openOrganizationIds.has(p.organization_id)
    const publishedIds = new Set(products.filter(isPublished).map((p) => p.id))
    const hiddenPriceIds = new Set(products.filter((p) => p.hide_price === true).map((p) => p.id))

    const metadata: Record<string, {
      image: string | null
      name: string
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
      hidePrice: boolean
    }> = {}

    for (const p of products) {
      if (!publishedIds.has(p.id)) {
        // Favoritos lo muestra «Pausado» con lo que guardó el visitante.
        metadata[p.id] = {
          name: '',
          image: null,
          images: [],
          description: null,
          sku: null,
          brand: null,
          price: 0,
          hasOffer: false,
          offerPrice: null,
          inStock: false,
          isActive: false,
          stockQuantity: 0,
          hidePrice: false,
        }
        continue
      }
      const hidePrice = hiddenPriceIds.has(p.id)
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
        name: p.name,
        image: primaryImg,
        images: allImgs,
        description: p.description ?? null,
        sku: p.sku ?? null,
        brand: p.brand ?? null,
        // En 0 y no null: con null, Favoritos volvía al precio que guardó la tarjeta.
        price: hidePrice ? 0 : Number(p.sale_price ?? 0),
        hasOffer: hidePrice ? false : Boolean(p.has_offer),
        offerPrice: !hidePrice && typeof p.offer_price === 'number' ? p.offer_price : null,
        inStock: Number(p.stock_quantity ?? 0) > 0,
        isActive: p.is_active !== false,
        stockQuantity: Number(p.stock_quantity ?? 0),
        hidePrice,
      }
    }

    const { data: variantRows } = organization && variantIds.length > 0
      ? await supabase
          .from('product_variants')
          .select('id, product_id, variant_name, sale_price, stock_quantity, is_active')
          .eq('organization_id', organization.id)
          .in('id', variantIds)
      : { data: [] }
    const variants = Object.fromEntries((variantRows ?? []).filter((variant) => publishedIds.has(String(variant.product_id))).map((variant) => [variant.id, {
      productId: variant.product_id,
      name: variant.variant_name,
      price: hiddenPriceIds.has(String(variant.product_id)) ? 0 : Number(variant.sale_price ?? 0),
      stockQuantity: Number(variant.stock_quantity ?? 0),
      isActive: variant.is_active !== false,
    }]))

    return NextResponse.json(
      { metadata, variants, organization: organization ? toPublicOrganizationPayload(organization) : null },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } }
    )
  } catch {
    return NextResponse.json({ metadata: {} }, { status: 500 })
  }
}
