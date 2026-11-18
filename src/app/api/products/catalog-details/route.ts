import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { ProductDetailsSchema, cleanProductDetails } from '@/lib/products/catalog-contract'
import { getBrowserRequestOrigin } from '@/lib/http/app-origin'

export const dynamic = 'force-dynamic'
const missing = (error: { code?: string; message?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205'
const migrationMessage = 'Falta activar las características del catálogo en la base de datos. El producto no se guardó con estos datos.'
function variantKeys(product: { has_variants?: boolean; variant_attribute_config?: unknown }) {
  return product.has_variants && Array.isArray(product.variant_attribute_config) ? product.variant_attribute_config.flatMap(item => typeof item?.key === 'string' ? [item.key] : []) : []
}

export const GET = withTenantAuth({ permission: 'products.read', module: ['inventory', 'services'] }, async (request, { organization }) => {
  const client = await createClient()
  const id = new URL(request.url).searchParams.get('id')
  let keys: string[] = []
  if (id && !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Producto inválido.' }, { status: 400 })
  if (id) {
    const { data: product, error } = await client.from('products').select('id,has_variants,variant_attribute_config').eq('id', id).eq('organization_id', organization.id).maybeSingle()
    if (error) return NextResponse.json({ error: 'No se pudo verificar el producto.' }, { status: 503 })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })
    keys = variantKeys(product)
  }
  const admin = createAdminSupabase()
  const query = admin.from('product_catalog_details').select('details').eq('organization_id', organization.id)
  const { data, error } = id ? await query.eq('product_id', id).maybeSingle() : await query.limit(0)
  if (missing(error)) return NextResponse.json({ available: false, details: {} })
  if (error) return NextResponse.json({ error: 'No se pudieron consultar las características.' }, { status: 503 })
  const parsedDetails = ProductDetailsSchema.safeParse(id && data && !Array.isArray(data) ? data.details : {})
  if (!parsedDetails.success) return NextResponse.json({ error: 'Las características guardadas necesitan revisión.' }, { status: 503 })
  return NextResponse.json({ available: true, details: cleanProductDetails(parsedDetails.data, keys), variantKeys: keys })
})

export const PUT = withTenantAuth({ permission: 'products.update', module: ['inventory', 'services'] }, async (request, { organization }) => {
  const origin = request.headers.get('origin')
  if ((origin && origin !== getBrowserRequestOrigin(request)) || request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'El origen de la solicitud no está autorizado.' }, { status: 403 })
  const parsed = z.object({ id: z.string().uuid(), details: ProductDetailsSchema }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisá las características del producto.' }, { status: 400 })
  const client = await createClient()
  const { data: product, error: productError } = await client.from('products').select('id,has_variants,variant_attribute_config').eq('id', parsed.data.id).eq('organization_id', organization.id).maybeSingle()
  if (productError) return NextResponse.json({ error: 'No se pudo verificar el producto.' }, { status: 503 })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 })
  const details = cleanProductDetails(parsed.data.details, variantKeys(product))
  const { error } = await createAdminSupabase().from('product_catalog_details').upsert({ product_id: product.id, organization_id: organization.id, details, updated_at: new Date().toISOString() }, { onConflict: 'product_id' })
  if (missing(error)) return NextResponse.json({ error: migrationMessage }, { status: 503 })
  if (error) return NextResponse.json({ error: 'No se pudieron guardar las características.' }, { status: 503 })
  return NextResponse.json({ success: true, details })
})
