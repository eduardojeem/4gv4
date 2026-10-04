import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { BATCH_COLUMNS, isMissingBatchesTable, loadEstimatedBatches } from '@/lib/inventory/batches-server'

export const dynamic = 'force-dynamic'

async function productIdOf(routeContext: unknown) {
  const { id } = await (routeContext as { params: Promise<{ id: string }> }).params
  return z.string().uuid().safeParse(id).success ? id : null
}

async function ownsProduct(supabase: SupabaseClient, organizationId: string, productId: string) {
  const { data } = await supabase.from('products').select('id').eq('id', productId).eq('organization_id', organizationId).maybeSingle()
  return Boolean(data)
}

/** Lotes del producto, con lo que se estima que queda de cada uno. */
export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (_request, { organization }, routeContext) => {
  const productId = await productIdOf(routeContext)
  if (!productId) return NextResponse.json({ error: 'Producto inválido' }, { status: 400 })
  const supabase = (await createClient()) as unknown as SupabaseClient
  if (!(await ownsProduct(supabase, organization.id, productId))) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  const result = await loadEstimatedBatches(supabase, organization.id, { productId, includeDiscarded: true })
  if ('missing' in result) return NextResponse.json({ available: false, batches: [] })
  return NextResponse.json({ available: true, ...result })
})

const batchSchema = z.object({
  lot_code: z.string().trim().max(60).nullable().optional(),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Poné la fecha de vencimiento'),
  quantity: z.number().int().min(1, 'La cantidad tiene que ser mayor a 0').max(10_000_000),
  received_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  variant_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

/** Registra un lote que ingresó. No toca el stock: eso se hace al cargar la compra o ajustar. */
export const POST = withTenantAuth({ permission: 'products.update', module: 'inventory' }, async (request, { organization, user }, routeContext) => {
  const productId = await productIdOf(routeContext)
  if (!productId) return NextResponse.json({ error: 'Producto inválido' }, { status: 400 })
  const parsed = batchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Revisá el lote' }, { status: 400 })
  const supabase = (await createClient()) as unknown as SupabaseClient
  if (!(await ownsProduct(supabase, organization.id, productId))) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  if (parsed.data.variant_id) {
    const { data: variant } = await supabase.from('product_variants').select('id').eq('id', parsed.data.variant_id).eq('product_id', productId).maybeSingle()
    if (!variant) return NextResponse.json({ error: 'La variante no es de este producto' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('product_batches')
    .insert({
      ...parsed.data,
      lot_code: parsed.data.lot_code || null,
      notes: parsed.data.notes || null,
      variant_id: parsed.data.variant_id ?? null,
      organization_id: organization.id,
      product_id: productId,
      created_by: user.id,
    })
    .select(BATCH_COLUMNS)
    .single()
  if (error) {
    if (isMissingBatchesTable(error)) return NextResponse.json({ error: 'Falta activar lotes y vencimientos en la base de datos.' }, { status: 503 })
    logger.error('No se pudo guardar el lote', { error: error.message })
    return NextResponse.json({ error: 'No se pudo guardar el lote' }, { status: 500 })
  }
  return NextResponse.json({ batch: data }, { status: 201 })
})

const actionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['discard', 'restore']),
  reason: z.string().trim().max(200).optional(),
})

/** Descartar (vencido, roto, devuelto) o volver a contar un lote. */
export const PATCH = withTenantAuth({ permission: 'products.update', module: 'inventory' }, async (request, { organization }, routeContext) => {
  const productId = await productIdOf(routeContext)
  if (!productId) return NextResponse.json({ error: 'Producto inválido' }, { status: 400 })
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  const supabase = await createClient()
  const update = parsed.data.action === 'discard'
    ? { discarded_at: new Date().toISOString(), discarded_reason: parsed.data.reason || 'Descartado' }
    : { discarded_at: null, discarded_reason: null }
  const { data, error } = await supabase
    .from('product_batches')
    .update(update)
    .eq('id', parsed.data.id)
    .eq('product_id', productId)
    .eq('organization_id', organization.id)
    .select(BATCH_COLUMNS)
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'No se pudo actualizar el lote' }, { status: 500 })
  return NextResponse.json({ batch: data })
})
