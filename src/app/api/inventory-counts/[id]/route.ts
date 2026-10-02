import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { roleHasPermission, type OrganizationRole } from '@/lib/saas/permissions'
import { countErrorMessage } from '@/lib/inventory/inventory-count'
import { currentStock } from '@/lib/inventory/inventory-count-server'

export const dynamic = 'force-dynamic'

const ITEM_COLUMNS = 'id, product_id, variant_id, name, sku, barcode, category_name, unit_cost, system_qty, counted_qty, system_qty_at_count, counted_at, applied_delta'

async function countId(routeContext: unknown) {
  const { id } = await (routeContext as { params: Promise<{ id: string }> }).params
  return z.string().uuid().safeParse(id).success ? id : null
}

export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (_request, { organization }, routeContext) => {
  const id = await countId(routeContext)
  if (!id) return NextResponse.json({ error: 'Toma inválida' }, { status: 400 })
  const supabase = await createClient()
  const { data: count } = await supabase
    .from('inventory_counts')
    .select('id, number, name, status, branch_id, notes, created_at, applied_at, summary, branches(name), categories(name)')
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle()
  if (!count) return NextResponse.json({ error: 'Toma no encontrada' }, { status: 404 })

  const items: unknown[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('inventory_count_items').select(ITEM_COLUMNS).eq('count_id', id).order('name').range(from, from + 999)
    if (error) return NextResponse.json({ error: 'No se pudieron leer los productos de la toma' }, { status: 500 })
    items.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  return NextResponse.json({
    count,
    items,
    canAdjust: roleHasPermission(organization.role as OrganizationRole, 'inventory.stock.manage'),
  })
})

const updateSchema = z.object({
  updates: z.array(z.object({
    item_id: z.string().uuid(),
    counted_qty: z.number().int().min(0).max(10_000_000).nullable(),
    // «Coincide»: lo contado es lo que el sistema tiene ahora (el navegador no lo sabe).
    match_system: z.boolean().optional(),
  })).min(1).max(200),
})

/**
 * Guarda lo contado. Junto con cada cantidad se anota el stock que el
 * sistema tiene en ese momento: contra eso se mide la diferencia.
 */
export const PATCH = withTenantAuth({ permission: 'inventory.stock.manage', module: 'inventory' }, async (request, { organization, user }, routeContext) => {
  const id = await countId(routeContext)
  if (!id) return NextResponse.json({ error: 'Toma inválida' }, { status: 400 })
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisá las cantidades' }, { status: 400 })

  const supabase = await createClient()
  const { data: count } = await supabase
    .from('inventory_counts')
    .select('id, branch_id, status')
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle()
  if (!count) return NextResponse.json({ error: 'Toma no encontrada' }, { status: 404 })
  if ((count as { status: string }).status !== 'counting') return NextResponse.json({ error: 'La toma ya se cerró' }, { status: 409 })

  const itemIds = parsed.data.updates.map((update) => update.item_id)
  const { data: items } = await supabase.from('inventory_count_items').select('id, product_id, variant_id').eq('count_id', id).in('id', itemIds)
  const known = (items ?? []) as Array<{ id: string; product_id: string; variant_id: string | null }>
  if (known.length !== new Set(itemIds).size) return NextResponse.json({ error: 'Un producto no es de esta toma' }, { status: 400 })

  const stock = await currentStock(supabase, organization.id, (count as { branch_id: string }).branch_id, known)
  const now = new Date().toISOString()
  const results = await Promise.all(parsed.data.updates.map((update) => {
    const system = stock.get(update.item_id) ?? 0
    const counted = update.match_system ? system : update.counted_qty
    return supabase
      .from('inventory_count_items')
      .update(counted === null
        ? { counted_qty: null, system_qty_at_count: null, counted_at: null, counted_by: null }
        : { counted_qty: counted, system_qty_at_count: system, counted_at: now, counted_by: user.id })
      .eq('id', update.item_id)
      .eq('count_id', id)
      .select(ITEM_COLUMNS)
      .maybeSingle()
  }))
  const failed = results.find((result) => result.error)
  if (failed?.error) {
    logger.error('No se pudo guardar el conteo', { error: failed.error.message })
    return NextResponse.json({ error: 'No se pudo guardar el conteo' }, { status: 500 })
  }
  return NextResponse.json({ items: results.map((result) => result.data).filter(Boolean) })
})

const actionSchema = z.object({ action: z.enum(['apply', 'cancel']) })

export const POST = withTenantAuth({ permission: 'inventory.stock.manage', module: 'inventory' }, async (request, { organization }, routeContext) => {
  const id = await countId(routeContext)
  if (!id) return NextResponse.json({ error: 'Toma inválida' }, { status: 400 })
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  const supabase = await createClient()

  if (parsed.data.action === 'cancel') {
    const { data, error } = await supabase
      .from('inventory_counts')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .eq('status', 'counting')
      .select('id')
    if (error || !data?.length) return NextResponse.json({ error: 'No se pudo anular la toma' }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  const { data: owned } = await supabase.from('inventory_counts').select('id').eq('id', id).eq('organization_id', organization.id).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Toma no encontrada' }, { status: 404 })

  const { data, error } = await supabase.rpc('apply_inventory_count', { p_count_id: id })
  if (error) {
    logger.warn('No se pudo aplicar la toma de inventario', { error: error.message })
    return NextResponse.json({ error: countErrorMessage(error, 'No se pudo aplicar la toma. No se cambió ningún stock.') }, { status: 400 })
  }
  return NextResponse.json({ ok: true, summary: data })
})
