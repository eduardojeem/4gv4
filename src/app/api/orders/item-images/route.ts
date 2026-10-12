import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'

const requestSchema = z.object({
  productIds: z.array(z.string().uuid()).max(200),
})

/**
 * Fotos de los productos de un pedido, para el panel de pedidos.
 *
 * Antes el panel las pedía al endpoint anónimo de favoritos. Ese endpoint ahora
 * solo responde productos publicados, así que un producto vendido y después
 * pausado o hecho privado se quedaba sin foto en el detalle del pedido. Acá la
 * tienda ve las de sus propios productos, estén como estén.
 */
export const POST = withTenantAuth({ permission: 'ecommerce.orders.manage', module: 'orders' }, async (request, { organization }) => {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'IDs de productos inválidos' }, { status: 400 })

  const productIds = [...new Set(parsed.data.productIds)]
  if (productIds.length === 0) return NextResponse.json({ images: {} })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, image_url, images')
    .eq('organization_id', organization.id)
    .in('id', productIds)

  if (error) return NextResponse.json({ images: {} })

  const images: Record<string, string | null> = {}
  for (const row of data ?? []) {
    const gallery = Array.isArray(row.images) ? row.images.filter((img): img is string => typeof img === 'string' && img.trim() !== '') : []
    const primary = typeof row.image_url === 'string' && row.image_url.trim() ? row.image_url : null
    images[String(row.id)] = primary ?? gallery[0] ?? null
  }

  return NextResponse.json({ images }, { headers: { 'Cache-Control': 'private, no-store' } })
})
