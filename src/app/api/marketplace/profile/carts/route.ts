import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicStorefrontOrganizationBySlug, toPublicOrganizationPayload } from '@/lib/saas/public-tenant'
import { cartSyncInputSchema } from '@/lib/marketplace/cart-sync'

type ProductRow = { id: string; name: string; image_url: string | null; images: unknown; sale_price: number | null; offer_price: number | null; has_offer: boolean | null; stock_quantity: number | null }
type VariantRow = { id: string; product_id: string; variant_name: string; sale_price: number | null; stock_quantity: number | null }

async function authenticatedUser() {
  const db = await createClient()
  const { data: { user }, error } = await db.auth.getUser()
  return { db, user: error ? null : user }
}

export async function GET(request: NextRequest) {
  const { db, user } = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })

  let query = db
    .from('customer_carts')
    .select('id, organization_id, last_verified_at, updated_at, items:customer_cart_items(id, product_id, variant_id, quantity, observed_unit_price)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (organizationId) query = query.eq('organization_id', organizationId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'No se pudieron cargar los carritos' }, { status: 500 })
  const organizationIds = [...new Set((data ?? []).map((cart) => cart.organization_id))]
  const { data: organizations, error: organizationError } = organizationIds.length > 0
    ? await createAdminSupabase().from('organizations').select('id, name, slug, logo_url').in('id', organizationIds).eq('storefront_public', true)
    : { data: [], error: null }
  if (organizationError) return NextResponse.json({ error: 'No se pudieron cargar las tiendas' }, { status: 500 })
  const organizationMap = new Map((organizations ?? []).map((organization) => [organization.id, organization]))
  return NextResponse.json({ carts: (data ?? []).flatMap((cart) => {
    const organization = organizationMap.get(cart.organization_id)
    return organization ? [{ ...cart, organization }] : []
  }) })
}

export async function PUT(request: NextRequest) {
  const { db, user } = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })

  const parsed = cartSyncInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Carrito inválido' }, { status: 400 })

  const admin = createAdminSupabase()
  const organization = await resolvePublicStorefrontOrganizationBySlug(parsed.data.organizationSlug, admin)
  if (!organization) return NextResponse.json({ error: 'Tienda no disponible' }, { status: 404 })

  const productIds = [...new Set(parsed.data.items.map((item) => item.productId))]
  const variantIds = [...new Set(parsed.data.items.flatMap((item) => item.variantId ? [item.variantId] : []))]
  const [{ data: productRows, error: productError }, { data: variantRows, error: variantError }] = await Promise.all([
    productIds.length > 0
      ? admin.from('products')
          .select('id, name, image_url, images, sale_price, offer_price, has_offer, stock_quantity')
          .eq('organization_id', organization.id)
          .eq('is_active', true)
          .in('id', productIds)
      : Promise.resolve({ data: [] as ProductRow[], error: null }),
    variantIds.length > 0
      ? admin.from('product_variants')
          .select('id, product_id, variant_name, sale_price, stock_quantity')
          .eq('organization_id', organization.id)
          .eq('is_active', true)
          .in('id', variantIds)
      : Promise.resolve({ data: [] as VariantRow[], error: null }),
  ])

  if (productError || variantError) {
    return NextResponse.json({ error: 'No se pudo verificar el catálogo' }, { status: 500 })
  }

  const products = new Map((productRows as ProductRow[] | null ?? []).map((row) => [row.id, row]))
  const variants = new Map((variantRows as VariantRow[] | null ?? []).map((row) => [row.id, row]))
  const conflicts: Array<{ productId: string; variantId: string | null; reason: 'unavailable' | 'quantity_adjusted'; requestedQuantity: number; availableQuantity: number }> = []
  const accepted = parsed.data.items.flatMap((item) => {
    const product = products.get(item.productId)
    const variant = item.variantId ? variants.get(item.variantId) : null
    const validVariant = !item.variantId || (variant && variant.product_id === item.productId)
    const stock = Math.max(0, Number(variant?.stock_quantity ?? product?.stock_quantity ?? 0))

    if (!product || !validVariant || stock === 0) {
      conflicts.push({ productId: item.productId, variantId: item.variantId, reason: 'unavailable', requestedQuantity: item.quantity, availableQuantity: stock })
      return []
    }

    const quantity = Math.min(item.quantity, stock)
    if (quantity !== item.quantity) {
      conflicts.push({ productId: item.productId, variantId: item.variantId, reason: 'quantity_adjusted', requestedQuantity: item.quantity, availableQuantity: stock })
    }
    const unitPrice = variant
      ? Number(variant.sale_price ?? 0)
      : product.has_offer && product.offer_price != null
        ? Number(product.offer_price)
        : Number(product.sale_price ?? 0)
    const image = Array.isArray(product.images)
      ? product.images.find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? product.image_url
      : product.image_url

    return [{
      productId: item.productId,
      variantId: item.variantId,
      quantity,
      unitPrice,
      name: variant ? `${product.name} (${variant.variant_name})` : product.name,
      image: image ?? null,
      availableStock: stock,
    }]
  })

  const now = new Date().toISOString()
  const { data: cart, error: cartError } = await db
    .from('customer_carts')
    .upsert({ user_id: user.id, organization_id: organization.id, last_verified_at: now, updated_at: now }, { onConflict: 'user_id,organization_id' })
    .select('id')
    .single()
  if (cartError || !cart) return NextResponse.json({ error: 'No se pudo guardar el carrito' }, { status: 500 })

  const { error: clearError } = await db.from('customer_cart_items').delete().eq('cart_id', cart.id)
  if (clearError) return NextResponse.json({ error: 'No se pudo actualizar el carrito' }, { status: 500 })

  if (accepted.length > 0) {
    const { error: insertError } = await db.from('customer_cart_items').insert(accepted.map((item) => ({
      cart_id: cart.id,
      product_id: item.productId,
      variant_id: item.variantId,
      quantity: item.quantity,
      observed_unit_price: item.unitPrice,
    })))
    if (insertError) return NextResponse.json({ error: 'No se pudieron guardar los productos' }, { status: 500 })
  }

  return NextResponse.json({
    cartId: cart.id,
    organization: toPublicOrganizationPayload(organization),
    items: accepted,
    conflicts,
    lastVerifiedAt: now,
  })
}

export async function DELETE(request: NextRequest) {
  const { db, user } = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })

  const organizationSlug = request.nextUrl.searchParams.get('organizationSlug')
  const slugResult = cartSyncInputSchema.shape.organizationSlug.safeParse(organizationSlug)
  if (!slugResult.success) return NextResponse.json({ error: 'Tienda inválida' }, { status: 400 })

  const organization = await resolvePublicStorefrontOrganizationBySlug(slugResult.data, createAdminSupabase())
  if (!organization) return NextResponse.json({ error: 'Tienda no disponible' }, { status: 404 })

  const { error } = await db
    .from('customer_carts')
    .delete()
    .eq('user_id', user.id)
    .eq('organization_id', organization.id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar el carrito' }, { status: 500 })

  return NextResponse.json({ success: true })
}
